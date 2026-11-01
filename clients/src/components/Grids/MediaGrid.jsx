import { useNavigate } from 'react-router-dom'
import { Flex, Masonry, Typography } from 'antd'
import MediaCard from '../Cards/MediaCard'
import './MediaGrid.css'

// Pinterest-style: more columns on wider screens, every card keeps its own height
const COLUMNS = { xs: 2, sm: 3, md: 4, lg: 5, xxl: 6 }
const GUTTER = { xs: 8, sm: 12, md: 14 }

function MediaGrid({ groupedMedia = [], onMediaClick }) {
  const navigate = useNavigate()

  if (!groupedMedia.length) {
    return null
  }

  function handleClick(data) {
    if (onMediaClick) {
      onMediaClick(data)
    } else {
      navigate(`/gallery/${data._id}`)
    }
  }

  return (
    <Flex vertical gap={32} className="pin-groups">
      {groupedMedia.map(({ date, images, formattedDate }) => (
        <Flex vertical gap={14} key={date}>
          <Typography.Title level={5} className="pin-date">
            {formattedDate}
          </Typography.Title>

          <Masonry
            fresh /* re-balance columns as images finish loading */
            columns={COLUMNS}
            gutter={GUTTER}
            items={images.map((item) => ({ key: item._id, data: item }))}
            itemRender={({ data }) => (
              <MediaCard media={data} onClick={() => handleClick(data)} />
            )}
          />
        </Flex>
      ))}
    </Flex>
  )
}

export default MediaGrid