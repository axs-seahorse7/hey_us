
import { createContext, useCallback, useContext, useState } from 'react'

const MediaContext = createContext(null)

export function MediaProvider({ children }) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerMedia, setViewerMedia] = useState([])
  const [viewerIndex, setViewerIndex] = useState(0)
  const [viewerSource, setViewerSource] = useState('gallery')
  const [galleryImages, setGalleryImages] = useState([])
  const [onViewerMediaRemoved, setOnViewerMediaRemoved] = useState(null)

  const openViewer = useCallback(
    (media, mediaList = [media], source = 'gallery', onMediaRemoved = null) => {
      const index = mediaList.findIndex(
        (item) => String(item._id) === String(media._id),
      )

      setViewerMedia(mediaList)
      setViewerIndex(index >= 0 ? index : 0)
      setViewerSource(source)
      setOnViewerMediaRemoved(() => onMediaRemoved)
      setViewerOpen(true)
    },
    [],
  )

  const closeViewer = useCallback(() => {
    setViewerOpen(false)
    setOnViewerMediaRemoved(null)
  }, [])

  const syncMediaItems = useCallback((updatedItems = []) => {
    if (!updatedItems.length) return

    const updatesById = new Map(
      updatedItems.map((item) => [String(item._id), item]),
    )

    const mergeUpdates = (currentItems) =>
      currentItems.map((item) => {
        const updated = updatesById.get(String(item._id))
        return updated ? { ...item, ...updated } : item
      })

    setGalleryImages(mergeUpdates)
    setViewerMedia(mergeUpdates)
  }, [])

  const nextMedia = useCallback(() => {
    setViewerIndex((index) =>
      index >= viewerMedia.length - 1 ? index : index + 1,
    )
  }, [viewerMedia.length])

  const previousMedia = useCallback(() => {
    setViewerIndex((index) => (index <= 0 ? index : index - 1))
  }, [])

  const removeViewerMedia = useCallback(
    (mediaId) => {
      const id = String(mediaId)

      if (viewerSource === 'gallery') {
        setGalleryImages((current) =>
          current.filter((item) => String(item._id) !== id),
        )
      }

      setViewerMedia((current) => {
        const deletedIndex = current.findIndex(
          (item) => String(item._id) === id,
        )

        if (deletedIndex === -1) return current

        const updated = current.filter(
          (item) => String(item._id) !== id,
        )

        setViewerIndex((currentIndex) => {
          if (!updated.length) {
            setViewerOpen(false)
            return 0
          }

          if (deletedIndex < currentIndex) return currentIndex - 1
          if (currentIndex >= updated.length) return updated.length - 1

          return currentIndex
        })

        return updated
      })

      if (viewerSource === 'private' || viewerSource === 'recycle-bin') {
        onViewerMediaRemoved?.(id)
      }
    },
    [viewerSource, onViewerMediaRemoved],
  )

  const currentMedia = viewerMedia[viewerIndex] ?? null

  return (
    <MediaContext.Provider
      value={{
        viewerOpen,
        viewerMedia,
        viewerIndex,
        viewerSource,
        currentMedia,
        openViewer,
        closeViewer,
        syncMediaItems,
        nextMedia,
        previousMedia,
        removeViewerMedia,
        galleryImages,
        setGalleryImages,
      }}
    >
      {children}
    </MediaContext.Provider>
  )
}

export function useMedia() {
  const context = useContext(MediaContext)

  if (!context) {
    throw new Error('useMedia must be used inside MediaProvider')
  }

  return context
}
