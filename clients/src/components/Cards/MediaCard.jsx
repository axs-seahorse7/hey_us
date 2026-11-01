import { Card, Flex, Image, Typography } from 'antd'
import { FileOutlined } from '@ant-design/icons'
import './MediaCard.css'

function MediaCard({ media, onClick }) {
  const isImage = media.contentType?.startsWith('image/')

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
          {/* natural height -> masonry card heights differ per photo */}
          <Image
            src={media.url}
            alt={media.fileName}
            preview={false}
            rootClassName="pin-card__image"
          />

          {media.fileName && (
            <Flex className="pin-card__caption" align="center">
              <Typography.Text ellipsis className="pin-card__caption-text">
                {media.fileName}
              </Typography.Text>
            </Flex>
          )}
        </>
      ) : (
        <Flex vertical align="center" justify="center" gap={10} className="pin-card__file">
          <FileOutlined className="pin-card__file-icon" />
          <Typography.Text ellipsis className="pin-card__file-name">
            {media.fileName}
          </Typography.Text>
        </Flex>
      )}
    </Card>
  )
}

export default MediaCard