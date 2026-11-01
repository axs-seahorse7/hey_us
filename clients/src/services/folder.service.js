import api from './api.js';

export async function getFolders() {
  try {
    const response = await api.get('/folders');

    return response.data;
  } catch (error) {
    console.error('getFolders error:', error);

    throw new Error(
      error.response?.data?.message ||
        error.message ||
        'Failed to fetch folders.',
    );
  }
}

export async function createFolder(name) {
  try {
    const response = await api.post('/folders', { name })
    return response.data
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.message ||
      'Failed to create folder.'

    throw new Error(message)
  }
}

export async function updateFolder(folderId, name) {
  try {
    const response = await api.patch(`/folders/${folderId}`, {
      name,
    });

    return response.data;
  } catch (error) {
    console.error('updateFolder error:', error);

    throw new Error(
      error.response?.data?.message ||
        error.message ||
        'Failed to update folder.',
    );
  }
}

export async function deleteFolder(folderId) {
  try {
    await api.delete(`/folders/${folderId}`);

    return true;
  } catch (error) {
    console.error('deleteFolder error:', error);

    throw new Error(
      error.response?.data?.message ||
        error.message ||
        'Failed to delete folder.',
    );
  }
}