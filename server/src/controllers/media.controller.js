import mongoose from 'mongoose';

import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

import { generateThumbnail } from '../utils/mediaThumbnail.js';
import {getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
      status: 'completed',
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
    });

    if (!media) {
      return response.status(404).json({
        message: 'Media not found.',
      });
    }

    // Make completion idempotent.
    if (media.status === 'uploaded') {
      return response.json({
        media: media.toJSON(),
      });
    }

    // Verify that the original object really exists in S3.
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

    if (
      head.ContentType &&
      head.ContentType !== media.contentType
    ) {
      return response.status(400).json({
        message: 'Uploaded file type does not match.',
      });
    }

    // Generate a thumbnail for supported raster images.
    if (media.contentType.startsWith('image/')) {
      const thumbnail = await generateThumbnail(media);

      if (thumbnail) {
        media.thumbnailObjectKey = thumbnail.thumbnailObjectKey;
        media.thumbnailContentType = thumbnail.thumbnailContentType;
        media.thumbnailSize = thumbnail.thumbnailSize;
        media.width = thumbnail.width;
        media.height = thumbnail.height;
      }
    }

    media.status = 'uploaded';

    await media.save();

    return response.json({
      media: media.toJSON(),
    });
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
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }).sort({ createdAt: -1 });

    const mediaWithUrls = await Promise.all(
      media.map(async (item) => {
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: item.objectKey,
        });

        const url = await getSignedUrl(s3, command, {
          expiresIn: 60 * 10, // 10 minutes
        });

        return {
          _id: item._id,
          fileName: item.fileName,
          contentType: item.contentType,
          size: item.size,
          objectKey: item.objectKey,
          url,
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

export async function deleteMedia(request, response, next) {
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
      status: 'uploaded',
    });

    if (!media) {
      return response.status(404).json({
        message: 'Media not found.',
      });
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: media.objectKey,
    });

    await s3.send(command);

    await Media.deleteOne({
      _id: media._id,
      owner: request.user.id,
    });

    return response.json({
      message: 'Media deleted successfully.',
      mediaId: media._id,
    });
  } catch (error) {
    console.error('deleteMedia error:', error);
    return next(error);
  }
}