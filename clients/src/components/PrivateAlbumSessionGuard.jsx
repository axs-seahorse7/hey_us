import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePrivateAlbum } from '../context/PrivateAlbumContext'

function PrivateAlbumSessionGuard() {
  const location = useLocation()
  const { lock } = usePrivateAlbum()

  useEffect(() => {
    if (!location.pathname.startsWith('/private')) {
      lock()
    }
  }, [location.pathname, lock])

  return null
}

export default PrivateAlbumSessionGuard