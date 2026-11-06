import mongoose from 'mongoose';

import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

import { generateThumbnail, isImageMedia, isVideoMedia } from '../utils/mediaThumbnail.js';
import {getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { isBlockedFile } from '../utils/fileValidation.js';

import { s3 } from '../config/s3.js';
import { Media } from '../models/Media.js';
import { Folder } from '../models/Folder.js';



export async function listFolderMedia(request, response, next) {
  try {
    const { folderId } = request.params;

    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      return response.status(400).json({
        message: 'Invalid folder id.',
      });
    }

    const folder = await Folder.findOne({
      _id: folderId,
      owner: request.user.id,
    });

    if (!folder) {
      return response.status(404).json({
        message: 'Folder not found.',
      });
    }

    const media = await Media.find({
        owner: request.user.id,
        folder: folder._id,
        status: 'uploaded',
        isPrivate: { $ne: true },
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
    .sort({ createdAt: -1 })
    .lean();

    return response.json({
      folder: {
        id: folder._id,
        name: folder.name,
        kind: folder.kind,
        systemKey: folder.systemKey,
      },
      media,
    });
  } catch (error) {
    return next(error);
  }
}

export const getMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;

   const media = await Media.findOne({
      _id: mediaId,
      owner: req.user.id,
      status: 'uploaded',
      isPrivate: { $ne: true },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!media) {
      return res.status(404).json({
        message: 'Media not found',
      });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: media.objectKey,
    });

    const url = await getSignedUrl(s3, command, {
      expiresIn: 60 * 10,
    });

    res.json({
      id: media._id,
      fileName: media.fileName,
      contentType: media.contentType,
      size: media.size,
      url,
    });
  } catch (error) {
    console.error('getMedia error:', error);

    res.status(500).json({
      message: 'Failed to get media',
    });
  }
};


export const toggleFavorite = async (req, res, next) => {
  try {
    const { mediaId } = req.params

    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return res.status(400).json({
        message: 'Invalid media id.',
      })
    }

    const media = await Media.findOne({
      _id: mediaId,
      owner: req.user.id,
      status: 'uploaded',
      isPrivate: { $ne: true },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })

    if (!media) {
      return res.status(404).json({
        message: 'Media not found.',
      })
    }

    media.isFavorite = !media.isFavorite
    await media.save()

    return res.json({
      message: media.isFavorite
        ? 'Added to favourites.'
        : 'Removed from favourites.',
      mediaId: media._id,
      isFavorite: media.isFavorite,
    })
  } catch (error) {
    return next(error)
  }
}

export async function createUploadUrl(request, response, next) {
  try {
    const {
      fileName,
      contentType,
      size,
      folderId,
    } = request.body;

    if (!fileName || !contentType || !size || !folderId) {
      return response.status(400).json({
        message: 'fileName, contentType, size and folderId are required.',
      });
    }

    if (isBlockedFile(fileName)) {
      return response.status(400).json({
        message: 'This file type is not allowed.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      return response.status(400).json({
        message: 'Invalid folder id.',
      });
    }

    if (!Number.isFinite(size) || size <= 0) {
      return response.status(400).json({
        message: 'Invalid file size.',
      });
    }

    /*
     * Make sure the folder belongs to the
     * currently authenticated user.
     */
    const folder = await Folder.findOne({
      _id: folderId,
      owner: request.user.id,
    });

    if (!folder) {
      return response.status(404).json({
        message: 'Folder not found.',
      });
    }

    const mediaId = new mongoose.Types.ObjectId();

    const objectKey = `users/${request.user.id}/media/${mediaId}/original`;

    /*
     * Create MongoDB metadata first.
     */
    const media = await Media.create({
      _id: mediaId,
      owner: request.user.id,
      folder: folder._id,
      fileName,
      objectKey,
      contentType,
      size,
      status: 'pending',
    });

    /*
     * Generate the presigned S3 PUT URL.
     */
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: size,
    });

    const uploadUrl = await getSignedUrl(
      s3,
      command,
      {
        expiresIn: 60 * 5,
      },
    );

    return response.status(201).json({
      mediaId: media._id,
      uploadUrl,
      objectKey,
    });
  } catch (error) {
    return next(error);
  }
}


export async function completeUpload(request, response, next) {
  try {
    const { mediaId } = request.params;

    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return response.status(400).json({
        message: 'Invalid media id.',
      });
    }

    const media = await Media.findOne({
      _id: mediaId,
      owner: request.user.id,
      isPrivate: { $ne: true },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    });

    if (!media) {
      return response.status(404).json({
        message: 'Media not found.',
      });
    }

    // Verify original only on first completion.
    if (media.status !== 'uploaded') {
      const head = await s3.send(
        new HeadObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: media.objectKey,
        }),
      );

      if (head.ContentLength !== media.size) {
        return response.status(400).json({
          message: 'Uploaded file size does not match.',
        });
      }

      if (head.ContentType && head.ContentType !== media.contentType) {
        return response.status(400).json({
          message: 'Uploaded file type does not match.',
        });
      }

      media.status = 'uploaded';
      await media.save();
    }

    // Return immediately. Thumbnail generation runs separately.
    response.json({
      media: media.toJSON(),
    });

    if ((isImageMedia(media) || isVideoMedia(media)) && !media.thumbnailObjectKey) {
      setImmediate(async () => {
        try {
          const thumbnail = await generateThumbnail(media);

          if (!thumbnail) return;

          await Media.updateOne(
            {
              _id: media._id,
              owner: media.owner,
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
            },
          );

          console.log(`[THUMBNAIL READY] ${media.fileName}`);
        } catch (error) {
          console.error(
            `[BACKGROUND THUMBNAIL FAILED] ${media.fileName}`,
            error,
          );
        }
      });
    }

  } catch (error) {
    console.error('completeUpload error:', error);
    return next(error);
  }
}


export const getFolderMedia = async (req, res) => {
  try {
    const { folderId } = req.params;

    const folder = await Folder.findOne({
      _id: folderId,
      owner: req.user.id,
    });

    if (!folder) {
      return res.status(404).json({
        message: 'Folder not found.',
      });
    }

    const media = await Media.find({
      folder: folder._id,
      owner: req.user.id,
      status: 'uploaded',
      isPrivate: { $ne: true },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
      .select(
        '_id fileName contentType size objectKey thumbnailObjectKey width height createdAt'
      )
      .sort({ createdAt: -1 })
      .lean();

    const URL_EXPIRY = 60 * 10;

    const mediaWithUrls = await Promise.all(
      media.map(async (item) => {
        let thumbnailUrl = null;

        if (item.thumbnailObjectKey) {
          thumbnailUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({
              Bucket: process.env.AWS_S3_BUCKET,
              Key: item.thumbnailObjectKey,
            }),
            { expiresIn: URL_EXPIRY }
          );
        }

        return {
          _id: item._id,
          fileName: item.fileName,
          contentType: item.contentType,
          size: item.size,
          objectKey: item.objectKey,
          thumbnailObjectKey: item.thumbnailObjectKey || null,
          thumbnailUrl,
          url: null,
          width: item.width,
          height: item.height,
          createdAt: item.createdAt,
        };
      })
    );

    return res.json({
      folder: {
        id: folder._id,
        name: folder.name,
      },
      media: mediaWithUrls,
    });
  } catch (error) {
    console.error('Failed to get folder media:', error);

    return res.status(500).json({
      message: 'Unable to load folder media.',
    });
  }
};

// Returns a fresh signed URL for a single media item's original file.
// Called by the viewer on-demand when the user opens a media item.
export const getOriginalUrl = async (req, res) => {
  try {
    const { mediaId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return res.status(400).json({ message: 'Invalid media id.' });
    }

    const media = await Media.findOne({
      _id: mediaId,
      owner: req.user.id,
      status: 'uploaded',
      isPrivate: { $ne: true },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }).select('objectKey fileName');

    if (!media) {
      return res.status(404).json({ message: 'Media not found.' });
    }

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: media.objectKey,
        ResponseContentDisposition: `attachment; filename="${String(media.fileName || 'download').replace(/["\r\n]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(media.fileName || 'download')}`,

      }),
      { expiresIn: 60 * 60 },
    );

    return res.json({ url });
  } catch (error) {
    console.error('getOriginalUrl error:', error);
    return res.status(500).json({ message: 'Failed to get original URL.' });
  }
};

// Returns a fresh signed URL for a media thumbnail.
export const getThumbnailUrl = async (req, res) => {
  try {
    const { mediaId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return res.status(400).json({
        message: 'Invalid media id.',
      });
    }

    const media = await Media.findOne({
      _id: mediaId,
      owner: req.user.id,
      status: 'uploaded',
      isPrivate: { $ne: true },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }).select('thumbnailObjectKey');

    if (!media) {
      return res.status(404).json({
        message: 'Media not found.',
      });
    }

    if (!media.thumbnailObjectKey) {
      return res.status(404).json({
        message: 'Thumbnail is not available yet.',
      });
    }

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: media.thumbnailObjectKey,
      }),
      { expiresIn: 60 * 10 },
    );

    return res.json({ url });
  } catch (error) {
    console.error('getThumbnailUrl error:', error);

    return res.status(500).json({
      message: 'Failed to generate thumbnail URL.',
    });
  }
};


export async function deleteMedia(request, response, next) {
  try {
    const { mediaId } = request.params;

    if (!mongoose.Types.ObjectId.isValid(mediaId)) {
      return response.status(400).json({
        message: 'Invalid media id.',
      });
    }

    const media = await Media.findOneAndUpdate(
      {
        _id: mediaId,
        owner: request.user.id,
        status: 'uploaded',
        isPrivate: { $ne: true },
        deletedAt: null,
      },
      {
        $set: {
          deletedAt: new Date(),
        },
      },
      {
        new: true,
      }
    );

    if (!media) {
      return response.status(404).json({
        message: 'Media not found.',
      });
    }

    return response.json({
      message: 'Media moved to Recycle Bin.',
      mediaId: media._id,
      deletedAt: media.deletedAt,
    });
  } catch (error) {
    console.error('Move media to Recycle Bin error:', error);
    return next(error);
  }
}



