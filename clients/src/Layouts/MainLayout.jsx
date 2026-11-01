import { Outlet } from 'react-router-dom'
import Navbar from "../components/Navbar/Navbar"
import MediaViewer from './MediaViewer'

function MainLayout() {
  return (
    <>
      <Navbar />

      <main>
        <Outlet />
      </main>

      <MediaViewer />
    </>
  )
}

export default MainLayout