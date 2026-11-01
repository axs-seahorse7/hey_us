function FolderCard({ folder, onClick }) {
  return (
    <article
      className="folder-card"
      onClick={() => onClick?.(folder)}
    >
      <div className="folder-card__icon">📁</div>

      <div className="folder-card__info">
        <h3>{folder.name}</h3>
        <p>{folder.mediaCount ?? 0} items</p>
      </div>
    </article>
  )
}

export default FolderCard