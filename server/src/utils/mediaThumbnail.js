
import sharp from 'sharp';
import { extractThumbnail } from 'extract-raw-preview';

import {
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import { s3 } from '../config/s3.js';

const BUCKET = process.env.AWS_S3_BUCKET;

const THUMBNAIL_WIDTH = 480;
const THUMBNAIL_HEIGHT = 480;
const THUMBNAIL_QUALITY = 75;

const MAX_INPUT_PIXELS = 40000000;
const MAX_RAW_PREVIEW_BYTES = 25 * 1024 * 1024;

const SUPPORTED_FORMATS = new Set([
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'tiff',
  'heif',
]);

const RAW_EXTENSIONS = new Set([
  '.arw',
  '.cr2',
  '.cr3',
  '.nef',
  '.dng',
  '.raf',
  '.orf',
  '.rw2',
  '.pef',
]);

function getExtension(fileName = '') {
  const lastDot = fileName.lastIndexOf('.');

  return lastDot >= 0
    ? fileName.slice(lastDot).toLowerCase()
    : '';
}

export function isImageMedia(media) {
  const extension = getExtension(media.fileName);

  return (
    media.contentType?.startsWith('image/') ||
    RAW_EXTENSIONS.has(extension)
  );
}

async function getImageBuffer(originalBuffer, media) {
  const extension = getExtension(media.fileName);

  // RAW files need their embedded preview extracted first.
  if (RAW_EXTENSIONS.has(extension)) {
    console.log(`[THUMBNAIL] Extracting RAW preview: ${media.fileName}`);

    const result = await extractThumbnail(originalBuffer, {
      maxBytes: MAX_RAW_PREVIEW_BYTES,
      prefer: 'largest',
    });

    if (!result.found) {
      console.warn(
        `[THUMBNAIL] No usable RAW preview found: ${result.reason}`,
      );

      return null;
    }

    if (!result.decodable) {
      console.warn('[THUMBNAIL] RAW preview is not decodable.');

      return null;
    }

    console.log(
      `[THUMBNAIL] RAW preview extracted: ${result.width}x${result.height}`,
    );

    return Buffer.from(result.data);
  }

  return originalBuffer;
}

export async function generateThumbnail(media) {
  if (!isImageMedia(media)) {
    return null;
  }

  if (!BUCKET) {
    throw new Error('AWS_S3_BUCKET is not configured.');
  }

  // Download the original without modifying it.
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

  // Extract an embedded preview for RAW images.
  const inputBuffer = await getImageBuffer(
    originalBuffer,
    media,
  );

  if (!inputBuffer) {
    return null;
  }

  // Sharp handles standard images and extracted RAW previews.
  const image = sharp(inputBuffer, {
    limitInputPixels: MAX_INPUT_PIXELS,
  });

  const metadata = await image.metadata();

  if (!SUPPORTED_FORMATS.has(metadata.format)) {
    console.warn(
      `[THUMBNAIL] Unsupported image format: ${metadata.format}`,
    );

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

  console.log(
    `[THUMBNAIL] Generated successfully: ${media.fileName}`,
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
