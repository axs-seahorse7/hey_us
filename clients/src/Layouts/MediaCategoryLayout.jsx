
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Empty, Result, Skeleton, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import api from '../services/api'
import MediaGrid from '../components/Grids/MediaGrid'
import { useMedia } from '../context/MediaContext'
import { getMediaCategory } from '../utils/mediaType'
import './GalleryLayout.css'

const { Title, Text } = Typography

function toLocalDateKey(value) {
  const date = value ? new Date(value) : new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.getTime() === today.getTime()) return 'Today'
  if (date.getTime() === yesterday.getTime()) return 'Yesterday'

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function groupMediaByDate(media) {
  const groups = {}

  media.forEach((item) => {
    const key = toLocalDateKey(item.createdAt)
    ;(groups[key] ||= []).push(item)
  })

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, images]) => ({
      date,
      images,
      formattedDate: formatDate(date),
    }))
}

function MediaCategoryLayout({ category, title }) {
  const navigate = useNavigate()
  const { openViewer } = useMedia()

  const [media, setMedia] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMedia = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await api.get('/gallery')
      setMedia(response.data.media || [])
    } catch (err) {
      console.error(`[${title.toUpperCase()} LOAD FAILED]`, err)
      setError(`Unable to load ${title.toLowerCase()}. Please check your connection.`)
    } finally {
      setIsLoading(false)
    }
  }, [title])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  const categoryMedia = useMemo(
    () => media.filter((item) => getMediaCategory(item) === category),
    [media, category]
  )

  const groupedMedia = useMemo(
    () => groupMediaByDate(categoryMedia),
    [categoryMedia]
  )

  let content

  if (isLoading) {
    content = (
      <div className="gallery-skeleton">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton.Node key={i} active className="gallery-skeleton__tile">
            <span />
          </Skeleton.Node>
        ))}
      </div>
    )
  } else if (error) {
    content = (
      <div className="gallery-state glass-card">
        <Result
          status="error"
          title={`Couldn't load ${title.toLowerCase()}`}
          subTitle={error}
          extra={
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={fetchMedia}
            >
              Try again
            </Button>
          }
        />
      </div>
    )
  } else if (categoryMedia.length === 0) {
    content = (
      <div className="gallery-state glass-card">
        <Empty
          description={
            <div>
              <Title level={4} style={{ marginBottom: 4 }}>
                No {title.toLowerCase()} found
              </Title>
              <Text type="secondary">
                Your {title.toLowerCase()} will appear here.
              </Text>
            </div>
          }
        />
      </div>
    )
  } else {
    content = (
      <MediaGrid
        groupedMedia={groupedMedia}
        onMediaClick={(selectedMedia) => {
          openViewer(selectedMedia, categoryMedia)
          navigate(`/gallery/${selectedMedia._id}`)
        }}
      />
    )
  }

  return (
    <section className="gallery-layout">
      <div className="gallery-layout__bg" aria-hidden="true" />

      <div className="gallery-content">
        {content}
      </div>
    </section>
  )
}

export default MediaCategoryLayout
