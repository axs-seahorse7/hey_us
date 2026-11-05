
import mongoose from 'mongoose';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { isBlockedFile } from '../utils/fileValidation.js';

import { s3 } from '../config/s3.js';
import { Media } from '../models/Media.js';
import { Folder } from '../models/Folder.js';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 60;
const URL_EXPIRY = 60 * 10;

export const getAllMedia = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const requestedLimit =
      Number.parseInt(req.query.limit, 10) || DEFAULT_LIMIT;

    const limit = Math.min(Math.max(1, requestedLimit), MAX_LIMIT);
    const skip = (page - 1) * limit;

    const filter = {
      owner: req.user.id,
      status: 'uploaded',
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };

    if (req.query.favorite === 'true') {
      filter.isFavorite = true
    }

    const [media, total] = await Promise.all([
      Media.find(filter)
        .select(
          '_id fileName contentType size objectKey thumbnailObjectKey createdAt width height isFavorite'
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Media.countDocuments(filter),
    ]);

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
          isFavorite: item.isFavorite ?? false,
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
      media: mediaWithUrls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + media.length < total,
      },
    });
  } catch (error) {
    console.error('Failed to get all media:', error);

    return res.status(500).json({
      message: 'Unable to load gallery media.',
    });
  }
};

export const createUploadUrl = async (req, res, next) => {
  try {
    const { fileName, contentType, size, folderId } = req.body;

    if (isBlockedFile(fileName)) {
      return res.status(400).json({
        message: 'This file type is not allowed.',
      });
    }

    // Validate common upload fields
    if (
      typeof fileName !== 'string' ||
      !fileName.trim() ||
      typeof contentType !== 'string' ||
      !contentType.trim() ||
      !Number.isFinite(size) ||
      size <= 0
    ) {
      return res.status(400).json({
        message: 'Invalid upload details.',
      });
    }

    // Folder is optional for global Gallery uploads
    let folder = null;

    if (folderId) {
      if (!mongoose.Types.ObjectId.isValid(folderId)) {
        return res.status(400).json({
          message: 'Invalid folder id.',
        });
      }

      folder = await Folder.findOne({
        _id: folderId,
        owner: req.user.id,
      });

      if (!folder) {
        return res.status(404).json({
          message: 'Folder not found.',
        });
      }
    }

    const mediaId = new mongoose.Types.ObjectId();

    const objectKey = `users/${req.user.id}/media/${mediaId}/original`;

    // Create pending media record
    const media = await Media.create({
      _id: mediaId,
      owner: req.user.id,
      folder: folder?._id ?? null,
      fileName: fileName.trim(),
      objectKey,
      contentType,
      size,
      status: 'pending',
    });

    // Generate S3 presigned upload URL
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 5,
    });

    return res.status(201).json({
      mediaId: media._id,
      uploadUrl,
      objectKey,
    });
  } catch (error) {
    console.error('Create upload URL error:', error);
    return next(error);
  }
};
