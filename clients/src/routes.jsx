import { createBrowserRouter } from 'react-router-dom'
import MainLayout from './Layouts/MainLayout'
import GalleryLayout from './Layouts/GalleryLayout'
import FoldersLayout from './Layouts/FoldersLayout'
import MomentsLayout from './Layouts/MomentsLayout'
import FavoritesLayout from './Layouts/FavoritesLayout'
import Login from './Authentication/Login/Login'
import FolderView from './Layouts/FolderView'
import ProtectedRoute from './Authentication/ProtectedRoute'
import MediaCategoryLayout from './Layouts/MediaCategoryLayout'

const router = createBrowserRouter([
  {path: '/', element: <Login />},
  {
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/gallery', element: <GalleryLayout /> },
      { path: '/gallery/:id', element: <GalleryLayout /> },
      { path: '/folders', element: <FoldersLayout /> },
      { path: '/folders/:folderId', element: <FolderView />},
      { path: '/moments', element: <MomentsLayout /> },
      { path: '/favorites', element: <FavoritesLayout /> },
      { path: '/videos', element: <MediaCategoryLayout category="videos" title="Videos" /> },
      { path: '/notes', element: <MediaCategoryLayout category="notes" title="Notes" /> },
      { path: '/files', element: <MediaCategoryLayout category="files" title="Files" /> },
    ]
  }
])

export default router