import { Outlet } from 'react-router-dom'
import Navbar from "../components/Navbar/Navbar"
import MediaViewer from './MediaViewer'
import PrivateAlbumSessionGuard from '../components/PrivateAlbumSessionGuard'

function MainLayout() {
  return (
    <>
      <Navbar />

      <main>
        <Outlet />
      </main>

      <PrivateAlbumSessionGuard />
      <MediaViewer />
    </>
  )
}

export default MainLayout