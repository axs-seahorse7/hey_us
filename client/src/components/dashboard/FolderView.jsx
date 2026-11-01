import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getFolderMedia,
  createUploadUrl,
  uploadFileToS3,
  completeUpload,
} from '../services/media.service'
import './FolderView.css'
import { useMedia } from '../context/MediaContext'

import MediaGrid from '../components/Grids/MediaGrid'

function FolderView() {
  const { folderId } = useParams()
  const navigate = useNavigate()
  const { openViewer } = useMedia()

  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [folder, setFolder] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    async function loadMedia() {
      try {
        setLoading(true)
        setError('')

        const data = await getFolderMedia(folderId)

        setFolder(data.folder)
        setMedia(data.media ?? [])
      } catch (error) {
        console.error('Failed to load folder media:', error)
        setError(error.message || 'Failed to load folder media.')
      } finally {
        setLoading(false)
      }
    }

    if (folderId) {
      loadMedia()
    }
  }, [folderId])

  async function handleUpload(event) {
    const file = event.target.files?.[0]

    if (!file) return

    try {
        setUploading(true)
        setError('')

        // Step 1: Get Upload URL
        let uploadData;
        try {
            uploadData = await createUploadUrl({
            fileName: file.name,
            contentType: file.type,
            size: file.size,
            folderId,
            })
        } catch (e) {
            throw new Error(`Failed to initialize upload: ${e.message}`)
        }

        // Step 2: Upload to S3
        try {
            await uploadFileToS3(uploadData.uploadUrl, file)
        } catch (e) {
            throw new Error(`S3 transfer failed: ${e.message}`)
        }

        // Step 3: Complete upload on server
        try {
            await completeUpload(uploadData.mediaId)
        } catch (e) {
            throw new Error(`Failed to finalize upload: ${e.message}`)
        }

        const data = await getFolderMedia(folderId)

        setFolder(data.folder)
        setMedia(data.media ?? [])
    } catch (error) {
        console.error('Upload failed:', error)
        setError(error.message || 'Failed to upload file.')
    } finally {
        setUploading(false)
        event.target.value = ''
    }
    }

  const groupImagesByDate = (mediaList) => {
    const groups = {};

    mediaList.forEach((image) => {
      const date = image.createdAt ? new Date(image.createdAt) : new Date();
      const dateString = date.toISOString().split('T')[0];

      if (!groups[dateString]) {
        groups[dateString] = [];
      }
      groups[dateString].push(image);
    });

    const formatDate = (dateString) => {
      const date = new Date(dateString);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      if (checkDate.getTime() === today.getTime()) return 'Today';
      if (checkDate.getTime() === yesterday.getTime()) return 'Yesterday';

      return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
    };

    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, imgs]) => ({
        date,
        images: imgs,
        formattedDate: formatDate(date),
      }));
  };

  if (loading) {
    return <div className="folder-view">Loading...</div>
  }

  if (error) {
    return (
      <div className="folder-view">
        <button onClick={() => navigate('/folders')}>
          ← Back to folders
        </button>

        <p>{error}</p>
      </div>
    )
  }

  const groupedMedia = groupImagesByDate(media);

  return (
    <section className="folder-view">
      <button
        className="folder-view__back"
        onClick={() => navigate('/folders')}
      >
        ← Back to folders
      </button>

      <div className="folder-view__header">
        <h1>{folder?.name ?? 'Folder'}</h1>
        <p>{media.length} items</p>
      </div>

      <div className="folder-view__actions">
        <label className="folder-upload-button">
            {uploading ? 'Uploading...' : '+ Upload'}
            <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            hidden
            />
        </label>
      </div>

      {media.length === 0 ? (
        <div className="folder-view__empty">
          <h2>Nothing here</h2>
          <p>Upload some memories to this folder.</p>
        </div>
      ) : (
        <MediaGrid
          groupedMedia={groupedMedia}
          onMediaClick={(selectedMedia) => openViewer(selectedMedia, media)}
        />
      )}
    </section>
  )
}

export default FolderView