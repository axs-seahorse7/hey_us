import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Flex, Image, Tag, Typography } from 'antd'
import { FileOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import './CarouselCard.css'

function CarouselCard({ media = [], onClick }) {
  const trackRef = useRef(null)
  const frameRef = useRef(0)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Swiping is handled by the browser (native scroll-snap = smooth, GPU-driven).
  // We only read the position, at most once per frame, to update the counter.
  const handleScroll = useCallback(() => {
    if (frameRef.current) return

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0

      const track = trackRef.current
      if (!track || !track.clientWidth) return

      setCurrentIndex(Math.round(track.scrollLeft / track.clientWidth))
    })
  }, [])

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  if (!media.length) return null

  const currentMedia = media[Math.min(currentIndex, media.length - 1)]

  function scrollToIndex(index) {
    const track = trackRef.current
    if (!track) return

    track.scrollTo({ left: track.clientWidth * index, behavior: 'smooth' })
  }

  function showPrevious(event) {
    event.stopPropagation()
    scrollToIndex(currentIndex === 0 ? media.length - 1 : currentIndex - 1)
  }

  function showNext(event) {
    event.stopPropagation()
    scrollToIndex(currentIndex === media.length - 1 ? 0 : currentIndex + 1)
  }

  return (
    <Card
      hoverable
      variant="borderless"
      className="carousel-card"
      styles={{ body: { padding: 0 } }}
      onClick={() => onClick?.(currentMedia)}
    >
      <div className="carousel-card__media">
        <Flex ref={trackRef} className="carousel-card__track" onScroll={handleScroll}>
          {media.map((item) => (
            <Flex key={item._id} align="center" justify="center" className="carousel-card__slide">
              {item.contentType?.startsWith('image/') ? (
                <Image
                  src={item.url}
                  alt={item.fileName}
                  preview={false}
                  rootClassName="carousel-card__image"
                />
              ) : (
                <FileOutlined className="carousel-card__file" />
              )}
            </Flex>
          ))}
        </Flex>

        {media.length > 1 && (
          <>
            <Button
              shape="circle"
              icon={<LeftOutlined />}
              className="carousel-card__button carousel-card__button--previous"
              onClick={showPrevious}
              aria-label="Previous image"
            />
            <Button
              shape="circle"
              icon={<RightOutlined />}
              className="carousel-card__button carousel-card__button--next"
              onClick={showNext}
              aria-label="Next image"
            />
            <Tag bordered={false} className="carousel-card__counter">
              {currentIndex + 1} / {media.length}
            </Tag>
          </>
        )}
      </div>

      <Flex className="carousel-card__info" align="center">
        <Typography.Text ellipsis>{currentMedia.fileName}</Typography.Text>
      </Flex>
    </Card>
  )
}

export default CarouselCard