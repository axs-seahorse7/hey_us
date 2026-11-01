import React, { useState, useEffect } from 'react';
import {useLocation, useParams, useNavigate} from 'react-router-dom';

import FilesView from '../components/dashboard/FilesView.jsx';
import FolderView from '../components/dashboard/FolderView.jsx';

import DashboardHeader from '../components/dashboard/DashboardHeader.jsx';
import FloatingActions from '../components/dashboard/FloatingActions.jsx';
import GalleryCategoryNav from '../components/dashboard/GalleryCategoryNav.jsx';
import MemoryGrid from '../components/dashboard/MemoryGrid.jsx';
import { gallerySections } from '../data/memorySamples.js';
import { getFolders, createFolder } from '../../../clients/src/services/folder.service.js';

export default function CoupleDashboard({ user, onSignOut }) {
  const [activeTab, setActiveTab] = useState('gallery');
  const [creatorOpen, setCreatorOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { folderId } = useParams();

  const [mediaView, setMediaView] = useState(location.pathname.startsWith('/gallery/files')? 'Files': 'Photos');

  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState(null);


  useEffect(() => {
    if (location.pathname.startsWith('/gallery/files')) {
      setMediaView('Files');
    } else {
      setMediaView('Photos');
    }
  }, [location.pathname]);

  useEffect(() => {
    async function loadFolders() {
      try {
        setFoldersLoading(true);
        setFoldersError(null);

        const data = await getFolders();

        setFolders(data.folders);
      } catch (error) {
        
        console.error('Failed to load folders:', error.message);

        setFoldersError(
          error.message || 'Failed to load folders.',
        );
      } finally {
        setFoldersLoading(false);
      }
    }

    if (activeTab === 'gallery' && mediaView === 'Files') {
      loadFolders();
    }
  }, [activeTab, mediaView]);

  const handleCreateFolder = async (name) => {
    try {
      const data = await createFolder(name);

      setFolders((currentFolders) => [
        data.folder,
        ...currentFolders,
      ]);

      return data.folder;
    } catch (error) {
      console.error('Failed to create folder:', error);

      throw error;
    }
  };

  const handleUpdateFolders = (updatedFolders) => {
    setFolders(updatedFolders);
  };

  if (folderId) {
    return (
      <main className="dashboard-shell">
        <div className="dashboard-shell__content">
          <DashboardHeader
            user={user}
            onSignOut={onSignOut}
          />

          <FolderView />
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <div className="dashboard-shell__content">
        <DashboardHeader
          user={user}
          onSignOut={onSignOut}
          mediaView={mediaView}
        />

        <GalleryCategoryNav
          active={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'gallery' && mediaView === 'Photos' && (
          <MemoryGrid sections={gallerySections} />
        )}

        {activeTab === 'gallery' && mediaView === 'Files' && (
          <div style={{ paddingTop: '1rem' }}>
            {foldersLoading && (
              <div className="gallery-loading">
                Loading folders...
              </div>
            )}

            {foldersError && (
              <div
                className="gallery-error"
                role="alert"
              >
                <p>{foldersError}</p>

                <button
                  type="button"
                  onClick={() => setMediaView('Photos')}
                >
                  Go back
                </button>
              </div>
            )}

            {!foldersLoading && !foldersError && (
              <FilesView
                folders={folders}
                onCreateFolder={handleCreateFolder}
                onUpdateFolders={handleUpdateFolders}
              />
            )}
          </div>
        )}

        {activeTab !== 'gallery' && (
          <MemoryGrid sections={gallerySections} />
        )}
      </div>

      {creatorOpen && (
        <section
          className="memory-creator"
          aria-label="Add a memory"
        >
          <p>Add a memory</p>

          <div>
            <button type="button">Photo</button>
            <button type="button">Video</button>
            <button type="button">Voice note</button>
          </div>
        </section>
      )}

      <FloatingActions
        onAddMemory={() =>
          setCreatorOpen((open) => !open)
        }
      />
    </main>
  );
}