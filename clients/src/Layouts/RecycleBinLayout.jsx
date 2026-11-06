
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Empty,
  Popconfirm,
  Spin,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import { useMedia } from '../context/MediaContext';
import MediaGrid from '../components/Grids/MediaGrid';

import {
  getRecycleBin,
  restoreMedia,
  permanentlyDeleteMedia,
  emptyRecycleBin,
} from '../services/media.service';

import './GalleryLayout.css';

const { Title, Text } = Typography;

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

function groupMediaByDeletedDate(media) {
  const groups = {};

  media.forEach((item) => {
    const key = toLocalDateKey(item.deletedAt);
    (groups[key] ||= []).push(item);
  });

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, images]) => ({
      date,
      images,
      formattedDate: formatDate(date),
    }));
}

function RecycleBinLayout() {
  const { openViewer } = useMedia();

  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [emptying, setEmptying] = useState(false);

  const fetchRecycleBin = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const items = await getRecycleBin();
      setMedia(items);
    } catch (err) {
      console.error('Failed to load Recycle Bin:', err);
      setError('Unable to load Recycle Bin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecycleBin();
  }, [fetchRecycleBin]);

  const groupedMedia = useMemo(
    () => groupMediaByDeletedDate(media),
    [media],
  );

  async function handleRestore(mediaId) {
    try {
      setProcessingId(mediaId);

      await restoreMedia(mediaId);

      setMedia((previous) =>
        previous.filter(
          (item) => String(item._id) !== String(mediaId),
        ),
      );

      message.success('Media restored successfully.');
    } catch (error) {
      message.error(
        error.response?.data?.message || 'Failed to restore media.',
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handlePermanentDelete(mediaId) {
    try {
      setProcessingId(mediaId);

      await permanentlyDeleteMedia(mediaId);

      setMedia((previous) =>
        previous.filter(
          (item) => String(item._id) !== String(mediaId),
        ),
      );

      message.success('Media permanently deleted.');
    } catch (error) {
      message.error(
        error.response?.data?.message || 'Failed to delete media.',
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleEmptyRecycleBin() {
    try {
      setEmptying(true);

      await emptyRecycleBin();

      setMedia([]);
      message.success('Recycle Bin emptied.');
    } catch (error) {
      message.error(
        error.response?.data?.message || 'Failed to empty Recycle Bin.',
      );
    } finally {
      setEmptying(false);
    }
  }

  return (
    <section className="gallery-layout">
      <div className="gallery-layout__bg" aria-hidden="true" />

      <div className="gallery-content">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 24,
          }}
        >
          <div>
            <Title level={3} style={{ margin: 0 }}>
              Recycle Bin
            </Title>

            <Text type="secondary">
              {media.length} deleted {media.length === 1 ? 'item' : 'items'}
            </Text>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchRecycleBin}
              loading={loading}
            >
              Refresh
            </Button>

            <Popconfirm
              title="Empty Recycle Bin?"
              description="All items will be permanently deleted. This cannot be undone."
              okText="Empty"
              cancelText="Cancel"
              okButtonProps={{ danger: true, loading: emptying }}
              onConfirm={handleEmptyRecycleBin}
              disabled={!media.length || emptying}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={!media.length || Boolean(processingId)}
                loading={emptying}
              >
                Empty Recycle Bin
              </Button>
            </Popconfirm>
          </div>
        </div>

        {error && (
          <Alert
            type="error"
            showIcon
            message={error}
            action={
              <Button size="small" onClick={fetchRecycleBin}>
                Retry
              </Button>
            }
            style={{ marginBottom: 20 }}
          />
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <Spin size="large" />
          </div>
        ) : media.length === 0 ? (
          <div className="gallery-state glass-card">
            <Empty
              image={<DeleteOutlined style={{ fontSize: 48 }} />}
              description={
                <div>
                  <Title level={4}>Recycle Bin is empty</Title>
                  <Text type="secondary">
                    Deleted media will appear here.
                  </Text>
                </div>
              }
            />
          </div>
        ) : (
          <MediaGrid
            groupedMedia={groupedMedia}
            onMediaClick={(selectedMedia) => {
              openViewer(selectedMedia, media, 'recycle-bin', (mediaId) => { setMedia((previous) =>
                    previous.filter((item) => String(item._id) !== String(mediaId)));
                });
            }}
          />
        )}
      </div>
    </section>
  );
}

export default RecycleBinLayout;
