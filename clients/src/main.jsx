import React from 'react'
import ReactDOM from 'react-dom/client'
import { MediaProvider } from './context/MediaContext'
import { AuthProvider } from './Authentication/Context/AuthContext'
import App from './App'
import { PrivateAlbumProvider } from './context/PrivateAlbumContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <PrivateAlbumProvider>
        <MediaProvider>
          <App />
        </MediaProvider>
      </PrivateAlbumProvider>
    </AuthProvider>
  </React.StrictMode>,
);