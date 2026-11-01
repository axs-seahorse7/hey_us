import api from './api.js';

export async function createUploadUrl({
  fileName,
  contentType,
  size,
  folderId,
}) {
  try {
    const response = await api.post(
      '/media/upload-url',
      {
        fileName,
        contentType,
        size,
        folderId,
      },
    );

    return response.data;
  } catch (error) {
    console.error(
      'createUploadUrl error:',
      error,
    );

    throw error;
  }
}

export async function uploadFileToS3(uploadUrl, file) {
  try {
    const response = await fetch(
      uploadUrl,
      {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      },
    );

    if (!response.ok) {
      throw new Error(
        `S3 upload failed with status ${response.status}.`,
      );
    }

    return true;
  } catch (error) {
    console.error(
      'uploadFileToS3 error:',
      error,
    );

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