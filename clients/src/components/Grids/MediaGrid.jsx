import { useNavigate } from 'react-router-dom'
import { Flex, Grid, Masonry, Typography } from 'antd'
import MediaCard from '../Cards/MediaCard'
import './MediaGrid.css'

const COLUMNS = { xs: 2, sm: 3, md: 4, lg: 5, xxl: 6 }
const GUTTER = { xs: 8, sm: 12, md: 14 }

function MediaGrid({
  groupedMedia = [],
  onMediaClick,
  layout = 'masonry',
}) {
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint() // must stay above the early return

  const columnCount = screens.xxl ? 6 : screens.lg ? 5 : screens.md ? 4 : screens.sm ? 3 : 2
  const gridGap = screens.sm ? 12 : 8

  if (!groupedMedia.length) return null

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

          {layout === 'grid' ? (
            <div
              className="pin-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                gap: gridGap,
                width: '100%',
                alignItems: 'start',
              }}
            >
              {images.map((item) => (
                <div key={item._id} style={{ minWidth: 0 }}>
                  <MediaCard media={item} onClick={() => handleClick(item)} />
                </div>
              ))}
            </div>
          ) : (
            <Masonry
              fresh
              columns={COLUMNS}
              gutter={GUTTER}
              items={images.map((item) => ({ key: item._id, data: item }))}
              itemRender={({ data }) => (
                <MediaCard media={data} onClick={() => handleClick(data)} />
              )}
            />
          )}
        </Flex>
      ))}
    </Flex>
  )
}

export default MediaGrid