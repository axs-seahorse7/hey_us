import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Flex, Grid, Masonry, Typography, message } from 'antd'
import {
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  ShareAltOutlined,
} from '@ant-design/icons'
import { useMedia } from '../../context/MediaContext'

import MediaCard from '../Cards/MediaCard'
import './MediaGrid.css'

const COLUMNS = { xs: 2, sm: 3, md: 4, lg: 5, xxl: 6 }
const GUTTER = { xs: 8, sm: 12, md: 14 }

function MediaGrid({ groupedMedia = [], onMediaClick, layout = 'masonry' }) {
  // ---- ALL hooks first, before any early return ----
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const { selectedMediaIds, clearMediaSelection } = useMedia()
  const lastCountRef = useRef(0)

  const hasSelection = selectedMediaIds.size > 0
  if (hasSelection) lastCountRef.current = selectedMediaIds.size
  const displayCount = hasSelection ? selectedMediaIds.size : lastCountRef.current

  const columnCount = screens.xxl ? 6 : screens.lg ? 5 : screens.md ? 4 : screens.sm ? 3 : 2
  const gridGap = screens.sm ? 12 : 8

  function handleClick(data) {
    if (onMediaClick) onMediaClick(data)
    else navigate(`/gallery/${data._id}`)
  }

  return (
    <>
      {groupedMedia.length > 0 && (
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
      )}

      
      
      {/* Compact iOS Glass Selection Dock */}
      <div
        className={`bulk-selection-toolbar ${
          hasSelection ? 'bulk-selection-toolbar--visible' : ''
        }`}
        role="toolbar"
        aria-label="Bulk actions"
        aria-hidden={!hasSelection}
      >
        {/* Floating selection count */}
        <div className="bulk-toolbar__count">
          {displayCount}
        </div>

        {/* Close selection */}
        <Button
          type="text"
          className="bulk-toolbar__close"
          icon={<CloseOutlined />}
          onClick={clearMediaSelection}
          aria-label="Clear selection"
        />

        {/* Actions */}
        <div className="bulk-toolbar__actions">
          <Button
            className="bulk-action bulk-action--delete"
            icon={<DeleteOutlined />}
            onClick={() => message.info('Bulk delete is coming next.')}
          >
            Delete
          </Button>

          <Button
            className="bulk-action"
            icon={<FolderOpenOutlined />}
            onClick={() => message.info('Bulk move is coming next.')}
          >
            Move
          </Button>

          <Button
            className="bulk-action"
            icon={<CopyOutlined />}
            onClick={() => message.info('Bulk copy is coming next.')}
          >
            Copy
          </Button>

          <Button
            className="bulk-action bulk-action--share"
            icon={<ShareAltOutlined />}
            onClick={() => message.info('Bulk share is coming next.')}
          >
            Share
          </Button>
        </div>
      </div>



    </>
  )
}

export default MediaGrid