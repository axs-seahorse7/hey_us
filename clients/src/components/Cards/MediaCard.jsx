
import { useEffect, useState } from 'react'
import { Card, Flex, Image, Typography } from 'antd'
import { FileOutlined } from '@ant-design/icons'
import { useAuth } from '../../Authentication/Context/AuthContext'
import { getOrFetchThumbnail } from '../../services/mediaCache.service'
import './MediaCard.css'

function MediaCard({ media, onClick }) {
  const { user } = useAuth()
  const userId = user?.user?._id

  const isImage = media.contentType?.startsWith('image/')

  const [thumbnailSrc, setThumbnailSrc] = useState(null)

  useEffect(() => {
    if (!isImage || !userId || !media._id) {
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
      {isImage ? (
        <>
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
          <FileOutlined className="pin-card__file-icon" />
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
