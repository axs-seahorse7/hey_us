import api from './api.js';
import { completeUpload } from './media.service.js';

export const uploadFile = async (file, folderId) => {
  // 1. Ask our backend for a presigned URL
  const response = await api.post('/gallery/upload-url', {
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    folderId,
  });

  const { uploadUrl, mediaId } = response.data;

  // 2. Upload the actual file directly to S3
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file to S3');
  }

  // 3. Mark as complete in the database
  await completeUpload(mediaId);

  return {
    mediaId,
  };
};