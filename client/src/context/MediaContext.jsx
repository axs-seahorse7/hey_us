import { createContext, useCallback, useContext, useState } from 'react'

const MediaContext = createContext(null)

export function MediaProvider({ children }) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerMedia, setViewerMedia] = useState([])
  const [viewerIndex, setViewerIndex] = useState(0)
  const [galleryImages, setGalleryImages] = useState([])

  const openViewer = useCallback((media, mediaList = [media]) => {
    const index = mediaList.findIndex((item) => item._id === media._id)

    setViewerMedia(mediaList)
    setViewerIndex(index >= 0 ? index : 0)
    setViewerOpen(true)
  }, [])

  const closeViewer = useCallback(() => {
    setViewerOpen(false)
  }, [])

  const nextMedia = useCallback(() => {
    setViewerIndex((currentIndex) => {
      if (currentIndex >= viewerMedia.length - 1) return currentIndex
      return currentIndex + 1
    })
  }, [viewerMedia.length])

  const previousMedia = useCallback(() => {
    setViewerIndex((currentIndex) => {
      if (currentIndex <= 0) return currentIndex
      return currentIndex - 1
    })
  }, [viewerMedia.length])

  // Remove media from the currently opened viewer
  const removeViewerMedia = useCallback((mediaId) => {
    setViewerMedia((currentMedia) => {
      const deletedIndex = currentMedia.findIndex(
        (item) => item._id === mediaId,
      )

      if (deletedIndex === -1) {
        return currentMedia
      }

      const updatedMedia = currentMedia.filter(
        (item) => item._id !== mediaId,
      )

      setViewerIndex((currentIndex) => {
        if (updatedMedia.length === 0) {
          setViewerOpen(false)
          return 0
        }

        // If deleted image was before the current image,
        // move the index back by one.
        if (deletedIndex < currentIndex) {
          return currentIndex - 1
        }

        // If the deleted image was the last image,
        // move to the new last image.
        if (currentIndex >= updatedMedia.length) {
          return updatedMedia.length - 1
        }

        return currentIndex
      })

      return updatedMedia
    })
  }, [])

  const currentMedia = viewerMedia[viewerIndex] ?? null

  return (
    <MediaContext.Provider
      value={{
        viewerOpen,
        viewerMedia,
        viewerIndex,
        currentMedia,
        openViewer,
        closeViewer,
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