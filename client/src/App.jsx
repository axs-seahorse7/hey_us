import React, { useCallback, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { withAuth } from './hoc/withAuth.jsx';
import AuthPage from './pages/AuthPage.jsx';
import CoupleDashboard from './pages/CoupleDashboard.jsx';
import FolderView from './components/dashboard/FolderView.jsx';
import MediaView from './components/dashboard/MediaView.jsx';
import Gallery from './pages/Gallery.jsx';

const ProtectedCoupleDashboard = withAuth(CoupleDashboard);

export default function App() {
  const [hasSession, setHasSession] = useState(
    () => Boolean(localStorage.getItem('dear-us-token'))
  );

  const signOut = useCallback(() => {
    localStorage.removeItem('dear-us-token');
    localStorage.removeItem('dear-us-user');
    setHasSession(false);
  }, []);

  if (!hasSession) {
    return (
      <AuthPage
        onAuthenticated={() => setHasSession(true)}
      />
    );
  }

  return (
    <Routes>
      <Route path="/gallery/files" element={ <ProtectedCoupleDashboard onUnauthorized={signOut} onSignOut={signOut}/>}/>

      <Route path="/gallery/folders/:folderId" element={<Gallery/>} />
      <Route path="/gallery/media/:mediaId" element={<MediaView />} />
      <Route path="*" element={<Navigate to="/gallery/files" replace />} />
    </Routes>
  );
}