import api from './api.js';
import { completeUpload } from './media.service.js';

export const uploadFile = async (file, folderId) => {
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
    contentType: file.type,
    size: file.size,
    folderId,
  });

  logTime('Upload URL generated');

  const { uploadUrl, mediaId } = response.data;

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
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