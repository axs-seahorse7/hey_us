import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMedia } from '../context/MediaContext'
import { deleteMedia } from '../services/media.service'
import './MediaViewer.css'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

function MediaViewer() {
  const { id } = useParams()
  const navigate = useNavigate()
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

  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [controlsVisible, setControlsVisible] = useState(true)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const imageRef = useRef(null)
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  })

  const touchRef = useRef({
    startDistance: 0,
    startZoom: 1,
    lastTap: 0,
  })

  // --------------------------------------------------
  // Route-based viewer control
  // --------------------------------------------------

  useEffect(() => {
    if (id) {
      // We completely remove the logic that might override viewerMedia with galleryImages.
      // If the viewer was opened from a folder, viewerMedia already contains the folder's images.
    } else {
      closeViewer()
    }
  }, [id, closeViewer])

  const handleClose = () => {
    navigate('/gallery')
  }

  // --------------------------------------------------
  // Reset zoom whenever the displayed image changes
  // --------------------------------------------------

  useEffect(() => {
    setZoom(MIN_ZOOM)
    setPosition({ x: 0, y: 0 })
  }, [viewerIndex])

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

    track.scrollTo({
      left: slideWidth * viewerIndex,
      behavior: 'smooth',
    })

    const timeout = setTimeout(() => {
      isScrollingFromCode.current = false
    }, 400)

    return () => clearTimeout(timeout)
  }, [viewerIndex, viewerOpen])

  useEffect(() => {
    if (!viewerOpen) {
      hasInitializedViewer.current = false
    }
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

      if (newIndex !== viewerIndex) {
        const difference = newIndex - viewerIndex

        if (difference > 0) {
          nextMedia()
        } else if (difference < 0) {
          previousMedia()
        }
      }
    }

    track.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      track.removeEventListener('scroll', handleScroll)
    }
  }, [viewerOpen, viewerIndex, nextMedia, previousMedia])

  // --------------------------------------------------
  // Keyboard controls + body lock
  // --------------------------------------------------

  useEffect(() => {
    if (!viewerOpen) return

    function handleKeyDown(event) {
      if (event.key === 'Escape') handleClose()

      if (event.key === 'ArrowRight' && zoom === 1) {
        nextMedia()
      }

      if (event.key === 'ArrowLeft' && zoom === 1) {
        previousMedia()
      }

      if (event.key === '+' || event.key === '=') {
        zoomIn()
      }

      if (event.key === '-') {
        zoomOut()
      }

      if (event.key === '0') {
        resetZoom()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [viewerOpen, handleClose, nextMedia, previousMedia, zoom])

  // --------------------------------------------------
  // Zoom functions
  // --------------------------------------------------

  function zoomIn() {
    setZoom((currentZoom) =>
      Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM),
    )
  }

  function zoomOut() {
    setZoom((currentZoom) => {
      const nextZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM)

      if (nextZoom === MIN_ZOOM) {
        setPosition({ x: 0, y: 0 })
      }

      return nextZoom
    })
  }

  function resetZoom() {
    setZoom(MIN_ZOOM)
    setPosition({ x: 0, y: 0 })
  }

  // --------------------------------------------------
  // Double click zoom
  // --------------------------------------------------

  function handleDoubleClick() {
    if (zoom === MIN_ZOOM) {
      setZoom(2)
    } else {
      resetZoom()
    }
  }

  // --------------------------------------------------
  // Mouse wheel zoom
  // --------------------------------------------------

  function handleWheel(event) {
    event.preventDefault()

    if (event.deltaY < 0) {
      zoomIn()
    } else {
      zoomOut()
    }
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

    const deltaX = event.clientX - dragRef.current.startX
    const deltaY = event.clientY - dragRef.current.startY

    setPosition({
      x: dragRef.current.originX + deltaX,
      y: dragRef.current.originY + deltaY,
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
    const [firstTouch, secondTouch] = touches

    const deltaX = secondTouch.clientX - firstTouch.clientX
    const deltaY = secondTouch.clientY - firstTouch.clientY

    return Math.sqrt(deltaX * deltaX + deltaY * deltaY)
  }

  function handleTouchStart(event) {
    if (event.touches.length === 2) {
      touchRef.current.startDistance = getTouchDistance(event.touches)
      touchRef.current.startZoom = zoom
      return
    }

    if (event.touches.length === 1) {
      const now = Date.now()

      if (now - touchRef.current.lastTap < 300) {
        if (zoom === MIN_ZOOM) {
          setZoom(2)
        } else {
          resetZoom()
        }
      }

      touchRef.current.lastTap = now
    }
  }

  function handleTouchMove(event) {
    if (event.touches.length !== 2) return

    const currentDistance = getTouchDistance(event.touches)

    if (!touchRef.current.startDistance) return

    const scale = currentDistance / touchRef.current.startDistance

    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, touchRef.current.startZoom * scale)
    )

    setZoom(nextZoom)

    if (nextZoom === MIN_ZOOM) {
      setPosition({ x: 0, y: 0 })
    }
  }

  async function handleDelete() {
        if (!currentMedia || deleting) return

        try {
            setDeleting(true)
            setDeleteError('')

            await deleteMedia(currentMedia._id)

            removeViewerMedia(currentMedia._id)

            setDeleteConfirmOpen(false)
        } catch (error) {
            console.error('Failed to delete media:', error)

            setDeleteError(
            error.response?.data?.message ||
            error.message ||
            'Failed to delete media.',
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

    if (event.detail === 1) {
      setControlsVisible((visible) => !visible)
    }
  }

  if (!viewerOpen) return null

  return (
    <div className="media-viewer">
      {controlsVisible && (
        <button
          type="button"
          className="media-viewer__close"
          onClick={handleClose}
          aria-label="Close viewer"
        >
          ← Back
        </button>
      )}

      <div className="media-viewer__track" ref={trackRef}>
        {viewerMedia.map((media, index) => (
          <div
            className="media-viewer__slide"
            key={media._id}
          >
            {media.contentType?.startsWith('image/') ? (
              <div
                className={`media-viewer__image-container ${
                  index === viewerIndex && zoom > 1
                    ? 'media-viewer__image-container--zoomed'
                    : ''
                }`}
              >
                <img
                  ref={index === viewerIndex ? imageRef : null}
                  src={media.url}
                  alt={media.fileName}
                  className="media-viewer__image"
                  style={
                    index === viewerIndex
                      ? {
                          transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                        }
                      : undefined
                  }
                  onClick={handleImageClick}
                  onDoubleClick={handleDoubleClick}
                  onWheel={handleWheel}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                />
              </div>
            ) : (
              <div className="media-viewer__file">
                📄
              </div>
            )}
          </div>
        ))}
      </div>

      {controlsVisible && zoom === MIN_ZOOM && (
        <>
          <button
            type="button"
            className="media-viewer__nav media-viewer__nav--previous"
            onClick={previousMedia}
            aria-label="Previous media"
          >
            ‹
          </button>

          <button
            type="button"
            className="media-viewer__nav media-viewer__nav--next"
            onClick={nextMedia}
            aria-label="Next media"
          >
            ›
          </button>
        </>
      )}

      {controlsVisible && (
        <div className="media-viewer__toolbar">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
          >
            −
          </button>

          <button
            type="button"
            onClick={resetZoom}
            aria-label="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            +
          </button>

          <button
            type="button"
            className="media-viewer__delete"
            onClick={() => {
                setDeleteError('')
                setDeleteConfirmOpen(true)
            }}
            disabled={deleting}
            >
            🗑
          </button>
        </div>
      )}

      {controlsVisible && (
        <div className="media-viewer__counter">
          {viewerIndex + 1} / {viewerMedia.length}
        </div>
      )}

      {deleteConfirmOpen && (
        <div
            className="media-viewer__delete-overlay"
            onClick={() => {
            if (!deleting) setDeleteConfirmOpen(false)
            }}
        >
            <div
            className="media-viewer__delete-dialog"
            onClick={(event) => event.stopPropagation()}
            >
            <h2>Delete this photo?</h2>

            <p>
                This photo will be permanently deleted from your gallery.
            </p>

            {deleteError && (
                <p className="media-viewer__delete-error">
                {deleteError}
                </p>
            )}

            <div className="media-viewer__delete-actions">
                <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
                >
                Cancel
                </button>

                <button
                type="button"
                className="media-viewer__delete-confirm"
                onClick={handleDelete}
                disabled={deleting}
                >
                {deleting ? 'Deleting...' : 'Delete'}
                </button>
            </div>
            </div>
        </div>
        )}
    </div>
  )
}

export default MediaViewer