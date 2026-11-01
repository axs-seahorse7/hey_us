import "/CollageCard.css"

function CollageCard({ media = [], onClick }) {
  if (!media.length) return null

  const visibleMedia = media.slice(0, 4)
  const remainingCount = Math.max(media.length - 4, 0)

  return (
    <article
      className="collage-card"
      onClick={() => onClick?.(media)}
    >
      <div className={`collage-card__grid collage-card__grid--${visibleMedia.length}`}>
        {visibleMedia.map((item, index) => (
          <div className="collage-card__item" key={item._id}>
            {item.contentType?.startsWith('image/') ? (
              <img
                src={item.url}
                alt={item.fileName}
                className="collage-card__image"
              />
            ) : (
              <div className="collage-card__file">📄</div>
            )}

            {index === visibleMedia.length - 1 && remainingCount > 0 && (
              <span className="collage-card__remaining">
                +{remainingCount}
              </span>
            )}
          </div>
        ))}
      </div>
    </article>
  )
}

export default CollageCard