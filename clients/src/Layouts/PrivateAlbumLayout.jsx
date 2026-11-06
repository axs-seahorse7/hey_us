import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Segmented,
  Spin,
  Typography,
  message,
} from 'antd';
import {
  LockOutlined,
  UnlockOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import { Upload } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';

import { uploadPrivateFile } from '../services/privateAlbum.service';

import { usePrivateAlbum } from '../context/PrivateAlbumContext';
import { deletePrivateMedia, getPrivateMedia,} from '../services/privateAlbum.service';
import { useMedia } from '../context/MediaContext';

import MediaGrid from '../components/Grids/MediaGrid';

import './PrivateAlbumLayout.css';

const { Title, Text } = Typography;


function toLocalDateKey(value) {
  const date = value ? new Date(value) : new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatPrivateDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

function groupPrivateMediaByDate(media) {
  const groups = {};

  media.forEach((item) => {
    const key = toLocalDateKey(item.createdAt);
    (groups[key] ||= []).push(item);
  });

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, images]) => ({
      date,
      images,
      formattedDate: formatPrivateDate(date),
    }));
}
function PrivateAlbumLayout() {
  const { privateToken, isUnlocked, status, isCheckingStatus, refreshStatus, setup, unlock, lock} = usePrivateAlbum();

  const [form] = Form.useForm();
  const [credentialType, setCredentialType] = useState('pin');
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);

  const [messageApi, contextHolder] = message.useMessage();
  const openViewer = useMedia().openViewer;

  const configured = Boolean(status?.isConfigured);

  const loadMedia = useCallback(async () => {
    if (!privateToken) return;

    setLoading(true);

    try {
      const items = await getPrivateMedia(privateToken);
      setMedia(items);
    } catch (error) {
      const statusCode = error.response?.status;

      if (statusCode === 401 || statusCode === 403) {
        lock();
        setMedia([]);
        messageApi.warning('Private Album session expired. Unlock again.');
      } else {
        messageApi.error(error.response?.data?.message || 'Unable to load private media.',);
      }
    } finally {
      setLoading(false);
    }
  }, [privateToken, lock, messageApi]);

  useEffect(() => {
    refreshStatus().catch((error) => {
      messageApi.error(
        error.response?.data?.message || 'Unable to check Private Album.',
      );
    });
  }, [refreshStatus, messageApi]);

  useEffect(() => {
    if (isUnlocked) {
      loadMedia();
    } else {
      setMedia([]);
    }
  }, [isUnlocked, loadMedia]);

  const handleSubmit = async (values) => {
    setSubmitting(true);

    try {
      if (configured) {
        await unlock(values.credential);
        messageApi.success('Private Album unlocked.');
      } else {
        await setup(credentialType, values.credential);
        await unlock(values.credential);
        messageApi.success('Private Album created successfully.');
      }

      form.resetFields();
    } catch (error) {
      messageApi.error(
        error.response?.data?.message || error.message || 'Something went wrong.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (item) => {
    Modal.confirm({
      title: 'Delete this private media?',
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deletePrivateMedia(item._id, privateToken);
          setMedia((previous) =>
            previous.filter((entry) => entry._id !== item._id),
          );
          messageApi.success('Media deleted.');
        } catch (error) {
          messageApi.error(
            error.response?.data?.message || 'Unable to delete media.',
          );
        }
      },
    });
  };

  const handlePrivateUpload = async (file) => {
    setUploadingCount((count) => count + 1);

    try {
        await uploadPrivateFile(file, privateToken);

        messageApi.success(`${file.name} uploaded successfully.`);

        // Refresh the private media list.
        const latestMedia = await getPrivateMedia(privateToken);
        setMedia(latestMedia);
    } catch (error) {
        console.error('[PRIVATE UPLOAD FAILED]', error);

        messageApi.error(
        error.response?.data?.message ||
        error.message ||
        `Failed to upload ${file.name}.`,
        );
    } finally {
        setUploadingCount((count) => Math.max(0, count - 1));
    }

    return Upload.LIST_IGNORE;
    };

    const groupedPrivateMedia = useMemo(
        () => groupPrivateMediaByDate(media),
        [media],
    );

  if (isCheckingStatus || status === null) {
    return (
      <div className="private-album-state">
        <Spin size="large" />
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <section className="private-album-page">
        {contextHolder}

        <Card className="private-album-auth-card">
          <div className="private-album-auth-icon">
            {configured ? <LockOutlined /> : <UnlockOutlined />}
          </div>

          <Title level={3}>
            {configured ? 'Private Album Locked' : 'Create Private Album'}
          </Title>

          <Text type="secondary">
            {configured
              ? 'Enter your credential to access your private memories.'
              : 'Choose a PIN or password to protect your private memories.'}
          </Text>

          {!configured && (
            <Segmented
                block
                size="large"
                value={credentialType}
                onChange={(value) => {
                    setCredentialType(value);
                    form.resetFields();
                }}
                options={[
                    { label: 'PIN', value: 'pin' },
                    { label: 'Password', value: 'password' },
                ]}
                className="private-album-type-select"
            />
          )}

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            className="private-album-form"
          >
            <Form.Item
              name="credential"
              label={configured ? 'Credential' : credentialType === 'pin' ? 'Create PIN' : 'Create Password'}
              rules={[
                { required: true, message: 'Enter your credential.' },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();

                    if (
                      !configured &&
                      credentialType === 'pin' &&
                      !/^\d{4,6}$/.test(value)
                    ) {
                      return Promise.reject(
                        new Error('PIN must contain 4 to 6 digits.'),
                      );
                    }

                    if (
                      !configured &&
                      credentialType === 'password' &&
                      value.length < 8
                    ) {
                      return Promise.reject(
                        new Error('Password must be at least 8 characters.'),
                      );
                    }

                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input.Password
                size="large"
                type={credentialType === 'pin' ? 'tel' : 'password'}
                inputMode={credentialType === 'pin' ? 'numeric' : 'text'}
                maxLength={credentialType === 'pin' ? 6 : undefined}
                placeholder={
                    credentialType === 'pin'
                    ? 'Enter 4–6 digit PIN'
                    : 'Enter password'
                }
                onChange={(event) => {
                    if (credentialType === 'pin') {
                    const numericValue = event.target.value.replace(/\D/g, '');
                    form.setFieldValue('credential', numericValue);
                    }
                }}
                />
            </Form.Item>

            {!configured && (
              <Form.Item
                name="confirmCredential"
                label="Confirm Credential"
                dependencies={['credential']}
                rules={[
                  { required: true, message: 'Confirm your credential.' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('credential') === value) {
                        return Promise.resolve();
                      }

                      return Promise.reject(
                        new Error('Credentials do not match.'),
                      );
                    },
                  }),
                ]}
              >
                <Input.Password
                    size="large"
                    type={credentialType === 'pin' ? 'tel' : 'password'}
                    inputMode={credentialType === 'pin' ? 'numeric' : 'text'}
                    maxLength={credentialType === 'pin' ? 6 : undefined}
                    placeholder={
                        credentialType === 'pin'
                        ? 'Re-enter your PIN'
                        : 'Re-enter password'
                    }
                    onChange={(event) => {
                        if (credentialType === 'pin') {
                        const numericValue = event.target.value.replace(/\D/g, '');
                        form.setFieldValue('confirmCredential', numericValue);
                        }
                    }}
                />
              </Form.Item>
            )}

            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={submitting}
            >
              {configured ? 'Unlock Private Album' : 'Create Private Album'}
            </Button>
          </Form>
        </Card>
      </section>
    );
  }

  return (
    <section className="private-album-page">
      {contextHolder}

      <div className="private-album-toolbar">
        <div>
            <Title level={3}>Private Album</Title>
            <Text type="secondary">
            Your private memories are protected.
            </Text>
        </div>

        <div className="private-album-actions">
            <Upload
            multiple
            accept="*/*"
            showUploadList={false}
            beforeUpload={handlePrivateUpload}
            disabled={uploadingCount > 0}
            >
            <Button
                type="primary"
                icon={<PlusOutlined />}
                loading={uploadingCount > 0}
            >
                {uploadingCount > 0
                ? `Uploading (${uploadingCount})`
                : 'Upload'}
            </Button>
            </Upload>

            <Button
            icon={<ReloadOutlined />}
            onClick={loadMedia}
            loading={loading}
            >
            Refresh
            </Button>

            <Button
            danger
            icon={<LockOutlined />}
            onClick={() => {
                lock();
                setMedia([]);
            }}
            >
            Lock
            </Button>
        </div>
        </div>

      {loading ? (
        <div className="private-album-state">
          <Spin size="large" />
        </div>
      ) : media.length === 0 ? (
        <Empty description="Your Private Album is empty." />
      ) : (
        <MediaGrid
            layout="grid"
            groupedMedia={groupedPrivateMedia}
            onMediaClick={(selectedMedia) => {
                const privateMedia = groupedPrivateMedia.flatMap((group) => group.images);
                openViewer(selectedMedia, privateMedia, 'private', (mediaId) => {
                  setMedia((current) =>current.filter((item) => String(item._id) !== String(mediaId)))
                })
            }}
        />
      )}
    </section>
  );
}

export default PrivateAlbumLayout;