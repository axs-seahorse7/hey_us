import express from 'express';
import { createUploadUrl, getAllMedia } from '../controllers/galary.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { uploadLimiter } from '../middleware/serviceLimits.js'


const router = express.Router();

router.get('/', authenticate, getAllMedia);
router.post('/upload-url', authenticate, uploadLimiter, createUploadUrl);

export default router;