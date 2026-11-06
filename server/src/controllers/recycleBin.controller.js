
import mongoose from 'mongoose';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { Media } from '../models/Media.js';
import { s3 } from '../config/s3.js';

// Get all deleted media belonging to the authenticated user.
export async function getRecycleBin(request, response, next) {
  try {
    const bucket = process.env.AWS_S3_BUCKET;

    if (!bucket) {
      throw new Error('AWS_S3_BUCKET is not configured.');
    }

    const media = await Media.find({
      owner: request.user.id,
      isPrivate: { $ne: true },
      deletedAt: { $ne: null },
      status: 'uploaded',
    })
      .select(
        '_id fileName contentType size folder thumbnailObjectKey width height createdAt deletedAt'
      )
      .sort({ deletedAt: -1 })
      .lean();

    const mediaWithThumbnails = await Promise.all(
      media.map(async (item) => {
        let thumbnailUrl = null;

        if (item.thumbnailObjectKey) {
          thumbnailUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({
              Bucket: bucket,
              Key: item.thumbnailObjectKey,
            }),
            { expiresIn: 60 * 10 },
          );
        }

        return {
          ...item,
          thumbnailUrl,
        };
      }),
    );

    return response.json({
      media: mediaWithThumbnails,
    });
  } catch (error) {
    return next(error);
  }
}


export async function getRecycleBinOriginalUrl(request, response, next) {
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
      isPrivate: { $ne: true },
      deletedAt: { $ne: null },
    }).select('objectKey fileName');

    if (!media) {
      return response.status(404).json({
        message: 'Deleted media not found.',
      });
    }

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: media.objectKey,
        ResponseContentDisposition: `inline; filename="${String(media.fileName || 'media').replace(/["\r\n]/g, '_')}"`,
      }),
      { expiresIn: 60 * 10 },
    );

    return response.json({ url });
  } catch (error) {
    return next(error);
  }
}


// Restore media to its original folder.
export async function restoreMedia(request, response, next) {
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
        isPrivate: { $ne: true },
        deletedAt: { $ne: null },
        status: 'uploaded',
      },
      {
        $set: { deletedAt: null },
      },
      { new: true }
    );

    if (!media) {
      return response.status(404).json({
        message: 'Deleted media not found.',
      });
    }

    return response.json({
      message: 'Media restored successfully.',
      mediaId: media._id,
      folderId: media.folder,
    });
  } catch (error) {
    return next(error);
  }
}

// Permanently delete one item from the Recycle Bin.
export async function permanentlyDeleteMedia(request, response, next) {
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
      deletedAt: { $ne: null },
    });

    if (!media) {
      return response.status(404).json({
        message: 'Deleted media not found.',
      });
    }

    const bucket = process.env.AWS_S3_BUCKET;

    if (!bucket) {
      throw new Error('AWS_S3_BUCKET is not configured.');
    }

    const objectsToDelete = [
      media.objectKey,
      media.thumbnailObjectKey,
    ].filter(Boolean);

    await Promise.all(
      objectsToDelete.map((key) =>
        s3.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        )
      )
    );

    await Media.deleteOne({
      _id: media._id,
      owner: request.user.id,
      deletedAt: { $ne: null },
    });

    return response.json({
      message: 'Media permanently deleted.',
      mediaId: media._id,
    });
  } catch (error) {
    return next(error);
  }
}

// Empty the authenticated user's Recycle Bin.
export async function emptyRecycleBin(request, response, next) {
  try {
    const bucket = process.env.AWS_S3_BUCKET;

    if (!bucket) {
      throw new Error('AWS_S3_BUCKET is not configured.');
    }

    const media = await Media.find({
      owner: request.user.id,
      isPrivate: { $ne: true },
      deletedAt: { $ne: null },
    }).select('_id objectKey thumbnailObjectKey');

    if (media.length === 0) {
      return response.json({
        message: 'Recycle Bin is already empty.',
        deletedCount: 0,
      });
    }

    const objectsToDelete = media.flatMap((item) =>
      [item.objectKey, item.thumbnailObjectKey].filter(Boolean)
    );

    await Promise.all(
      objectsToDelete.map((key) =>
        s3.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        )
      )
    );

    const result = await Media.deleteMany({
      _id: { $in: media.map((item) => item._id) },
      owner: request.user.id,
      isPrivate: { $ne: true },
      deletedAt: { $ne: null },
    });

    return response.json({
      message: 'Recycle Bin emptied successfully.',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return next(error);
  }
}
