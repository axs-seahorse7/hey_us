
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Empty, Result, Skeleton, Typography } from 'antd'
import { HeartOutlined, ReloadOutlined } from '@ant-design/icons'

import { getFavoriteMedia } from '../services/gallery.service'
import { useMedia } from '../context/MediaContext'
import MediaGrid from '../components/Grids/MediaGrid'

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

function FavoritesLayout() {
  const navigate = useNavigate()
  const { openViewer } = useMedia()

  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchFavorites = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const favorites = await getFavoriteMedia()
      setMedia(favorites)
    } catch (err) {
      console.error('Failed to load favourites:', err)
      setError('Unable to load favourites. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  const groupedMedia = useMemo(
    () => groupMediaByDate(media),
    [media]
  )

  let content

  if (loading) {
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
          title="Couldn't load favourites"
          subTitle={error}
          extra={
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={fetchFavorites}
            >
              Try again
            </Button>
          }
        />
      </div>
    )
  } else if (media.length === 0) {
    content = (
      <div className="gallery-state glass-card">
        <Empty
          image={<HeartOutlined className="gallery-state__icon" />}
          description={
            <div>
              <Title level={4} style={{ marginBottom: 4 }}>
                No favourites yet
              </Title>
              <Text type="secondary">
                Open any media and tap the heart to save it here.
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
          openViewer(selectedMedia, media)
          navigate(`/gallery/${selectedMedia._id}`, {
            state: { from: '/favorites' },
          })
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

export default FavoritesLayout
