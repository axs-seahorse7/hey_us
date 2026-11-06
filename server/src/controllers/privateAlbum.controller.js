import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'

import {GetObjectCommand, PutObjectCommand, DeleteObjectCommand  } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3 } from '../config/s3.js'


import { isBlockedFile } from '../utils/fileValidation.js'
import { Media } from '../models/Media.js'


import { HeadObjectCommand } from '@aws-sdk/client-s3'
import {
  generateThumbnail,
  isImageMedia,
  isVideoMedia,
} from '../utils/mediaThumbnail.js'

export async function getPrivateAlbumStatus(req, res, next) {
  try {
    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    return res.json({
      isConfigured: user.privateAlbum?.enabled || false,
      credentialType: user.privateAlbum?.credentialType || null,
    })
  } catch (error) {
    return next(error)
  }
}

export async function setupPrivateAlbum(req, res, next) {
  try {
    const { credentialType, credential } = req.body

    if (!['pin', 'password'].includes(credentialType)) {
      return res.status(400).json({ message: 'Choose PIN or password.' })
    }

    if (typeof credential !== 'string') {
      return res.status(400).json({ message: 'Credential is required.' })
    }

    if (
      (credentialType === 'pin' && !/^\d{4,6}$/.test(credential)) ||
      (credentialType === 'password' && credential.length < 8)
    ) {
      return res.status(400).json({
        message: credentialType === 'pin'
          ? 'PIN must contain 4 to 6 digits.'
          : 'Password must contain at least 8 characters.',
      })
    }

    const user = await User.findById(req.user.id).select('+privateAlbum.credentialHash')

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    if (user.privateAlbum?.enabled) {
      return res.status(409).json({
        message: 'Private Album is already configured.',
      })
    }

    user.privateAlbum = {
      enabled: true,
      credentialType,
      credentialHash: await bcrypt.hash(credential, 12),
    }

    await user.save()

    return res.status(201).json({
      message: 'Private Album configured successfully.',
      isConfigured: true,
      credentialType,
    })
  } catch (error) {
    return next(error)
  }
}

export async function unlockPrivateAlbum(req, res, next) {
  try {
    const { credential } = req.body

    if (typeof credential !== 'string' || !credential) {
      return res.status(400).json({ message: 'Credential is required.' })
    }

    const user = await User.findById(req.user.id)
      .select('+privateAlbum.credentialHash')

    if (!user?.privateAlbum?.enabled || !user.privateAlbum.credentialHash) {
      return res.status(400).json({
        message: 'Private Album is not configured.',
      })
    }

    const isValid = await bcrypt.compare(
      credential,
      user.privateAlbum.credentialHash,
    )

    if (!isValid) {
      return res.status(401).json({ message: 'Incorrect credential.' })
    }

    const privateToken = jwt.sign(
      {
        userId: user.id,
        type: 'private_album',
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    )

    return res.json({
      message: 'Private Album unlocked.',
      privateToken,
      expiresIn: 900,
    })
  } catch (error) {
    return next(error)
  }
}

export async function getPrivateAlbumMedia(req, res, next) {
  try {
    const media = await Media.find({
      owner: req.user.id,
      isPrivate: true,
      status: 'uploaded',
      folder: null,
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } },
      ],
    })
      .select(
        '_id fileName contentType size objectKey thumbnailObjectKey width height createdAt'
      )
      .sort({ createdAt: -1 })
      .lean()

    const mediaWithUrls = await Promise.all(
      media.map(async (item) => {
        let thumbnailUrl = null

        if (item.thumbnailObjectKey) {
          thumbnailUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({
              Bucket: process.env.AWS_S3_BUCKET,
              Key: item.thumbnailObjectKey,
            }),
            { expiresIn: 60 * 5 }
          )
        }

        return {
          ...item,
          thumbnailUrl,
          url: null,
        }
      })
    )

    return res.json({ media: mediaWithUrls })
  } catch (error) {
    return next(error)
  }
}


export async function createPrivateUploadUrl(req, res, next) {
  try {
    const { fileName, contentType, size } = req.body

    if (!fileName || !contentType || !size) {
      return res.status(400).json({
        message: 'fileName, contentType and size are required.',
      })
    }

    if (isBlockedFile(fileName)) {
      return res.status(400).json({
        message: 'This file type is not allowed.',
      })
    }

    if (!Number.isSafeInteger(size) || size <= 0) {
      return res.status(400).json({
        message: 'Invalid file size.',
      })
    }

    const mediaId = new mongoose.Types.ObjectId()

    const objectKey =
      `users/${req.user.id}/private-album/${mediaId}/original`

    const media = await Media.create({
      _id: mediaId,
      owner: req.user.id,
      folder: null,
      fileName,
      objectKey,
      contentType,
      size,
      isPrivate: true,
      status: 'pending',
    })

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: size,
    })

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 5,
    })

    return res.status(201).json({
      mediaId: media._id,
      uploadUrl,
      objectKey,
    })
  } catch (error) {
    return next(error)
  }
}


export async function completePrivateUpload(req, res, next) {
  try {
    const { mediaId } = req.params

    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return res.status(400).json({ message: 'Invalid media id.' })
    }

    const media = await Media.findOne({
      _id: mediaId,
      owner: req.user.id,
      folder: null,
      isPrivate: true,
    })

    if (!media) {
      return res.status(404).json({ message: 'Private media not found.' })
    }

    if (media.status !== 'uploaded') {
      const head = await s3.send(
        new HeadObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: media.objectKey,
        })
      )

      if (head.ContentLength !== media.size) {
        return res.status(400).json({
          message: 'Uploaded file size does not match.',
        })
      }

      if (head.ContentType && head.ContentType !== media.contentType) {
        return res.status(400).json({
          message: 'Uploaded file type does not match.',
        })
      }

      media.status = 'uploaded'
      await media.save()
    }

    res.json({ media: media.toJSON() })

    if (
      (isImageMedia(media) || isVideoMedia(media)) &&
      !media.thumbnailObjectKey
    ) {
      setImmediate(async () => {
        try {
          const thumbnail = await generateThumbnail(media)
          if (!thumbnail) return

          await Media.updateOne(
            {
              _id: media._id,
              owner: media.owner,
              isPrivate: true,
              thumbnailObjectKey: null,
            },
            {
              $set: {
                thumbnailObjectKey: thumbnail.thumbnailObjectKey,
                thumbnailContentType: thumbnail.thumbnailContentType,
                thumbnailSize: thumbnail.thumbnailSize,
                width: thumbnail.width,
                height: thumbnail.height,
              },
            }
          )
        } catch (error) {
          console.error('[PRIVATE THUMBNAIL FAILED]', error)
        }
      })
    }
  } catch (error) {
    return next(error)
  }
}

export async function getPrivateOriginalUrl(req, res, next) {
  try {
    const { mediaId } = req.params

    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return res.status(400).json({ message: 'Invalid media id.' })
    }

    const media = await Media.findOne({
      _id: mediaId,
      owner: req.user.id,
      folder: null,
      isPrivate: true,
      status: 'uploaded',
    }).select('objectKey fileName')

    if (!media) {
      return res.status(404).json({
        message: 'Private media not found.',
      })
    }

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: media.objectKey,
        ResponseContentDisposition: `attachment; filename="${String(
          media.fileName || 'download'
        ).replace(/["\r\n]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(
          media.fileName || 'download'
        )}`,
      }),
      { expiresIn: 60 * 5 }
    )

    return res.json({ url })
  } catch (error) {
    return next(error)
  }
}

export async function getPrivateThumbnailUrl(req, res, next) {
  try {
    const { mediaId } = req.params

    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return res.status(400).json({ message: 'Invalid media id.' })
    }

    const media = await Media.findOne({
      _id: mediaId,
      owner: req.user.id,
      folder: null,
      isPrivate: true,
      status: 'uploaded',
    }).select('thumbnailObjectKey')

    if (!media) {
      return res.status(404).json({
        message: 'Private media not found.',
      })
    }

    if (!media.thumbnailObjectKey) {
      return res.status(404).json({
        message: 'Thumbnail is not available yet.',
      })
    }

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: media.thumbnailObjectKey,
      }),
      { expiresIn: 60 * 5 }
    )

    return res.json({ url })
  } catch (error) {
    return next(error)
  }
}

export async function deletePrivateMedia(req, res, next) {
  try {
    const { mediaId } = req.params

    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return res.status(400).json({ message: 'Invalid media id.' })
    }

    const media = await Media.findOne({
      _id: mediaId,
      owner: req.user.id,
      folder: null,
      isPrivate: true,
      status: 'uploaded',
    })

    if (!media) {
      return res.status(404).json({
        message: 'Private media not found.',
      })
    }

    const bucket = process.env.AWS_S3_BUCKET

    if (!bucket) {
      throw new Error('AWS_S3_BUCKET is not configured.')
    }

    const objectsToDelete = [
      media.objectKey,
      media.thumbnailObjectKey,
    ].filter(Boolean)

    await Promise.all(
      objectsToDelete.map((key) =>
        s3.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        )
      )
    )

    await Media.deleteOne({
      _id: media._id,
      owner: req.user.id,
      isPrivate: true,
    })

    return res.json({
      message: 'Private media deleted successfully.',
      mediaId: media._id,
    })
  } catch (error) {
    return next(error)
  }
}