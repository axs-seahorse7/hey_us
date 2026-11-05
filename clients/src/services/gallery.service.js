import api from './api.js';
import { completeUpload } from './media.service.js';
import { isBlockedFile } from '../utils/fileValidation.js';

export const uploadFile = async (file, folderId) => {
  if (isBlockedFile(file.name)) {
    throw new Error('This file type is not allowed.');
  }

  const contentType = file.type || 'application/octet-stream';

  const start = performance.now();

  const logTime = (step) => {
    console.log(
      `[UPLOAD TIMING] ${step}: ${(
        performance.now() - start
      ).toFixed(0)} ms`
    );
  };

  const response = await api.post('/gallery/upload-url', {
    fileName: file.name,
    contentType,
    size: file.size,
    folderId,
  });

  logTime('Upload URL generated');

  const { uploadUrl, mediaId } = response.data;

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file to S3');
  }

  logTime('Original uploaded to S3');

  await completeUpload(mediaId);

  logTime('Complete API finished');

  return { mediaId };
};

export const getFavoriteMedia = async () => {
  try {
    const firstResponse = await api.get('/gallery', {
      params: { favorite: true, page: 1 },
    })

    const { media = [], pagination } = firstResponse.data
    const allMedia = [...media]

    for (let page = 2; page <= pagination.totalPages; page++) {
      const response = await api.get('/gallery', {
        params: { favorite: true, page },
      })

      allMedia.push(...(response.data.media || []))
    }

    return allMedia
  } catch (error) {
    console.error('getFavoriteMedia error:', error)
    throw error
  }
}