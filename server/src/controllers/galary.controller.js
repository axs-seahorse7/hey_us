import crypto from 'crypto';
import mongoose from 'mongoose';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { s3 } from '../config/s3.js';
import { Media } from '../models/Media.js';

export const getAllMedia = async (req, res) => {
  try {
    const media = await Media.find({
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

    res.json({
      media: mediaWithUrls,
    });
  } catch (error) {
    console.error('Failed to get all media:', error);
    res.status(500).json({
      message: 'Unable to load gallery media.',
    });
  }
};

export const createUploadUrl = async (req, res) => {

    console.log("REQ USER",req.user)
  const { fileName, contentType, size, folderId } = req.body;

  const mediaId = new mongoose.Types.ObjectId();
  const objectKey = `users/${req.user.id}/media/${mediaId}/original`;


  const media = await Media.create({
    _id: mediaId,
    owner: req.user.id,
    folder: folderId,
    fileName,
    objectKey,
    contentType,
    size,
    status: 'pending',
  });

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: 60 * 5,
  });

  res.json({
    mediaId: media._id,
    uploadUrl,
    objectKey,
  });
};