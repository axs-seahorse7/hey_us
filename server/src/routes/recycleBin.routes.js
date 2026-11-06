
import express from 'express';

import {
  getRecycleBin,
  restoreMedia,
  permanentlyDeleteMedia,
  emptyRecycleBin,
  getRecycleBinOriginalUrl,
} from '../controllers/recycleBin.controller.js';

import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

router.get('/', authenticate, getRecycleBin);
router.patch('/:mediaId/restore', authenticate, restoreMedia);
router.get('/:mediaId/original-url', authenticate, getRecycleBinOriginalUrl);
router.delete('/:mediaId', authenticate, permanentlyDeleteMedia);
router.delete('/', authenticate, emptyRecycleBin);

export default router;
