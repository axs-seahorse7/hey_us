import React from 'react'
import ReactDOM from 'react-dom/client'
import { MediaProvider } from './context/MediaContext'
import { AuthProvider } from './Authentication/Context/AuthContext'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <MediaProvider>
        <App />
      </MediaProvider>
    </AuthProvider>
  </React.StrictMode>,
)