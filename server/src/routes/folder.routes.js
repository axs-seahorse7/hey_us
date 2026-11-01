import { Router } from 'express';
import {
  createFolder,
  deleteFolder,
  listFolders,
  updateFolder,
} from '../controllers/folder.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);
router.get('/', listFolders);
router.post('/', createFolder);
router.patch('/:folderId', updateFolder);
router.delete('/:folderId', deleteFolder);

export default router;
