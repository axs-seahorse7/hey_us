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

  const syncMediaItems = useCallback((updatedItems = []) => {
    if (!updatedItems.length) return;

    const updatesById = new Map(
      updatedItems.map((item) => [String(item._id), item])
    );

    const mergeUpdates = (currentItems) =>
      currentItems.map((item) => {
        const updated = updatesById.get(String(item._id));

        return updated ? { ...item, ...updated } : item;
      });

    setGalleryImages(mergeUpdates);
    setViewerMedia(mergeUpdates);
  }, []);

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
    const id = String(mediaId);

    // Remove from the gallery grid data.
    setGalleryImages((currentMedia) =>
      currentMedia.filter(
        (item) => String(item._id) !== id
      )
    );

    // Remove from the currently opened viewer.
    setViewerMedia((currentMedia) => {
      const deletedIndex = currentMedia.findIndex(
        (item) => String(item._id) === id
      );

      if (deletedIndex === -1) return currentMedia;

      const updatedMedia = currentMedia.filter(
        (item) => String(item._id) !== id
      );

      setViewerIndex((currentIndex) => {
        if (updatedMedia.length === 0) {
          setViewerOpen(false);
          return 0;
        }

        if (deletedIndex < currentIndex) {
          return currentIndex - 1;
        }

        if (currentIndex >= updatedMedia.length) {
          return updatedMedia.length - 1;
        }

        return currentIndex;
      });

      return updatedMedia;
    });
  }, []);

 

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