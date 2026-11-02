import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Alert, Button, ConfigProvider, Modal, Tooltip, Typography, theme } from 'antd'
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  FileOutlined,
  LeftOutlined,
  MinusOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { useMedia } from '../context/MediaContext'
import { useAuth } from '../Authentication/Context/AuthContext'
import { deleteMedia } from '../services/media.service'
import { getOrFetchOriginal, markOriginalViewed, removeCachedOriginal } from '../services/mediaCache.service'
import './MediaViewer.css'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

const RAW_EXTENSIONS = [
  '.arw', '.cr2', '.cr3', '.nef',
  '.dng', '.raf', '.orf', '.rw2', '.pef',
];

function isRawMedia(media) {
  const extension = media?.fileName
    ?.slice(media.fileName.lastIndexOf('.'))
    .toLowerCase();

  return RAW_EXTENSIONS.includes(extension);
}

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

  // The viewer keeps only the active original as an object URL.
  // Original blobs persist in IndexedDB; speculative preloads stay as blobs there.
  const [activeOriginalUrl, setActiveOriginalUrl] = useState('')
  const [activeOriginalMediaId, setActiveOriginalMediaId] = useState('')
  const [originalLoading, setOriginalLoading] = useState(false)
  const [originalImageLoaded, setOriginalImageLoaded] = useState(false)
  const [originalError, setOriginalError] = useState('')
  const activeObjectUrlRef = useRef('')
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

 
  useEffect(() => {
    if (
      !viewerOpen ||
      !currentMedia ||
      !userId ||
      (!currentMedia.contentType?.startsWith('image/') || isRawMedia(currentMedia))
    ) {
      revokeActiveObjectUrl()
      setOriginalLoading(false)
      setOriginalError('')
      return
    }

    let cancelled = false
    const mediaId = String(currentMedia._id)

    revokeActiveObjectUrl()
    setOriginalLoading(false)
    setOriginalImageLoaded(false)
    setOriginalError('')

    console.log('[ORIGINAL LOAD STARTED]', mediaId)

    getOrFetchOriginal(userId, mediaId, 'viewed', {
      onCacheMiss: () => {
        if (!cancelled) {
          console.log('[CACHE MISS] Downloading original from S3:', mediaId)
          setOriginalLoading(true)
        }
      },
    })
      .then(async (blob) => {
        if (cancelled) return

        await markOriginalViewed(userId, mediaId).catch((error) => {
          console.warn('Could not update media cache usage:', error)
        })

        if (cancelled) return

        const objectUrl = URL.createObjectURL(blob)
        activeObjectUrlRef.current = objectUrl

        setActiveOriginalMediaId(mediaId)
        setActiveOriginalUrl(objectUrl)

        console.log('[ORIGINAL READY]', {
          mediaId,
          size: blob.size,
          source: 'IndexedDB or S3',
        })
      })
       .catch((error) => {
        console.error('[ORIGINAL RETRY FAILED]', {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });

        setOriginalLoading(false);
        setOriginalError(`${error.name}: ${error.message}`);
      })
      .finally(() => {
        if (!cancelled) {
          setOriginalLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [ viewerOpen, currentMedia?._id, currentMedia?.contentType, userId, revokeActiveObjectUrl])

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

    function handleScroll() {
      if (isScrollingFromCode.current) return

      const slideWidth = track.clientWidth
      if (!slideWidth) return

      const newIndex = Math.round(track.scrollLeft / slideWidth)
      if (newIndex === viewerIndex) return

      if (newIndex > viewerIndex) nextMedia()
      else previousMedia()
    }

    track.addEventListener('scroll', handleScroll, { passive: true })
    return () => track.removeEventListener('scroll', handleScroll)
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
        await removeCachedOriginal(userId, String(currentMedia._id)).catch((error) => {
          console.warn('Could not remove deleted media from local cache:', error)
        })
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
        {currentMedia?.contentType?.startsWith('image/') && (
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
        <header className={`media-viewer__topbar glass${hiddenClass}`}>
          <Button
            type="text"
            className="glass-btn"
            icon={<ArrowLeftOutlined />}
            onClick={handleClose}
            aria-label="Close viewer"
          >
            Back
          </Button>

          <Typography.Text className="media-viewer__title" ellipsis>
            {currentMedia?.fileName}
          </Typography.Text>

          <span className="media-viewer__counter">
            {viewerIndex + 1} / {viewerMedia.length}
          </span>
        </header>

        {/* Slides */}
        <div className="media-viewer__track" ref={trackRef}>
          {viewerMedia.map((media, index) => {
            const isCurrent = index === viewerIndex
            const mediaId = String(media._id)
            // Non-active slides use thumbnails only; the active slide uses its downloaded original.
            const hasActiveOriginal = isCurrent && activeOriginalMediaId === mediaId
            const resolvedUrl = hasActiveOriginal ? activeOriginalUrl : (media.thumbnailUrl || '')
            const isLoadingOriginal = isCurrent && originalLoading

            return (
              <div className="media-viewer__slide" key={media._id}>
                {media.contentType?.startsWith('image/') || isRawMedia(media) ? (
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
                ) : (
                  <div className="media-viewer__file glass">
                    <FileOutlined />
                    <Typography.Text>{media.fileName}</Typography.Text>
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