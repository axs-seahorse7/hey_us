
import { createUserRateLimiter } from './rateLimiter.js'

export const privateAlbumUnlockLimiter = createUserRateLimiter({
  service: 'private-album-unlock',
  windowMs: 5 * 60 * 1000,
  limit: 500,
  message: 'Too many unlock attempts. Try again after 5 minutes.',
})

export const uploadLimiter = createUserRateLimiter({
  service: 'upload',
  windowMs: 60 * 1000,
  limit: 30,
  message: 'Upload request limit exceeded. Try again shortly.',
})
