import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ConfigProvider, Empty, Result, Skeleton, Typography, Upload, message } from 'antd';
import { CameraOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../services/api';
import MediaGrid from '../components/Grids/MediaGrid';
import { useMedia } from '../context/MediaContext';
import { uploadFile } from '../services/gallery.service';
import './GalleryLayout.css';

const { Title, Text } = Typography;

// Local-time YYYY-MM-DD (toISOString() would shift dates to UTC)
function toLocalDateKey(value) {
  const date = value ? new Date(value) : new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === yesterday.getTime()) return 'Yesterday';

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function groupImagesByDate(media) {
  const groups = {};

  media.forEach((image) => {
    const key = toLocalDateKey(image.createdAt);
    (groups[key] ||= []).push(image);
  });

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, images]) => ({
      date,
      images,
      formattedDate: formatDate(date),
    }));
}

function GalleryLayout() {
  const navigate = useNavigate();
  const { openViewer, setGalleryImages } = useMedia();
  const [messageApi, contextHolder] = message.useMessage();

  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const pendingUploads = useRef(0);

  const fetchImages = useCallback(async () => {
    const response = await api.get('/gallery');
    const media = response.data.media || [];
    setImages(media);
    setGalleryImages(media);
  }, [setGalleryImages]);

  const loadInitial = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await fetchImages();
    } catch (err) {
      console.error('Error fetching gallery images:', err);
      setError('Failed to load images. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchImages]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Runs once per selected file; refreshes the gallery after the last one finishes
  async function handleUpload(file) {
    pendingUploads.current += 1;
    setUploadingCount(pendingUploads.current);

    try {
      await uploadFile(file);
    } catch (err) {
      console.error('Upload failed:', err);
      messageApi.error(err.message || `Failed to upload ${file.name}.`);
    } finally {
      pendingUploads.current -= 1;
      setUploadingCount(pendingUploads.current);

      if (pendingUploads.current === 0) {
        try {
          await fetchImages();
          messageApi.success('Gallery updated');
        } catch (err) {
          console.error('Refresh failed:', err);
          messageApi.error('Uploaded, but could not refresh the gallery.');
        }
      }
    }

    return Upload.LIST_IGNORE; // never add to antd's internal list
  }

  const groupedMedia = useMemo(() => groupImagesByDate(images), [images]);
  const uploading = uploadingCount > 0;

  const theme = {
    token: {
      colorPrimary: '#007aff',
      borderRadius: 14,
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
    },
  };

  let content;

  if (isLoading) {
    content = (
      <div className="gallery-skeleton">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton.Node key={i} active className="gallery-skeleton__tile">
            <span />
          </Skeleton.Node>
        ))}
      </div>
    );
  } else if (error) {
    content = (
      <div className="gallery-state glass-card">
        <Result
          status="error"
          title="Couldn't load your gallery"
          subTitle={error}
          extra={
            <Button type="primary" icon={<ReloadOutlined />} onClick={loadInitial}>
              Try again
            </Button>
          }
        />
      </div>
    );
  } else if (images.length === 0) {
    content = (
      <div className="gallery-state glass-card">
        <Empty
          image={<CameraOutlined className="gallery-state__icon" />}
          description={
            <div>
              <Title level={4} style={{ marginBottom: 4 }}>
                Your gallery is empty
              </Title>
              <Text type="secondary">Start uploading your favorite moments together!</Text>
            </div>
          }
        />
      </div>
    );
  } else {
    content = (
      <MediaGrid
        groupedMedia={groupedMedia}
        onMediaClick={(selectedMedia) => {
          openViewer(selectedMedia, images)
          navigate(`/gallery/${selectedMedia._id}`)
        }}
      />
    );
  }

  return (
    <ConfigProvider theme={theme}>
      {contextHolder}

      <section className="gallery-layout">
        <div className="gallery-layout__bg" aria-hidden="true" />

        <div className="gallery-toolbar">
          <Upload
            accept="image/*"
            multiple
            showUploadList={false}
            disabled={uploading}
            beforeUpload={handleUpload}
          >
            <Button
              type="primary"
              shape="round"
              icon={<PlusOutlined />}
              loading={uploading}
              className="gallery-toolbar__upload"
              aria-label="Upload photos"
            >
              <span className="gallery-toolbar__label">
                {uploading ? `Uploading ${uploadingCount}…` : 'Upload'}
              </span>
            </Button>
          </Upload>
        </div>

        <div className="gallery-content">{content}</div>
      </section>
    </ConfigProvider>
  );
}

export default GalleryLayout;