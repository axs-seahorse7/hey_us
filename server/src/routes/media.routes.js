import express from 'express';

import {
  listFolderMedia,
  createUploadUrl,
  completeUpload,
  getMedia,
  getFolderMedia,
  getOriginalUrl,
  deleteMedia,
} from '../controllers/media.controller.js';

import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

router.get('/folders/:folderId/media', authenticate, getFolderMedia);
router.get('/folders/:folderId', authenticate, listFolderMedia);

// Must come before /:mediaId to avoid being shadowed
router.get('/:mediaId/original-url', authenticate, getOriginalUrl);
router.get('/:mediaId', authenticate, getMedia);
router.delete('/:mediaId', authenticate, deleteMedia);

router.post('/:mediaId/complete', authenticate, completeUpload);
router.post('/upload-url', authenticate, createUploadUrl);

export default router;