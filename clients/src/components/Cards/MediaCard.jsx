
import { useEffect, useRef, useState } from 'react'
import { Card, Flex, Image, Typography } from 'antd'
import { getFileIcon } from '../../utils/fileIcon'
import {
  CustomerServiceOutlined,
  PlayCircleFilled,
} from '@ant-design/icons'
import { useAuth } from '../../Authentication/Context/AuthContext'
import { getOrFetchThumbnail } from '../../services/mediaCache.service'
import { getMediaType } from '../../utils/mediaType'
import { useMedia } from '../../context/MediaContext'
import './MediaCard.css'
function MediaCard({ media, onClick }) {
  const { user } = useAuth()
  const userId = user?.user?._id

  const mediaType = getMediaType(media)
  const isImage = mediaType === 'image' || mediaType === 'raw'
  const hasThumbnail = isImage || mediaType === 'video'

  const [thumbnailSrc, setThumbnailSrc] = useState(null)

  const {
    isMediaSelected,
    toggleMediaSelection,
    selectedMediaIds,
  } = useMedia()

  const isSelected = isMediaSelected(media._id)
  const selectionMode = selectedMediaIds.size > 0

  const longPressTimer = useRef(null)
  const didLongPress = useRef(false)

  // Load thumbnail
  useEffect(() => {
    if (!hasThumbnail || !userId || !media._id || !media.thumbnailUrl) {
      setThumbnailSrc(null)
      return
    }

    let active = true
    let objectUrl = null

    setThumbnailSrc(null)

    async function loadThumbnail() {
      try {
        const blob = media.isPrivate
          ? await fetch(media.thumbnailUrl).then((response) => {
              if (!response.ok) {
                throw new Error('Private thumbnail request failed')
              }
              return response.blob()
            })
          : await getOrFetchThumbnail(
              userId,
              String(media._id),
              media.thumbnailUrl,
            )

        if (!active) return

        objectUrl = URL.createObjectURL(blob)
        setThumbnailSrc(objectUrl)
      } catch (error) {
        console.warn('[THUMBNAIL LOAD FAILED]', media._id, error)
      }
    }

    loadThumbnail()

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [ userId, media._id, media.thumbnailUrl, media.isPrivate, hasThumbnail])

  // Clear long-press timer on unmount
  useEffect(() => {
    return () => clearTimeout(longPressTimer.current)
  }, [])

  // Long-press selection
  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    clearTimeout(longPressTimer.current)
    didLongPress.current = false

    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      if (!isSelected) {
        toggleMediaSelection(media._id)
      }
    }, 450)
  }

  function handlePointerEnd() {
    clearTimeout(longPressTimer.current)
  }

  // Prevent browser native image context menu
  function preventNativeMenu(event) {
    event.preventDefault()
    event.stopPropagation()
  }

  // Card click behavior
  function handleCardClick() {
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }

    if (selectionMode) {
      toggleMediaSelection(media._id)
      return
    }

    onClick?.(media)
  }

  // Keyboard accessibility
  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()

      if (selectionMode) {
        toggleMediaSelection(media._id)
      } else {
        onClick?.(media)
      }
    }
  }

  return (
    <Card
      hoverable
      variant="borderless"
      className={`pin-card ${isSelected ? 'pin-card--selected' : ''}`}
      styles={{ body: { padding: 0 } }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${media.fileName || 'media'}`}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onClick={handleCardClick}
      onContextMenu={preventNativeMenu}
      onDragStart={(event) => event.preventDefault()}
    >
      {/* Selection indicator */}
      {(selectionMode || isSelected) && (
        <div
          className={`pin-card__selection-indicator ${
            isSelected ? 'is-selected' : ''
          }`}
          role="checkbox"
          aria-checked={isSelected}
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation()
            toggleMediaSelection(media._id)
          }}
          onContextMenu={preventNativeMenu}
        >
          {isSelected ? '✓' : ''}
        </div>
      )}

      {/* Image and video preview */}
      {hasThumbnail ? (
        <>
          <div
            className="pin-card__media-preview"
            onContextMenu={preventNativeMenu}
          >
            {thumbnailSrc ? (
              <Image
                src={thumbnailSrc}
                alt={media.fileName}
                preview={false}
                rootClassName="pin-card__image"
                onContextMenu={preventNativeMenu}
                draggable={false}
              />
            ) : (
              <div className="pin-card__image-placeholder" />
            )}

            {mediaType === 'video' && (
              <div className="pin-card__video-play">
                <PlayCircleFilled />
              </div>
            )}
          </div>

          {media.fileName && (
            <Flex className="pin-card__caption" align="center">
              <Typography.Text
                ellipsis
                className="pin-card__caption-text"
              >
                {media.fileName}
              </Typography.Text>
            </Flex>
          )}
        </>
      ) : (
        /* Other file types */
        <Flex
          vertical
          align="center"
          justify="center"
          gap={10}
          className="pin-card__file"
        >
          {mediaType === 'audio' ? (
            <CustomerServiceOutlined className="pin-card__audio-icon" />
          ) : (() => {
            const fileConfig = getFileIcon(media.fileName)
            const FileIcon = fileConfig.icon

            return (
              <div
                className="pin-card__file-icon-wrapper"
                style={{ backgroundColor: fileConfig.bg }}
              >
                <FileIcon style={{ color: fileConfig.color }} />
              </div>
            )
          })()}

          <Typography.Text
            ellipsis
            className="pin-card__file-name"
          >
            {media.fileName}
          </Typography.Text>
        </Flex>
      )}
    </Card>
  )
}

export default MediaCard
