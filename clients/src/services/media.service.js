import api from './api.js';
import {isBlockedFile} from '../utils/fileValidation.js';

export async function createUploadUrl({ fileName, contentType, size, folderId}) {
  try {
    if (isBlockedFile(fileName)) {
      throw new Error('This file type is not allowed.');
    }

    const response = await api.post('/media/upload-url', {
      fileName,
      contentType: contentType || 'application/octet-stream',
      size,
      folderId,
    });

    return response.data;
  } catch (error) {
    console.error('createUploadUrl error:', error);
    throw error;
  }
}

export async function uploadFileToS3(uploadUrl, file) {
  try {
    const contentType = file.type || 'application/octet-stream';

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(
        `S3 upload failed with status ${response.status}.`
      );
    }

    return true;
  } catch (error) {
    console.error('uploadFileToS3 error:', error);
    throw new Error(`S3 Upload failed: ${error.message}`);
  }
}

export async function completeUpload(mediaId) {
  try {
    const response = await api.post(
      `/media/${mediaId}/complete`,
      {},
    );

    return response.data;
  } catch (error) {
    console.error(
      'completeUpload error:',
      error,
    );

    throw error;
  }
}

export async function getMedia(mediaId) {
  try {
    const response = await api.get(
      `/media/${mediaId}`
    );

    return response.data;
  } catch (error) {
    console.error('getMedia error:', error);
    throw error;
  }
}

export async function getFolderMedia(folderId) {
  try {
    const response = await api.get(`/media/folders/${folderId}/media`);
    return response.data;
  } catch (error) {
    console.error('getFolderMedia error:', error);
    throw error;
  }
}

export async function deleteMedia(mediaId) {
  try {
    const response = await api.delete(`/media/${mediaId}`)
    return response.data
  } catch (error) {
    console.error('deleteMedia error:', error)
    throw error
  }
}

// Fetches a fresh signed URL for the full-resolution original of a media item.
// Called on-demand by the viewer when a slide becomes active.
export async function getOriginalUrl(mediaId) {
  try {
    const response = await api.get(`/media/${mediaId}/original-url`)
    return response.data.url
  } catch (error) {
    console.error('getOriginalUrl error:', error)
    throw error
  }
}

// Fetches a fresh signed URL for a media thumbnail.
export async function getThumbnailUrl(mediaId) {
  try {
    const response = await api.get(
      `/media/${mediaId}/thumbnail-url`
    );

    return response.data.url;
  } catch (error) {
    console.error('getThumbnailUrl error:', error);
    throw error;
  }
}

export async function toggleFavorite(mediaId) {
  try {
    const response = await api.patch(`/media/${mediaId}/favorite`);
    return response.data;
  } catch (error) {
    console.error('toggleFavorite error:', error);
    throw error;
  }
}


export async function getRecycleBin() {
  const response = await api.get('/recycle-bin');
  return response.data.media;
}

export async function restoreMedia(mediaId) {
  const response = await api.patch(`/recycle-bin/${mediaId}/restore`);
  return response.data;
}

export async function permanentlyDeleteMedia(mediaId) {
  const response = await api.delete(`/recycle-bin/${mediaId}`);
  return response.data;
}

export async function emptyRecycleBin() {
  const response = await api.delete('/recycle-bin');
  return response.data;
}

export async function getRecycleBinOriginalUrl(mediaId) {
  const response = await api.get(
    `/recycle-bin/${mediaId}/original-url`
  );

  return response.data.url;
}