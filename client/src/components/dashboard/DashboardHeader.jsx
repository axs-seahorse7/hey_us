import { NavLink } from 'react-router-dom'
import "./Navbar.css"

const navItems = [
  {
    name: 'Gallery',
    path: '/gallery',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    )
  },
  {
    name: 'Folders',
    path: '/folders',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
      </svg>
    )
  },
  {
    name: 'Moments',
    path: '/moments',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  },
  {
    name: 'Favorites',
    path: '/favorites',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20.8 8.6c0 5.4-8.8 10.2-8.8 10.2S3.2 14 3.2 8.6A4.6 4.6 0 0 1 12 6.1a4.6 4.6 0 0 1 8.8 2.5Z" />
      </svg>
    )
  }
]

function Navbar() {
  return (
    <header className="navbar-wrapper">
      <nav className="navbar">
        <NavLink to="/gallery" className="navbar-logo">
          <span>♡</span>
        </NavLink>

        <div className="navbar-links">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `navbar-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="navbar-icon">{item.icon}</span>
              <span>{item.name}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  )
}

export default Navbar