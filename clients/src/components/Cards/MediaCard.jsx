
import { useEffect, useState } from 'react'
import { Card, Flex, Image, Typography } from 'antd'
import { getFileIcon } from '../../utils/fileIcon'
import {
  FileOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileZipOutlined,
  FileTextOutlined,
  CodeOutlined,
  CustomerServiceOutlined,
  PlayCircleFilled,
} from '@ant-design/icons'
import { useAuth } from '../../Authentication/Context/AuthContext'
import { getOrFetchThumbnail } from '../../services/mediaCache.service'
import { getMediaType } from '../../utils/mediaType'
import './MediaCard.css'


const RAW_EXTENSIONS = new Set([
  '.arw', '.cr2', '.cr3', '.nef',
  '.dng', '.raf', '.orf', '.rw2', '.pef',
]);

function isRawMedia(media) {
  const extension = media?.fileName
    ?.match(/\.[^.]+$/)?.[0]
    ?.toLowerCase();

  return RAW_EXTENSIONS.has(extension);
}

function MediaCard({ media, onClick }) {
  const { user } = useAuth()
  const userId = user?.user?._id

  const mediaType = getMediaType(media)
  const isImage = mediaType === 'image' || mediaType === 'raw'
  const hasThumbnail = isImage || mediaType === 'video'

  const [thumbnailSrc, setThumbnailSrc] = useState(null)

  useEffect(() => {
    if (!hasThumbnail || !userId || !media._id) {
      setThumbnailSrc(null)
      return
    }

    let active = true
    let objectUrl = null

    setThumbnailSrc(null)

    async function loadThumbnail() {
      try {
        const blob = await getOrFetchThumbnail(
          userId,
          String(media._id),
          media.thumbnailUrl,
        )

        if (!active) return

        objectUrl = URL.createObjectURL(blob)
        setThumbnailSrc(objectUrl)
      } catch (error) {
        console.warn(
          '[THUMBNAIL LOAD FAILED]',
          media._id,
          error,
        )
      }
    }

    if (!media.thumbnailUrl) {
      setThumbnailSrc(null);
      return;
    }
    
    loadThumbnail()

    return () => {
      active = false

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [
    userId,
    media._id,
    media.thumbnailUrl,
    isImage,
  ])

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick?.(media)
    }
  }

  return (
    <Card
      hoverable
      variant="borderless"
      className="pin-card"
      styles={{ body: { padding: 0 } }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${media.fileName || 'media'}`}
      onClick={() => onClick?.(media)}
      onKeyDown={handleKeyDown}
    >
      {hasThumbnail ? (
        <>
          <div className="pin-card__media-preview">
            {thumbnailSrc ? (
              <Image
                src={thumbnailSrc}
                alt={media.fileName}
                preview={false}
                rootClassName="pin-card__image"
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
