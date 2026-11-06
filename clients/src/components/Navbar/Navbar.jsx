import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Button, Col, Drawer, Flex, Row } from 'antd'
import {
  CameraFilled,
  ClockCircleFilled,
  DeleteFilled,
  FolderFilled,
  HeartFilled,
  LockFilled,
  MenuOutlined,
  PictureFilled,
  PlaySquareFilled,
  SettingFilled,
  FileTextFilled,
  FileFilled,
} from '@ant-design/icons'
import './Navbar.css'

// Main tabs shown in the bottom bar (`from` / `to` = gradient colours of the icon)
const navItems = [
  { name: 'Gallery', path: '/gallery', icon: <PictureFilled />, from: '#5ac8fa', to: '#007aff' },
  { name: 'Folders', path: '/folders', icon: <FolderFilled />, from: '#ffd166', to: '#ff9500' },
  { name: 'Moments', path: '/moments', icon: <ClockCircleFilled />, from: '#5eead4', to: '#0f9d8a' },
]

const MENU_COLORS = { from: '#9aa3b5', to: '#4f5b73' }
const LOGO_COLORS = { from: '#ff9ec7', to: '#ff375f' }

// Buttons shown in the menu sheet — change the paths to match your routes.
// `from` / `to` are the gradient colours of each colourful icon.
const menuItems = [
  { name: 'Videos', path: '/videos', icon: <PlaySquareFilled />, from: '#ff7a8a', to: '#ff2d55' },
  { name: 'Notes', path: '/notes', icon: <FileTextFilled />, from: '#b794f6', to: '#6d3fd6' },
  { name: 'Files', path: '/files', icon: <FileFilled />, from: '#5eead4', to: '#0f9d8a' },
  { name: 'Favourites', path: '/favorites', icon: <HeartFilled />, from: '#ff9ec7', to: '#e0338f' },
  { name: 'Private album', path: '/private', icon: <LockFilled />, from: '#b794f6', to: '#6d3fd6' },
  { name: 'Recycle bin', path: '/recycle-bin', icon: <DeleteFilled />, from: '#6ee7a0', to: '#1fa25a' },
  { name: 'Settings', path: '/settings', icon: <SettingFilled />, from: '#9a9cff', to: '#4f46e5' },
]

function Navbar() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  function handleMenuItemClick(path) {
    setMenuOpen(false)
    navigate(path)
  }

  return (
    <>
      <header className="navbar-wrapper">
        <nav className="navbar" aria-label="Main navigation">
          <NavLink
            to="/gallery"
            className="navbar-logo"
            aria-label="Home"
            style={{ '--from': LOGO_COLORS.from, '--to': LOGO_COLORS.to }}
          >
            <HeartFilled />
          </NavLink>

          <Flex align="center" gap={4} className="navbar-links">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
              >
                <span className="navbar-icon" style={{ '--from': item.from, '--to': item.to }}>
                  {item.icon}
                </span>
                <span className="navbar-label">{item.name}</span>
              </NavLink>
            ))}

            <Button
              type="text"
              className={`navbar-link navbar-link--menu${menuOpen ? ' active' : ''}`}
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
            >
              <span
                className="navbar-icon"
                style={{ '--from': MENU_COLORS.from, '--to': MENU_COLORS.to }}
              >
                <MenuOutlined />
              </span>
              <span className="navbar-label">Menu</span>
            </Button>
          </Flex>
        </nav>
      </header>

      {/* Bottom sheet menu */}
      <Drawer
        open={menuOpen}
        placement="bottom"
        closable={false}
        onClose={() => setMenuOpen(false)}
        rootClassName="nav-sheet"
        aria-label="Menu"
      >
        <Flex justify="center" className="nav-sheet__handle-row">
          <span className="nav-sheet__handle" />
        </Flex>

        <Row gutter={[0, 20]}>
          {menuItems.map((item) => (
            <Col key={item.path} span={6}>
              <Button
                type="text"
                className="nav-sheet__item"
                onClick={() => handleMenuItemClick(item.path)}
              >
                <Flex vertical align="center" gap={8}>
                  <span
                    className="nav-sheet__circle"
                    style={{ '--from': item.from, '--to': item.to }}
                  >
                    {item.icon}
                  </span>
                  <span className="nav-sheet__label">{item.name}</span>
                </Flex>
              </Button>
            </Col>
          ))}
        </Row>
      </Drawer>
    </>
  )
}

export default Navbar