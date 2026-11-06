import jwt from 'jsonwebtoken'

export function requirePrivateAlbum(req, res, next) {
  const token = req.headers['x-private-album-token']

  if (!token) {
    return res.status(401).json({
      message: 'Unlock Private Album first.',
    })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    if (
      payload.type !== 'private_album' ||
      String(payload.userId) !== String(req.user.id)
    ) {
      return res.status(403).json({
        message: 'Private Album access denied.',
      })
    }

    next()
  } catch {
    return res.status(401).json({
      message: 'Private Album session expired. Unlock it again.',
    })
  }
}