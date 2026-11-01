import express from 'express';
import { createUploadUrl, getAllMedia } from '../controllers/galary.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

router.get('/', authenticate, getAllMedia);
router.post('/upload-url', authenticate, createUploadUrl);

export default router;