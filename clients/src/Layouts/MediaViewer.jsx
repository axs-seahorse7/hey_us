import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getFileIcon } from '../utils/fileIcon'
import { Alert, Button, ConfigProvider, Modal, Tooltip, Typography, theme, Spin } from 'antd'
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  FileOutlined,
  FilePdfOutlined,
  LeftOutlined,
  MinusOutlined,
  PlusOutlined,
  RightOutlined,
  PlayCircleFilled,
  PauseCircleFilled,
  CustomerServiceOutlined,
  DownloadOutlined,
  HeartOutlined,
  HeartFilled ,
  UndoOutlined ,
} from '@ant-design/icons'

import { useMedia } from '../context/MediaContext'
import { useAuth } from '../Authentication/Context/AuthContext'
import { usePrivateAlbum } from '../context/PrivateAlbumContext'
import { deletePrivateMedia, getPrivateOriginalUrl} from '../services/privateAlbum.service'

import { cacheThumbnail, getOrFetchOriginal, markOriginalViewed, removeCachedOriginal, removeCachedThumbnail } from '../services/mediaCache.service'
import { deleteMedia, getOriginalUrl, getRecycleBinOriginalUrl, toggleFavorite, permanentlyDeleteMedia, restoreMedia,} from '../services/media.service';
import { getMediaType } from '../utils/mediaType'

import './MediaViewer.css'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

const RAW_EXTENSIONS = [
  '.arw', '.cr2', '.cr3', '.nef',
  '.dng', '.raf', '.orf', '.rw2', '.pef',
];

function MediaViewer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const userId = user?.user?._id
  const {
  viewerOpen,
  viewerMedia,
  viewerIndex,
  viewerSource,
  closeViewer,
  currentMedia,
  nextMedia,
  previousMedia,
  removeViewerMedia,
  galleryImages,
  openViewer,
  syncMediaItems,
} = useMedia()

const { privateToken } = usePrivateAlbum()
const isPrivateViewer = viewerSource === 'private'
const isRecycleBinViewer = viewerSource === 'recycle-bin';
const [restoring, setRestoring] = useState(false);

console.log('[MediaViewer]', {
  viewerSource,
  isPrivateViewer,
  isRecycleBinViewer,
});

  const [downloadNotifications, setDownloadNotifications] = useState([])
  const [favoriteUpdating, setFavoriteUpdating] = useState(false)

  const [activeAudioUrl, setActiveAudioUrl] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState('')

  const audioRef = useRef(null)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)

  const currentMediaType = getMediaType(currentMedia || {})
  const getViewerOriginalUrl = useCallback(
    async (mediaId) => {
      if (isPrivateViewer) {
        if (!privateToken) {
          throw new Error('Private Album is locked. Unlock it again.');
        }

        const result = await getPrivateOriginalUrl(mediaId, privateToken);
        return result.url;
      }

      if (isRecycleBinViewer) {
        return getRecycleBinOriginalUrl(mediaId);
      }

      return getOriginalUrl(mediaId);
    },
    [isPrivateViewer, isRecycleBinViewer, privateToken],
  );

  const [activeVideoUrl, setActiveVideoUrl] = useState('')
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState('')
  const videoRef = useRef(null)

  const trackRef = useRef(null)
  const isScrollingFromCode = useRef(false)
  const hasInitializedViewer = useRef(false)

  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [controlsVisible, setControlsVisible] = useState(true)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 })
  const touchRef = useRef({ startDistance: 0, startZoom: 1, lastTap: 0 })

  const isNavigatingRef = useRef(false)

  // The viewer keeps only the active original as an object URL.
  // Original blobs persist in IndexedDB; speculative preloads stay as blobs there.
  const [activeOriginalUrl, setActiveOriginalUrl] = useState('')
  const [activeOriginalMediaId, setActiveOriginalMediaId] = useState('')
  const [originalLoading, setOriginalLoading] = useState(false)
  const [originalImageLoaded, setOriginalImageLoaded] = useState(false)
  const [originalError, setOriginalError] = useState('')
  const activeObjectUrlRef = useRef('')
  const originalUrlCacheRef = useRef(new Map())
  const [, setOriginalUrlVersion] = useState(0)
  const preloadRunRef = useRef(0)


  const revokeActiveObjectUrl = useCallback(() => {
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current)
      activeObjectUrlRef.current = ''
    }
    setActiveOriginalUrl('')
    setActiveOriginalMediaId('')
    setOriginalImageLoaded(false)
  }, [])

  function toggleAudioPlayback() {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      audio.play().catch((error) => {
        console.error('Audio playback failed:', error)
        setAudioError('Unable to play this audio file.')
      })
    } else {
      audio.pause()
    }
  }

  function formatAudioTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00'

    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
  }

  function handleAudioSeek(event) {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = Number(event.target.value)
    setAudioCurrentTime(audio.currentTime)
  }

  async function handleToggleFavorite() {
    if (!currentMedia?._id || favoriteUpdating) return

    try {
      setFavoriteUpdating(true)

      const result = await toggleFavorite(String(currentMedia._id))

      syncMediaItems([
        {
          _id: result.mediaId,
          isFavorite: result.isFavorite,
        },
      ])
    } catch (error) {
      console.error('Failed to update favourite:', error)
    } finally {
      setFavoriteUpdating(false)
    }
  }


  useEffect(() => {
    if (
      !viewerOpen ||
      !currentMedia ||
      !userId ||
      currentMediaType !== 'audio'
    ) {
      setActiveAudioUrl('')
      setAudioLoading(false)
      setAudioError('')
      return
    }

    let cancelled = false

    setActiveAudioUrl('')
    setAudioLoading(true)
    setAudioError('')
    setAudioCurrentTime(0)
    setAudioDuration(0)
    setAudioPlaying(false)

    getViewerOriginalUrl(String(currentMedia._id))
      .then((url) => {
        if (cancelled) return

        setActiveAudioUrl(url)
      })
      .catch((error) => {
        console.error('Audio URL generation failed:', error)

        if (!cancelled) {
          setAudioError('Could not load this audio file.')
        }
      })
      .finally(() => {
        if (!cancelled) setAudioLoading(false)
      })

    return () => {
      cancelled = true
    }
    }, [
    viewerOpen,
    currentMedia?._id,
    currentMediaType,
    userId,
    getViewerOriginalUrl,
  ])

  useEffect(() => {
    if (
      !viewerOpen ||
      !currentMedia ||
      !userId ||
      currentMediaType !== 'video'
    ) {
      setActiveVideoUrl('')
      setVideoLoading(false)
      setVideoError('')
      return
    }

    let cancelled = false

    setActiveVideoUrl('')
    setVideoLoading(true)
    setVideoError('')

    getViewerOriginalUrl(String(currentMedia._id))
      .then((url) => {
        if (cancelled) return
        setActiveVideoUrl(url)
      })
      .catch((error) => {
        console.error('Video URL generation failed:', error)

        if (!cancelled) {
          setVideoError('Could not load this video.')
        }
      })
      .finally(() => {
        if (!cancelled) setVideoLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    viewerOpen,
    currentMedia?._id,
    currentMediaType,
    userId,
    getViewerOriginalUrl,
  ])

  useEffect(() => {
    if (
      !viewerOpen ||
      !currentMedia ||
      !userId ||
      currentMediaType !== 'image'
    ) {
      setOriginalLoading(false)
      setOriginalError('')
      return
    }

    let cancelled = false
    const mediaId = String(currentMedia._id)

    setOriginalError('')
    const cachedUrl = originalUrlCacheRef.current.get(mediaId)

    if (!isPrivateViewer) {
      if (cachedUrl) {
        setActiveOriginalMediaId(mediaId)
        setActiveOriginalUrl(cachedUrl)
        setOriginalLoading(false)
        return
      }
    }

    if (cachedUrl) {
      setActiveOriginalMediaId(mediaId)
      setActiveOriginalUrl(cachedUrl)
      setOriginalLoading(false)
      return
    }

    setActiveOriginalMediaId('')
    setActiveOriginalUrl('')
    setOriginalLoading(true)
    setOriginalImageLoaded(false)

    const loadOriginal = async () => {
      if (isPrivateViewer || isRecycleBinViewer) {
        if (isPrivateViewer && !privateToken) {
          throw new Error('Private Album is locked.')
        }


        const signedUrl = await getViewerOriginalUrl(mediaId)
        const response = await fetch(signedUrl)

        if (!response.ok) {
          throw new Error(`Image download failed: ${response.status}`)
        }

        return response.blob()
      }

      const blob = await getOrFetchOriginal(userId, mediaId, 'viewed')

      await markOriginalViewed(userId, mediaId).catch((error) => {
        console.warn('Could not update media cache usage:', error)
      })

      return blob
    }

    loadOriginal().then((blob) => {
        if (cancelled) return

        const objectUrl = URL.createObjectURL(blob)

        if (!isPrivateViewer) {
          originalUrlCacheRef.current.set(mediaId, objectUrl)
        }

        setActiveOriginalMediaId(mediaId)
        setActiveOriginalUrl(objectUrl)
      })
      .catch((error) => {
        console.error('Original image loading failed:', error)

        if (!cancelled) {
          setOriginalError('Could not load the original image.')
        }
      })
      .finally(() => {
        if (!cancelled) setOriginalLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    viewerOpen,
    currentMedia?._id,
    currentMediaType,
    userId,
    isPrivateViewer,
    privateToken,
    getViewerOriginalUrl,
    isRecycleBinViewer,
  ])

  // After the current original has loaded, preload at most the next two images.
  // After the current original has loaded, preload one previous
  useEffect(() => {
    if (
      !viewerOpen ||
      !currentMedia ||
      !userId ||
      !activeOriginalUrl ||
      !originalImageLoaded ||
      isPrivateViewer ||
      isRecycleBinViewer
    ) return

    const runId = ++preloadRunRef.current
    let cancelled = false

    async function preloadAdjacentImages() {
      const candidates = [
        viewerMedia[viewerIndex - 1],
        viewerMedia[viewerIndex + 1],
      ].filter((item) => item?.contentType?.startsWith('image/'))

      for (const item of candidates) {
        if (cancelled || preloadRunRef.current !== runId) return

        const mediaId = String(item._id)

        if (originalUrlCacheRef.current.has(mediaId)) continue

        try {
          const blob = await getOrFetchOriginal(
            userId,
            mediaId,
            'prefetch'
          )

          if (cancelled || preloadRunRef.current !== runId) return

          const objectUrl = URL.createObjectURL(blob)

          originalUrlCacheRef.current.set(mediaId, objectUrl)

          setOriginalUrlVersion((version) => version + 1)

          console.log('[ORIGINAL PRELOADED]', mediaId)
        } catch (error) {
          console.warn('[PRELOAD FAILED]', mediaId, error)
        }
      }
    }

    preloadAdjacentImages()

    return () => {
      cancelled = true
    }
  }, [
    viewerOpen,
    currentMedia?._id,
    viewerIndex,
    viewerMedia,
    userId,
    activeOriginalUrl,
    originalImageLoaded,
    isPrivateViewer,
    isRecycleBinViewer,
  ])
  // Release the active Blob URL when the viewer closes or this component unmounts.
  useEffect(() => {
    if (!viewerOpen) {
      preloadRunRef.current += 1
      revokeActiveObjectUrl()
    }
  }, [viewerOpen, revokeActiveObjectUrl])

  useEffect(() => () => {
    if (activeObjectUrlRef.current) URL.revokeObjectURL(activeObjectUrlRef.current)
  }, [])

  // Track the previous route :id to detect navigation away from /gallery/:id
  
  const prevIdRef = useRef(id)

  useEffect(() => {
    const prevId = prevIdRef.current
    prevIdRef.current = id

    if (id) {
      // Only initialize from the global gallery when the viewer
      // is not already open. Preserve the list supplied by the page.
      if (!viewerOpen) {
        const target = galleryImages.find(
          (media) => String(media._id) === String(id)
        )

        if (target) {
          openViewer(target, galleryImages)
        }
      }
    } else if (prevId) {
      closeViewer()
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, viewerOpen, closeViewer, galleryImages, openViewer])

  const handleClose = useCallback(() => {
    if (isPrivateViewer || isRecycleBinViewer) {
      closeViewer();
      return;
    }

    if (window.location.pathname.includes('/folders/')) {
      closeViewer();
      return;
    }

    navigate(location.state?.from || '/gallery');
  }, [
    isPrivateViewer,
    isRecycleBinViewer,
    navigate,
    location.state,
    closeViewer,
  ]);

  // --------------------------------------------------
  // Zoom helpers
  // --------------------------------------------------

  const resetZoom = useCallback(() => {
    setZoom(MIN_ZOOM)
    setPosition({ x: 0, y: 0 })
  }, [])

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM))
  }, [])

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const next = Math.max(z - ZOOM_STEP, MIN_ZOOM)
      if (next === MIN_ZOOM) setPosition({ x: 0, y: 0 })
      return next
    })
  }, [])

  // Reset zoom whenever the displayed image changes
  useEffect(() => {
    resetZoom()
  }, [viewerIndex, resetZoom])

  // --------------------------------------------------
  // Keep browser scroll position synced with viewerIndex
  // --------------------------------------------------

  useEffect(() => {
    if (!viewerOpen || !trackRef.current) return

    const track = trackRef.current
    const slideWidth = track.clientWidth
    if (!slideWidth) return

    isScrollingFromCode.current = true

    if (!hasInitializedViewer.current) {
      track.scrollLeft = slideWidth * viewerIndex
      hasInitializedViewer.current = true
      requestAnimationFrame(() => {
        isScrollingFromCode.current = false
      })
      return
    }

    track.scrollTo({ left: slideWidth * viewerIndex, behavior: 'smooth' })

    const timeout = setTimeout(() => {
      isScrollingFromCode.current = false
    }, 400)

    return () => clearTimeout(timeout)
  }, [viewerIndex, viewerOpen])

  useEffect(() => {
    if (!viewerOpen) hasInitializedViewer.current = false
  }, [viewerOpen])

  // --------------------------------------------------
  // Detect mobile swipe / scroll
  // --------------------------------------------------

  useEffect(() => {
    if (!viewerOpen || !trackRef.current) return

    const track = trackRef.current

    let scrollTimeout

    function handleScroll() {
      if (isScrollingFromCode.current || isNavigatingRef.current) return

      clearTimeout(scrollTimeout)

      scrollTimeout = setTimeout(() => {
        const slideWidth = track.clientWidth
        if (!slideWidth) return

        const targetIndex = Math.round(track.scrollLeft / slideWidth)
        const difference = targetIndex - viewerIndex

        if (difference === 0) return

        isNavigatingRef.current = true

        if (difference > 0) nextMedia()
        else previousMedia()

        // Lock navigation until the next slide has settled.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            isNavigatingRef.current = false
          })
        })
      }, 100)
    }

    track.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      clearTimeout(scrollTimeout)
      track.removeEventListener('scroll', handleScroll)
    }
  }, [viewerOpen, viewerIndex, nextMedia, previousMedia])
  // --------------------------------------------------
  // Mouse wheel zoom (non-passive so preventDefault works)
  // --------------------------------------------------

  useEffect(() => {
    if (!viewerOpen || !trackRef.current) return

    const track = trackRef.current

    function handleWheel(event) {
      event.preventDefault()
      if (event.deltaY < 0) zoomIn()
      else zoomOut()
    }

    track.addEventListener('wheel', handleWheel, { passive: false })
    return () => track.removeEventListener('wheel', handleWheel)
  }, [viewerOpen, zoomIn, zoomOut])

  // --------------------------------------------------
  // Keyboard controls + body lock
  // --------------------------------------------------

  useEffect(() => {
    if (!viewerOpen) return

    function handleKeyDown(event) {
      if (deleteConfirmOpen) return

      if (event.key === 'Escape') handleClose()
      if (event.key === 'ArrowRight' && zoom === MIN_ZOOM) nextMedia()
      if (event.key === 'ArrowLeft' && zoom === MIN_ZOOM) previousMedia()
      if (event.key === '+' || event.key === '=') zoomIn()
      if (event.key === '-') zoomOut()
      if (event.key === '0') resetZoom()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [
    viewerOpen,
    zoom,
    deleteConfirmOpen,
    handleClose,
    nextMedia,
    previousMedia,
    zoomIn,
    zoomOut,
    resetZoom,
  ])

  // --------------------------------------------------
  // Double click / tap zoom
  // --------------------------------------------------

  function toggleZoom() {
    if (zoom === MIN_ZOOM) setZoom(2)
    else resetZoom()
  }

  // --------------------------------------------------
  // Mouse pan
  // --------------------------------------------------

  function handlePointerDown(event) {
    if (zoom <= MIN_ZOOM) return

    event.preventDefault()

    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event) {
    if (!dragRef.current.active) return

    setPosition({
      x: dragRef.current.originX + (event.clientX - dragRef.current.startX),
      y: dragRef.current.originY + (event.clientY - dragRef.current.startY),
    })
  }

  function handlePointerUp(event) {
    dragRef.current.active = false

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  // --------------------------------------------------
  // Mobile pinch zoom
  // --------------------------------------------------

  function getTouchDistance(touches) {
    const [a, b] = touches
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
  }

  function handleTouchStart(event) {
    if (event.touches.length === 2) {
      touchRef.current.startDistance = getTouchDistance(event.touches)
      touchRef.current.startZoom = zoom
      return
    }

    if (event.touches.length === 1) {
      const now = Date.now()
      if (now - touchRef.current.lastTap < 300) toggleZoom()
      touchRef.current.lastTap = now
    }
  }

  function handleTouchMove(event) {
    if (event.touches.length !== 2 || !touchRef.current.startDistance) return

    const scale = getTouchDistance(event.touches) / touchRef.current.startDistance
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, touchRef.current.startZoom * scale))

    setZoom(nextZoom)
    if (nextZoom === MIN_ZOOM) setPosition({ x: 0, y: 0 })
  }

  // --------------------------------------------------
  // Delete
  // --------------------------------------------------

  function openDeleteConfirm() {
    setDeleteError('')
    setDeleteConfirmOpen(true)
  }

  function closeDeleteConfirm() {
    if (!deleting) setDeleteConfirmOpen(false)
  }

  
  async function handleDelete() {
    if (!currentMedia || deleting) return;

    try {
      setDeleting(true);
      setDeleteError('');

      const mediaId = String(currentMedia._id);

      if (isPrivateViewer) {
        if (!privateToken) {
          throw new Error('Private Album is locked. Unlock it again.');
        }

        await deletePrivateMedia(mediaId, privateToken);
      } else if (isRecycleBinViewer) {
        await permanentlyDeleteMedia(mediaId);
      } else {
        await deleteMedia(mediaId);
      }

      // Remove cached files after successful deletion.
      if (userId) {
        await Promise.all([
          removeCachedOriginal(userId, mediaId),
          removeCachedThumbnail(userId, mediaId),
        ]).catch((error) => {
          console.warn('Could not remove media from local cache:', error);
        });
      }

      removeViewerMedia(mediaId);
      setDeleteConfirmOpen(false);

      message.success(
        isRecycleBinViewer
          ? 'Media permanently deleted.'
          : 'Media deleted successfully.'
      );
    } catch (error) {
      console.error('Failed to delete media:', error);

      setDeleteError(
        error.response?.data?.message ||
        error.message ||
        'Failed to delete media.'
      );
    } finally {
      setDeleting(false);
    }
  }


  async function handleRestore() {
    if (!currentMedia?._id || restoring) return;

    try {
      setRestoring(true);

      const mediaId = String(currentMedia._id);
      await restoreMedia(mediaId);
      removeViewerMedia(mediaId);
      message.success('Media restored successfully.');
    } catch (error) {
      console.error('Restore media failed:', error);

      message.error(
        error.response?.data?.message || 'Failed to restore media.'
      );
    } finally {
      setRestoring(false);
    }
  }
  // --------------------------------------------------
  // Toggle controls
  // --------------------------------------------------

  function handleImageClick(event) {
    if (zoom > MIN_ZOOM) return
    if (event.detail === 1) setControlsVisible((visible) => !visible)
  }

  function addDownloadNotification(fileName) {
    const id = `${Date.now()}-${Math.random()}`

    setDownloadNotifications((previous) => [
      ...previous,
      { id, fileName, createdAt: new Date() },
    ])
  }

  function dismissDownloadNotification(id) {
    setDownloadNotifications((previous) =>
      previous.filter((item) => item.id !== id)
    )
  }
  async function handleDownload() {
    if (!currentMedia?._id) return

    try {
      const url = await getViewerOriginalUrl(String(currentMedia._id))

      const link = document.createElement('a')
      link.href = url
      link.download = currentMedia.fileName || 'download'
      

      document.body.appendChild(link)
      link.click()
      addDownloadNotification(currentMedia.fileName || 'download')
      console.log('Download notifications:', downloadNotifications)
      link.remove()
    } catch (error) {
      console.error('Media download failed:', error)
    }
  }

  if (!viewerOpen) return null

  const isFirst = viewerIndex <= 0
  const isLast = viewerIndex >= viewerMedia.length - 1
  const hiddenClass = controlsVisible ? '' : ' is-hidden'

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { borderRadius: 14, colorBgElevated: 'rgba(28, 28, 32, 0.72)' },
      }}
    >
      <div className="media-viewer">
        {/* Ambient blurred backdrop, colours follow the current photo */}
        {(currentMediaType === 'image' || currentMediaType === 'raw') && (
          <div
            className="media-viewer__ambient"
            style={{
              backgroundImage: `url(${
                (activeOriginalMediaId === String(currentMedia._id) ? activeOriginalUrl : '') || currentMedia.thumbnailUrl || ''
              })`,
            }}
          />
        )}

        {/* Top bar */}
        {/* Floating top controls */}
        <header className={`media-viewer__topbar${hiddenClass}`}>
          <Button
            type="text"
            className="glass-btn media-viewer__control"
            icon={<ArrowLeftOutlined />}
            onClick={handleClose}
            aria-label="Close viewer"
          >
            Back
          </Button>

          <div className="media-viewer__top-actions">
            <span className="media-viewer__counter media-viewer__control">
              {viewerIndex + 1} / {viewerMedia.length}
            </span>

            <Tooltip title="Download">
              <Button
                type="text"
                shape="circle"
                className="glass-btn media-viewer__control"
                icon={<DownloadOutlined />}
                onClick={handleDownload}
                aria-label="Download file"
              />
            </Tooltip>
          </div>
        </header>

        {/* Slides */}
        <div className="media-viewer__track" ref={trackRef}>
          {viewerMedia.map((media, index) => {
            const mediaType = getMediaType(media)
            const isCurrent = index === viewerIndex
            const mediaId = String(media._id)
            // Non-active slides use thumbnails only; the active slide uses its downloaded original.
            const cachedOriginalUrl =
              originalUrlCacheRef.current.get(mediaId) || ''

            const activeOriginal =
              activeOriginalMediaId === mediaId
                ? activeOriginalUrl
                : ''

            // Original always takes priority. Thumbnail is only a first-load fallback.
            const resolvedUrl =
              cachedOriginalUrl ||
              activeOriginal ||
              (isCurrent ? media.thumbnailUrl || '' : '')

            const isLoadingOriginal = isCurrent && originalLoading
            return (
              <div className="media-viewer__slide" key={media._id}>
                {mediaType === 'image' || mediaType === 'raw' ? (
                  <div
                    className={`media-viewer__image-container${
                      isCurrent && zoom > 1 ? ' media-viewer__image-container--zoomed' : ''
                    }`}
                  >
                    <img
                      src={resolvedUrl}
                      alt={media.fileName}
                      className={`media-viewer__image${isLoadingOriginal ? ' media-viewer__image--loading' : ''}`}
                      draggable={false}
                      style={
                        isCurrent
                          ? {
                              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                            }
                          : undefined
                      }
                      onClick={handleImageClick}
                      onDoubleClick={toggleZoom}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onLoad={() => {
                        if (
                          isCurrent &&
                          activeOriginalMediaId === mediaId &&
                          activeOriginalUrl
                        ) {
                          setOriginalImageLoaded(true)
                          setOriginalError('')
                        }
                      }}
                    />
                    {/* Loading indicator shown on current slide while fetching original */}
                    {isLoadingOriginal && media.thumbnailUrl && (
                      <div className="media-viewer__loading-badge">
                        <img
                          src={media.thumbnailUrl}
                          alt="Loading..."
                        />
                      </div>
                    )}
                    {isCurrent && originalError && (
                      <div className="media-viewer__loading-badge" role="alert">
                        {originalError}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setOriginalError('')
                              setOriginalLoading(true)
                              setOriginalImageLoaded(false)

                              let blob

                              if (isPrivateViewer || isRecycleBinViewer) {
                                if (isPrivateViewer && !privateToken) {
                                  throw new Error('Private Album is locked.')
                                }

                                const signedUrl = await getViewerOriginalUrl(mediaId)
                                const response = await fetch(signedUrl)

                                if (!response.ok) {
                                  throw new Error(`Image download failed: ${response.status}`)
                                }

                                blob = await response.blob()
                              } else {
                                blob = await getOrFetchOriginal(userId, mediaId, 'viewed')

                                await markOriginalViewed(userId, mediaId).catch((error) => {
                                  console.warn('Could not update media cache usage:', error)
                                })
                              }

                              const previousUrl = originalUrlCacheRef.current.get(mediaId)

                              if (!isPrivateViewer && previousUrl) {
                                URL.revokeObjectURL(previousUrl)
                              }

                              const objectUrl = URL.createObjectURL(blob)

                              if (!isPrivateViewer) {
                                originalUrlCacheRef.current.set(mediaId, objectUrl)
                              }

                              setActiveOriginalMediaId(mediaId)
                              setActiveOriginalUrl(objectUrl)
                            } catch (error) {
                              console.error('Original retry failed:', error)
                              setOriginalError('Could not load the original image. Please try again.')
                            } finally {
                              setOriginalLoading(false)
                            }
                          }}

                        >Retry</button>
                      </div>
                    )}
                  </div>
                ) : mediaType === 'audio' && isCurrent ? (
                <div className="media-viewer__file glass">
                  <div className="media-viewer__audio">

                    <div className="media-viewer__audio-artwork">
                      <CustomerServiceOutlined />
                    </div>

                    <Typography.Title level={4}>
                      {media.fileName}
                    </Typography.Title>


                    {audioLoading && <Spin />}

                    {audioError && (
                      <Alert type="error" message={audioError} showIcon />
                    )}

                    {activeAudioUrl && (
                      <>
                        <audio
                          ref={audioRef}
                          src={activeAudioUrl}
                          preload="metadata"
                          onLoadedMetadata={(event) => {
                            setAudioDuration(event.currentTarget.duration)
                          }}
                          onTimeUpdate={(event) => {
                            setAudioCurrentTime(event.currentTarget.currentTime)
                          }}
                          onPlay={() => setAudioPlaying(true)}
                          onPause={() => setAudioPlaying(false)}
                          onEnded={() => setAudioPlaying(false)}
                        />

                        <button
                          type="button"
                          className="media-viewer__audio-play"
                          onClick={toggleAudioPlayback}
                          aria-label={audioPlaying ? 'Pause audio' : 'Play audio'}
                        >
                          {audioPlaying ? (
                            <PauseCircleFilled />
                          ) : (
                            <PlayCircleFilled />
                          )}
                        </button>

                        <div className="media-viewer__audio-progress">
                          <span>{formatAudioTime(audioCurrentTime)}</span>

                          <input
                            type="range"
                            min="0"
                            max={audioDuration || 0}
                            step="0.1"
                            value={Math.min(audioCurrentTime, audioDuration || 0)}
                            onChange={handleAudioSeek}
                          />

                          <span>{formatAudioTime(audioDuration)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                ) : mediaType === 'video' && isCurrent ? (
                <div className="media-viewer__video">
                  {videoLoading && <Spin />}

                  {videoError && (
                    <Alert type="error" message={videoError} showIcon />
                  )}

                  {activeVideoUrl && (
                    <video
                      ref={videoRef}
                      src={activeVideoUrl}
                      controls
                      playsInline
                      preload="metadata"
                      onError={() => {
                        setVideoError('This video format may not be supported by your browser.')
                      }}
                    />
                  )}
                </div>) : (
                  <div className="media-viewer__file glass">
                    {(() => {
                      const fileConfig = getFileIcon(media.fileName)
                      const FileIcon = fileConfig.icon

                      return (
                        <div
                          className="media-viewer__document-icon"
                          style={{
                            backgroundColor: fileConfig.bg,
                            color: fileConfig.color,
                          }}
                        >
                          <FileIcon />
                        </div>
                      )
                    })()}

                    <Typography.Text>{media.fileName}</Typography.Text>
                    <Button
                      shape="rounded"
                      style={{ marginTop: '8px', backgroundColor: '#037930', color: '#fff', border: 'none' }}
                      icon={<DownloadOutlined />}
                      onClick={handleDownload}
                      aria-label="Download file"
                    >
                      Download
                      </Button>
                </div>
              )}
              </div>
            )
          })}
        </div>


        {/* Prev / next */}
        {zoom === MIN_ZOOM && (
          <>
            <Button
              shape="circle"
              size="large"
              className={`media-viewer__nav media-viewer__nav--previous glass${hiddenClass}`}
              icon={<LeftOutlined />}
              onClick={previousMedia}
              disabled={isFirst}
              aria-label="Previous media"
            />
            <Button
              shape="circle"
              size="large"
              className={`media-viewer__nav media-viewer__nav--next glass${hiddenClass}`}
              icon={<RightOutlined />}
              onClick={nextMedia}
              disabled={isLast}
              aria-label="Next media"
            />
          </>
        )}

        {/* Bottom toolbar */}
        <div className={`media-viewer__toolbar glass${hiddenClass}`}>
          <Tooltip title="Zoom out">
            <Button
              type="text"
              shape="circle"
              className="glass-btn"
              icon={<MinusOutlined />}
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
            />
          </Tooltip>

          <Tooltip title="Reset zoom">
            <Button
              type="text"
              className="glass-btn media-viewer__zoom-label"
              onClick={resetZoom}
              aria-label="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </Button>
          </Tooltip>

          <Tooltip title="Zoom in">
            <Button
              type="text"
              shape="circle"
              className="glass-btn"
              icon={<PlusOutlined />}
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
            />
          </Tooltip>

          <span className="media-viewer__divider" />

          {!isRecycleBinViewer && (<Tooltip title={currentMedia?.isFavorite ? 'Remove from favourites' : 'Add to favourites'}>
            <Button
              type="text"
              shape="circle"
              className="glass-btn"
              icon={
                currentMedia?.isFavorite
                  ? <HeartFilled style={{ color: '#ff4d6d' }} />
                  : <HeartOutlined />
              }
              onClick={handleToggleFavorite}
              loading={favoriteUpdating}
              aria-label="Toggle favourite"
            />
          </Tooltip>)}

          {isRecycleBinViewer && (
            <Tooltip title="Restore to original location">
              <Button
                type="text"
                shape="circle"
                className="glass-btn"
                icon={<UndoOutlined />}
                onClick={handleRestore}
                loading={restoring}
                disabled={restoring}
                aria-label="Restore media"
              />
            </Tooltip>
          )}

          <Tooltip
            title={
              isPrivateViewer || isRecycleBinViewer
                ? 'Delete Permanently'
                : 'Move to Recycle Bin'
            }
          >
            <Button
              type="text"
              shape="circle"
              danger
              className="glass-btn"
              icon={<DeleteOutlined />}
              onClick={openDeleteConfirm}
              disabled={deleting}
              aria-label="Delete media"
            />
          </Tooltip>
        </div>

        {/* Download notifications */}
        <div className="media-viewer__downloads">
          {downloadNotifications.map((item) => (
            <div
              key={item.id}
              className="media-viewer__download-notification"
            >
              <span className="media-viewer__download-icon">
                <DownloadOutlined />
              </span>

              <div className="media-viewer__download-info">
                <strong>Download started</strong>
                <span>{item.fileName}</span>
              </div>

              <button
                type="button"
                onClick={() => dismissDownloadNotification(item.id)}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Delete confirmation */}
        <Modal
          open={deleteConfirmOpen}
          title={
            isRecycleBinViewer || isPrivateViewer
              ? 'Delete permanently?'
              : 'Move to Recycle Bin?'
          }
          centered
          width={360}
          onCancel={closeDeleteConfirm}
          maskClosable={!deleting}
          closable={false}
          wrapClassName="media-viewer__modal"
          okText={
            isRecycleBinViewer || isPrivateViewer
              ? 'Delete permanently'
              : 'Move to Recycle Bin'
          }
          cancelText="Cancel"
          okButtonProps={{ danger: true, loading: deleting }}
          cancelButtonProps={{ disabled: deleting }}
          onOk={handleDelete}
        >
          <p className="media-viewer__modal-text">
            {isRecycleBinViewer || isPrivateViewer
              ? 'This file will be permanently deleted from your account and cannot be recovered.'
              : 'This file will be moved to the Recycle Bin. You can restore it later.'}
          </p>

          {deleteError && (
            <Alert type="error" showIcon message={deleteError} />
          )}
        </Modal>
      </div>
    </ConfigProvider>
  )
}

export default MediaViewer