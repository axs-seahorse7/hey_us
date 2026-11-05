import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getFileIcon } from '../utils/fileIcon'
import { Alert, Button, ConfigProvider, Modal, Tooltip, Typography, theme } from 'antd'
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
} from '@ant-design/icons'

import { useMedia } from '../context/MediaContext'
import { useAuth } from '../Authentication/Context/AuthContext'

import { getOrFetchOriginal, markOriginalViewed, removeCachedOriginal, removeCachedThumbnail } from '../services/mediaCache.service'
import { deleteMedia, getOriginalUrl } from '../services/media.service'
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
  const { user } = useAuth()
  const userId = user?.user?._id
  const {
    viewerOpen,
    viewerMedia,
    viewerIndex,
    closeViewer,
    currentMedia,
    nextMedia,
    previousMedia,
    removeViewerMedia,
    galleryImages,
    openViewer,
  } = useMedia()

  const [downloadNotifications, setDownloadNotifications] = useState([])

  const [activeAudioUrl, setActiveAudioUrl] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState('')

  const audioRef = useRef(null)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)

  const currentMediaType = getMediaType(currentMedia || {})

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

    getOriginalUrl(String(currentMedia._id))
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

    getOriginalUrl(String(currentMedia._id))
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

    // Reuse an already-created object URL immediately.
    const cachedUrl = originalUrlCacheRef.current.get(mediaId)

    if (cachedUrl) {
      setActiveOriginalMediaId(mediaId)
      setActiveOriginalUrl(cachedUrl)
      setOriginalLoading(false)
      return
    }

    setActiveOriginalMediaId('')
    setActiveOriginalUrl('')
    setOriginalLoading(false)
    setOriginalImageLoaded(false)

    getOrFetchOriginal(userId, mediaId, 'viewed', {
      onCacheMiss: () => {
        if (!cancelled) setOriginalLoading(true)
      },
    })
      .then(async (blob) => {
        if (cancelled) return

        await markOriginalViewed(userId, mediaId).catch((error) => {
          console.warn('Could not update media cache usage:', error)
        })

        if (cancelled) return

        const objectUrl = URL.createObjectURL(blob)

        originalUrlCacheRef.current.set(mediaId, objectUrl)

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
  ])
  // After the current original has loaded, preload at most the next two images.
  // Downloads are sequential, and stale preload runs stop before starting another item.
  useEffect(() => {
    if (!viewerOpen || !currentMedia || !userId || !activeOriginalUrl || !originalImageLoaded) return

    const runId = ++preloadRunRef.current
    let cancelled = false

    async function preloadNextImages() {
      const candidates = viewerMedia
        .slice(viewerIndex + 1, viewerIndex + 3)
        .filter((item) => item?.contentType?.startsWith('image/'))

      for (const item of candidates) {
        if (cancelled || preloadRunRef.current !== runId) return

        try {
          await getOrFetchOriginal(userId, String(item._id), 'prefetch')
        } catch (error) {
          // A failed speculative preload is retried naturally when the user opens it.
          console.warn('Background media preload failed:', item._id, error)
        }
      }
    }

    preloadNextImages()

    return () => {
      cancelled = true
    }
  }, [viewerOpen, currentMedia?._id, viewerIndex, viewerMedia, userId, activeOriginalUrl, originalImageLoaded])

  // Release the active Blob URL when the viewer closes or this component unmounts.
  useEffect(() => {
    if (!viewerOpen) {
      preloadRunRef.current += 1

      originalUrlCacheRef.current.forEach((url) => {
        URL.revokeObjectURL(url)
      })

      originalUrlCacheRef.current.clear()

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
      // Deep-link or Gallery tab: open viewer from gallery images if not already open
      const target = galleryImages.find((m) => m._id === id)
      if (target) {
        openViewer(target, galleryImages)
      }
    } else if (prevId) {
      // id went from a value → undefined: user navigated away from /gallery/:id
      // (e.g. pressed Back or switched tabs). Close the viewer.
      closeViewer()
    }
    // NOTE: viewerOpen is intentionally NOT in the deps list.
    // Adding it would cause a feedback loop: openViewer() sets viewerOpen=true,
    // which re-runs this effect, and since id is undefined on folder routes,
    // closeViewer() would fire immediately — preventing folder media from opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, closeViewer, galleryImages, openViewer])

  const handleClose = useCallback(() => {
    if (window.location.pathname.includes('/folders/')) {
      // Viewer was opened as an overlay from a folder — just close it, stay on the folder page
      closeViewer()
    } else {
      // Gallery viewer: navigate back to /gallery (the prevIdRef transition will close the viewer)
      navigate('/gallery')
    }
  }, [navigate, closeViewer])

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
    if (!currentMedia || deleting) return

    try {
      setDeleting(true)
      setDeleteError('')

      await deleteMedia(currentMedia._id)
      if (userId) {
        const mediaId = String(currentMedia._id);

        await Promise.all([
          removeCachedOriginal(userId, mediaId),
          removeCachedThumbnail(userId, mediaId),
        ]).catch((error) => {
          console.warn('Could not remove deleted media from local cache:', error);
        });
      }

      removeViewerMedia(currentMedia._id)
      setDeleteConfirmOpen(false)
      
    } catch (error) {
      console.error('Failed to delete media:', error)
      setDeleteError(
        error.response?.data?.message || error.message || 'Failed to delete media.',
      )
    } finally {
      setDeleting(false)
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
      const url = await getOriginalUrl(String(currentMedia._id))

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
            const cachedOriginalUrl = isCurrent
          ? originalUrlCacheRef.current.get(mediaId)
          : ''

        const hasActiveOriginal =
          isCurrent &&
          (activeOriginalMediaId === mediaId || Boolean(cachedOriginalUrl))

        const resolvedUrl = hasActiveOriginal
          ? (activeOriginalUrl || cachedOriginalUrl)
          : (media.thumbnailUrl || '')
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
                        if (isCurrent && hasActiveOriginal) {
                          setOriginalImageLoaded(true)
                          setOriginalError('')
                        }
                      }}
                    />
                    {/* Loading indicator shown on current slide while fetching original */}
                    {isLoadingOriginal && (
                      <div className="media-viewer__loading-badge">Loading original…</div>
                    )}
                    {isCurrent && originalError && (
                      <div className="media-viewer__loading-badge" role="alert">
                        {originalError}
                        <button
                          type="button"
                          onClick={() => {
                            setOriginalError('')
                            setOriginalLoading(true)
                            setOriginalImageLoaded(false)
                            getOrFetchOriginal(userId, mediaId, 'viewed')
                              .then((blob) => {
                                const objectUrl = URL.createObjectURL(blob)
                                if (activeObjectUrlRef.current) URL.revokeObjectURL(activeObjectUrlRef.current)
                                activeObjectUrlRef.current = objectUrl
                                setActiveOriginalMediaId(mediaId)
                                setActiveOriginalUrl(objectUrl)
                              })
                              .catch((error) => {
                                console.error('Original retry failed:', error)
                                setOriginalError('Could not load the original image. Please try again.')
                              })
                              .finally(() => setOriginalLoading(false))
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

                    {audioLoading && <p>Loading audio...</p>}

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
                  {videoLoading && <p>Loading video...</p>}

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

          <Tooltip title="Delete">
            <Button
              type="text"
              shape="circle"
              danger
              className="glass-btn"
              icon={<DeleteOutlined />}
              onClick={openDeleteConfirm}
              disabled={deleting}
              aria-label="Delete photo"
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
          title="Delete this photo?"
          centered
          width={360}
          onCancel={closeDeleteConfirm}
          maskClosable={!deleting}
          closable={false}
          wrapClassName="media-viewer__modal"
          okText="Delete"
          cancelText="Cancel"
          okButtonProps={{ danger: true, loading: deleting }}
          cancelButtonProps={{ disabled: deleting }}
          onOk={handleDelete}
        >
          <p className="media-viewer__modal-text">
            This photo will be permanently deleted from your gallery.
          </p>

          {deleteError && <Alert type="error" showIcon message={deleteError} />}
        </Modal>
      </div>
    </ConfigProvider>
  )
}

export default MediaViewer