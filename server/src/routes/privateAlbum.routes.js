import { Router } from 'express'

import {
  getPrivateAlbumStatus,
  setupPrivateAlbum,
  unlockPrivateAlbum,
  getPrivateAlbumMedia,
  createPrivateUploadUrl,
  completePrivateUpload,
  getPrivateOriginalUrl,
  getPrivateThumbnailUrl,
  deletePrivateMedia,
} from '../controllers/privateAlbum.controller.js'
import { privateAlbumUnlockLimiter } from '../middleware/serviceLimits.js'


import { authenticate } from '../middleware/authenticate.js'
import { requirePrivateAlbum } from '../middleware/requirePrivateAlbum.js'

const router = Router()

router.get('/status', authenticate, getPrivateAlbumStatus)
router.post('/setup', authenticate, setupPrivateAlbum)
router.post('/unlock', authenticate, privateAlbumUnlockLimiter, unlockPrivateAlbum)

router.get('/media', authenticate, requirePrivateAlbum, getPrivateAlbumMedia)

router.post('/upload-url', authenticate, requirePrivateAlbum, createPrivateUploadUrl)
router.post('/:mediaId/complete', authenticate, requirePrivateAlbum, completePrivateUpload)

router.get('/media/:mediaId/original-url', authenticate, requirePrivateAlbum, getPrivateOriginalUrl)
router.get('/media/:mediaId/thumbnail-url', authenticate, requirePrivateAlbum, getPrivateThumbnailUrl)
router.delete('/media/:mediaId', authenticate, requirePrivateAlbum, deletePrivateMedia)

export default router