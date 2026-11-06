import api from './api';
import axios from 'axios';

const privateRequest = (config = {}, token) => {
  if (!token) {
    throw new Error('Private Album is locked. Unlock it first.');
  }

  return api({
    ...config,
    headers: {
      ...config.headers,
      'x-private-album-token': token,
    },
  });
};

export async function getPrivateAlbumStatus() {
  const response = await api.get('/private-album/status');
  return response.data;
}

export async function setupPrivateAlbum(payload) {
  const response = await api.post('/private-album/setup', payload);
  return response.data;
}

export async function unlockPrivateAlbum(payload) {
  const response = await api.post('/private-album/unlock', payload);
  return response.data;
}

export async function getPrivateMedia(token) {
  const response = await privateRequest({
    method: 'GET',
    url: '/private-album/media',
  }, token);

  return response.data.media || [];
}

export async function createPrivateUploadUrl(payload, token) {
  const response = await privateRequest({
    method: 'POST',
    url: '/private-album/upload-url',
    data: payload,
  }, token);

  return response.data;
}

export async function completePrivateUpload(mediaId, token) {
  const response = await privateRequest({
    method: 'POST',
    url: `/private-album/${mediaId}/complete`,
  }, token);

  return response.data;
}

export async function getPrivateOriginalUrl(mediaId, token) {
  const response = await privateRequest({
    method: 'GET',
    url: `/private-album/media/${mediaId}/original-url`,
  }, token);

  return response.data;
}

export async function getPrivateThumbnailUrl(mediaId, token) {
  const response = await privateRequest({
    method: 'GET',
    url: `/private-album/media/${mediaId}/thumbnail-url`,
  }, token);

  return response.data;
}

export async function deletePrivateMedia(mediaId, token) {
  const response = await privateRequest({
    method: 'DELETE',
    url: `/private-album/media/${mediaId}`,
  }, token);

  return response.data;
}


export async function uploadPrivateFile(file, token) {
  // Step 1: Request a private S3 upload URL.
  const uploadData = await createPrivateUploadUrl(
    {
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    },
    token,
  );

  const { mediaId, uploadUrl } = uploadData;

  if (!mediaId || !uploadUrl) {
    throw new Error('Invalid private upload URL response.');
  }

  // Step 2: Upload directly to S3.
  await axios.put(uploadUrl, file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    withCredentials: false,
  });

  // Step 3: Tell the backend the upload is complete.
  await completePrivateUpload(mediaId, token);

  return { mediaId };
}