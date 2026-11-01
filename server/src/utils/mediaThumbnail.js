
import sharp from 'sharp';
import {
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import { s3 } from '../config/s3.js';

const BUCKET = process.env.AWS_S3_BUCKET;

const THUMBNAIL_WIDTH = 480;
const THUMBNAIL_HEIGHT = 480;
const THUMBNAIL_QUALITY = 75;

const SUPPORTED_FORMATS = new Set([
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'tiff',
]);

export async function generateThumbnail(media) {
  if (!media.contentType?.startsWith('image/')) {
    return null;
  }

  // Avoid processing SVG and unsupported image formats.
  const original = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: media.objectKey,
    }),
  );

  if (!original.Body) {
    throw new Error('Original image body is empty.');
  }

  const originalBuffer = Buffer.from(
    await original.Body.transformToByteArray(),
  );

  const image = sharp(originalBuffer, {
    limitInputPixels: 40000000,
  });

  const metadata = await image.metadata();

  if (!SUPPORTED_FORMATS.has(metadata.format)) {
    return null;
  }

  const { data, info } = await image
    .rotate()
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality: THUMBNAIL_QUALITY,
      effort: 4,
    })
    .toBuffer({ resolveWithObject: true });

  const thumbnailObjectKey =
    `users/${media.owner}/media/${media._id}/thumbnail.webp`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: thumbnailObjectKey,
      Body: data,
      ContentType: 'image/webp',
      ContentLength: data.length,
      CacheControl: 'private, max-age=86400',
    }),
  );

  return {
    thumbnailObjectKey,
    thumbnailContentType: 'image/webp',
    thumbnailSize: data.length,
    width: metadata.width,
    height: metadata.height,
    thumbnailWidth: info.width,
    thumbnailHeight: info.height,
  };
}
