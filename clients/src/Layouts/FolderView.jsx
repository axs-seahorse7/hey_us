import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  ConfigProvider,
  Empty,
  Flex,
  Result,
  Skeleton,
  Typography,
  Upload,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  FolderOpenFilled,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  getFolderMedia,
  createUploadUrl,
  uploadFileToS3,
  completeUpload,
} from '../services/media.service'
import MediaGrid from '../components/Grids/MediaGrid'
import { useMedia } from '../context/MediaContext'
import './FolderView.css'


const RAW_EXTENSIONS = new Set([
  '.arw', '.cr2', '.cr3', '.nef',
  '.dng', '.raf', '.orf', '.rw2', '.pef',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.webm', '.mov', '.m4v',
  '.avi', '.mkv',
]);

function requiresThumbnail(media) {
  const extension = media.fileName
    ?.match(/\.[^.]+$/)?.[0]
    ?.toLowerCase();

  return (
    media.contentType?.startsWith('image/') ||
    RAW_EXTENSIONS.has(extension) ||
    media.contentType?.startsWith('video/') ||
    VIDEO_EXTENSIONS.has(extension)
  );
}

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Local-time YYYY-MM-DD (toISOString() would shift dates to UTC)
function toLocalDateKey(value) {
  const date = value ? new Date(value) : new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.getTime() === today.getTime()) return 'Today'
  if (date.getTime() === yesterday.getTime()) return 'Yesterday'

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function groupImagesByDate(mediaList) {
  const groups = {}

  mediaList.forEach((image) => {
    const key = toLocalDateKey(image.createdAt)
    ;(groups[key] ||= []).push(image)
  })

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, images]) => ({ date, images, formattedDate: formatDate(date) }))
}

function FolderView() {
  const { folderId } = useParams()
  const navigate = useNavigate()
  const [messageApi, contextHolder] = message.useMessage()

  const [media, setMedia] = useState([])
  const [folder, setFolder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploadingCount, setUploadingCount] = useState(0)

  const pendingUploads = useRef(0)
  const pendingThumbnailIds = useRef(new Set());
  const { openViewer } = useMedia()

  const fetchMedia = useCallback(async () => {
    const data = await getFolderMedia(folderId)
    setFolder(data.folder)
    setMedia(data.media ?? [])
  }, [folderId])

  const refreshPendingThumbnails = useCallback(
    async (mediaIds) => {
      const pendingIds = new Set(mediaIds);

      const maxAttempts = 30;
      const interval = 2000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await sleep(interval);

        try {
          const data = await getFolderMedia(folderId);
          const updatedMedia = data.media ?? [];

          setFolder(data.folder);
          setMedia(updatedMedia);

          for (const id of pendingIds) {
            const item = updatedMedia.find(
              (mediaItem) => String(mediaItem._id) === String(id)
            );

            if (
              item &&
              (!requiresThumbnail(item) || item.thumbnailObjectKey)
            ) {
              pendingIds.delete(id);
            }
          }

          console.log(
            `[FOLDER THUMBNAIL STATUS] ${pendingIds.size} remaining`
          );

          if (pendingIds.size === 0) {
            console.log('[FOLDER THUMBNAILS READY]');
            return;
          }
        } catch (error) {
          console.warn('[FOLDER THUMBNAIL REFRESH FAILED]', error);
        }
      }

      console.warn('[FOLDER THUMBNAIL TIMEOUT]', [...pendingIds]);
    },
    [folderId]
  );

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      await fetchMedia()
    } catch (err) {
      console.error('Failed to load folder media:', err)
      setError(err.message || 'Failed to load folder media.')
    } finally {
      setLoading(false)
    }
  }, [fetchMedia])

  useEffect(() => {
    if (folderId) loadMedia()
  }, [folderId, loadMedia])

  // Upload steps: 1) get a signed URL  2) send the file to S3  3) tell the server it's done
  async function uploadOne(file) {
    let uploadData;

    try {
      uploadData = await createUploadUrl({
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        folderId,
      });
    } catch (e) {
      throw new Error(`Failed to initialize upload: ${e.message}`);
    }

    try {
      await uploadFileToS3(uploadData.uploadUrl, file);
    } catch (e) {
      throw new Error(`S3 transfer failed: ${e.message}`);
    }

    try {
      await completeUpload(uploadData.mediaId);
    } catch (e) {
      throw new Error(`Failed to finalize upload: ${e.message}`);
    }

    return uploadData.mediaId;
  }

  // Runs once per selected file; refreshes the folder after the last one finishes
  async function handleUpload(file) {
    pendingUploads.current += 1;
    setUploadingCount(pendingUploads.current);

    try {
      const mediaId = await uploadOne(file);

      if (mediaId) {
        pendingThumbnailIds.current.add(String(mediaId));
      }
    } catch (err) {
      console.error('Upload failed:', err);
      messageApi.error(err.message || `Failed to upload ${file.name}.`);
    } finally {
      pendingUploads.current -= 1;
      setUploadingCount(pendingUploads.current);

      if (pendingUploads.current === 0) {
        try {
          const uploadedIds = [...pendingThumbnailIds.current];
          pendingThumbnailIds.current.clear();

          await fetchMedia();

          messageApi.success('Upload completed');

          // Run independently; don't keep the upload spinner active.
          refreshPendingThumbnails(uploadedIds);
        } catch (err) {
          console.error('Refresh failed:', err);
          messageApi.error('Uploaded, but could not refresh the folder.');
        }
      }
    }

    return Upload.LIST_IGNORE;
  }

  const groupedMedia = useMemo(() => groupImagesByDate(media), [media])
  const uploading = uploadingCount > 0

  const theme = {
    token: {
      colorPrimary: '#007aff',
      borderRadius: 14,
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
    },
  }

  const backButton = (
    <Button
      shape="circle"
      icon={<ArrowLeftOutlined />}
      className="folderview-back"
      onClick={() => navigate('/folders')}
      aria-label="Back to folders"
    />
  )

  let content

  if (loading) {
    content = (
      <Flex gap={8} wrap className="folderview-skeleton">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton.Node key={i} active className="folderview-skeleton__tile">
            <span />
          </Skeleton.Node>
        ))}
      </Flex>
    )
  } else if (error) {
    content = (
      <Flex justify="center" className="folderview-state folderview-glass">
        <Result
          status="error"
          title="Couldn't load this folder"
          subTitle={error}
          extra={[
            <Button key="back" onClick={() => navigate('/folders')}>
              Back to folders
            </Button>,
            <Button key="retry" type="primary" icon={<ReloadOutlined />} onClick={loadMedia}>
              Try again
            </Button>,
          ]}
        />
      </Flex>
    )
  } else if (media.length === 0) {
    content = (
      <Flex align="center" justify="center" className="folderview-state folderview-glass">
        <Empty
          image={<FolderOpenFilled className="folderview-state__icon" />}
          description={
            <Flex vertical gap={4}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                Nothing here
              </Typography.Title>
              <Typography.Text type="secondary">
                Upload some memories to this folder.
              </Typography.Text>
            </Flex>
          }
        />
      </Flex>
    )
    } else {
    content = (
      <MediaGrid
        groupedMedia={groupedMedia}
        onMediaClick={(selectedMedia) => {
          openViewer(
            selectedMedia,
            media,
            'folder'
          )
        }}
      />
    )
  }

  return (
    <ConfigProvider theme={theme}>
      {contextHolder}

      <section className="folderview">
        <div className="folderview__bg" aria-hidden="true" />

        {/* top-right on desktop, floating round button bottom-right on mobile */}
        <Flex className="folderview-toolbar">
          <Upload
            accept="*/*"
            multiple
            showUploadList={false}
            disabled={uploading || loading}
            beforeUpload={handleUpload}
          >
            <Button
              htmlType="button"
              type="primary"
              shape="round"
              icon={<PlusOutlined />}
              loading={uploading}
              className="folderview-toolbar__upload"
              aria-label="Upload photos"
            >
              <span className="folderview-toolbar__label">
                {uploading ? `Uploading ${uploadingCount}…` : 'Upload'}
              </span>
            </Button>
          </Upload>
        </Flex>

        <Flex align="center" gap={12} className="folderview-header">
          {backButton}

          <Flex vertical className="folderview-header__text">
            <Typography.Title level={3} ellipsis className="folderview-header__title">
              {folder?.name ?? 'Folder'}
            </Typography.Title>
            {!loading && !error && (
              <Typography.Text type="secondary" className="folderview-header__count">
                {media.length} {media.length === 1 ? 'item' : 'items'}
              </Typography.Text>
            )}
          </Flex>
        </Flex>

        <div className="folderview-content">{content}</div>
      </section>
    </ConfigProvider>
  )
}

export default FolderView