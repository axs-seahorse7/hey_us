
import sharp from 'sharp';
import { extractThumbnail } from 'extract-raw-preview';

import {
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

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

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.avi',
  '.mkv',
]);

export function isVideoMedia(media) {
  const extension = getExtension(media.fileName);

  return (
    VIDEO_EXTENSIONS.has(extension) ||
    media.contentType?.startsWith('video/')
  );
}

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

async function extractVideoFrame(inputPath, timestamp = '1') {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, [
      '-hide_banner',
      '-loglevel', 'error',
      '-ss', timestamp,
      '-i', inputPath,
      '-frames:v', '1',
      '-vf', 'scale=480:480:force_original_aspect_ratio=decrease',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      'pipe:1',
    ]);

    const chunks = [];
    let errorOutput = '';

    process.stdout.on('data', (chunk) => chunks.push(chunk));

    process.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
      errorOutput = errorOutput.slice(-4000);
    });

    process.on('error', reject);

    process.on('close', (code) => {
      const buffer = Buffer.concat(chunks);

      if (code !== 0 || !buffer.length) {
        reject(new Error(
          `FFmpeg frame extraction failed: ${errorOutput || `Exit code ${code}`}`
        ));
        return;
      }

      resolve(buffer);
    });
  });
}

async function generateVideoThumbnail(media) {
  const tempDir = await mkdtemp(
    path.join(tmpdir(), 'dear-us-video-')
  );

  const inputPath = path.join(tempDir, 'original-video');

  try {
    const original = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: media.objectKey,
      }),
    );

    if (!original.Body) {
      throw new Error('Original video body is empty.');
    }

    // Stream S3 into a temporary file instead of loading
    // the entire video into application memory.
    await pipeline(
      original.Body,
      createWriteStream(inputPath),
    );

    let frame;

    try {
      frame = await extractVideoFrame(inputPath, '1');
    } catch {
      // Short videos may not have a frame at one second.
      frame = await extractVideoFrame(inputPath, '0');
    }

    const { data, info } = await sharp(frame)
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

    console.log(`[VIDEO THUMBNAIL READY] ${media.fileName}`);

    return {
      thumbnailObjectKey,
      thumbnailContentType: 'image/webp',
      thumbnailSize: data.length,
      width: info.width,
      height: info.height,
      thumbnailWidth: info.width,
      thumbnailHeight: info.height,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function generateThumbnail(media) {
  if (isVideoMedia(media)) {
    return generateVideoThumbnail(media);
  }

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
