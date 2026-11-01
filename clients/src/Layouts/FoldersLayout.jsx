import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Result,
  Row,
  Skeleton,
  Typography,
  message,
} from 'antd'
import {
  ClockCircleFilled,
  FileTextFilled,
  FolderFilled,
  HeartFilled,
  PictureFilled,
  PlayCircleFilled,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { getFolders, createFolder } from '../services/folder.service'
import './FolderLayout.css'

// --------------------------------------------------
// Colourful icons for the default folders (matched by name, case-insensitive)
// --------------------------------------------------

const DEFAULT_FOLDER_STYLES = {
  recents: { Icon: ClockCircleFilled, from: '#ffb84d', to: '#ff7a00' },
  pictures: { Icon: PictureFilled, from: '#5ac8fa', to: '#007aff' },
  notes: { Icon: FileTextFilled, from: '#ffe066', to: '#ffb800' },
  videos: { Icon: PlayCircleFilled, from: '#ff7a8a', to: '#ff2d55' },
  memories: { Icon: HeartFilled, from: '#ff9ac2', to: '#ff375f' },
}

// Custom folders (e.g. "Vacation") get a stable colour picked from their name
const FALLBACK_PALETTE = [
  { from: '#b794f6', to: '#6d3fd6' },
  { from: '#5eead4', to: '#0f9d8a' },
  { from: '#f9a8d4', to: '#db2777' },
  { from: '#7dd3fc', to: '#0369a1' },
  { from: '#fdba74', to: '#ea580c' },
  { from: '#a3e635', to: '#4d9a16' },
]

function getFolderStyle(name = '') {
  const key = name.trim().toLowerCase()

  if (DEFAULT_FOLDER_STYLES[key]) return DEFAULT_FOLDER_STYLES[key]

  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }

  return { Icon: FolderFilled, ...FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length] }
}

// --------------------------------------------------

function FoldersLayout() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [messageApi, contextHolder] = message.useMessage()

  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const loadFolders = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const data = await getFolders()
      setFolders(data?.folders || [])
    } catch (err) {
      console.error('Failed to load folders:', err)
      setError(err.message || 'Failed to load folders.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  function openCreate() {
    setCreateError('')
    form.resetFields()
    setCreateOpen(true)
  }

  function closeCreate() {
    if (!creating) setCreateOpen(false)
  }

  async function handleCreateFolder({ name }) {
    const trimmed = name?.trim()
    if (!trimmed) return

    try {
      setCreating(true)
      setCreateError('')

      const { folder: newFolder } = await createFolder(trimmed)

      setFolders((current) => [...current, newFolder])
      setCreateOpen(false)
      messageApi.success(`“${trimmed}” created`)
    } catch (err) {
      console.error('Failed to create folder:', err)
      setCreateError(err.message || 'Failed to create folder.')
    } finally {
      setCreating(false)
    }
  }

  function handleCardKeyDown(event, folder) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      navigate(`/folders/${folder._id}`)
    }
  }

  const theme = {
    token: {
      colorPrimary: '#007aff',
      borderRadius: 14,
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
    },
  }

  let content

  if (loading) {
    content = (
      <Row gutter={[14, 14]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Col key={i} xs={12} sm={8} md={6} xl={4}>
            <Skeleton.Node active className="folders-skeleton">
              <span />
            </Skeleton.Node>
          </Col>
        ))}
      </Row>
    )
  } else if (error && folders.length === 0) {
    content = (
      <Flex justify="center" className="folders-state folders-glass">
        <Result
          status="error"
          title="Couldn't load your folders"
          subTitle={error}
          extra={
            <Button type="primary" icon={<ReloadOutlined />} onClick={loadFolders}>
              Try again
            </Button>
          }
        />
      </Flex>
    )
  } else if (folders.length === 0) {
    content = (
      <Flex align="center" justify="center" className="folders-state folders-glass">
        <Empty
          image={<FolderFilled className="folders-state__icon" />}
          description={
            <Flex vertical gap={4}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                No folders yet
              </Typography.Title>
              <Typography.Text type="secondary">
                Create your first folder to organize your memories.
              </Typography.Text>
            </Flex>
          }
        />
      </Flex>
    )
  } else {
    content = (
      <Row gutter={[14, 14]}>
        {folders.map((folder) => {
          const { Icon, from, to } = getFolderStyle(folder.name)

          return (
            <Col key={folder._id} xs={12} sm={8} md={6} xl={4}>
              <Card
                hoverable
                variant="borderless"
                className="folder-card"
                styles={{ body: { padding: 16 } }}
                role="button"
                tabIndex={0}
                aria-label={`Open folder ${folder.name}`}
                onClick={() => navigate(`/folders/${folder._id}`)}
                onKeyDown={(event) => handleCardKeyDown(event, folder)}
              >
                <Flex vertical gap={14}>
                  <Flex
                    align="center"
                    justify="center"
                    className="folder-card__icon"
                    style={{ '--from': from, '--to': to }}
                  >
                    <Icon />
                  </Flex>

                  <Flex vertical gap={2}>
                    <Typography.Text strong ellipsis className="folder-card__name">
                      {folder.name}
                    </Typography.Text>
                    <Typography.Text type="secondary" className="folder-card__count">
                      {folder.itemCount ?? 0} {folder.itemCount === 1 ? 'item' : 'items'}
                    </Typography.Text>
                  </Flex>
                </Flex>
              </Card>
            </Col>
          )
        })}
      </Row>
    )
  }

  return (
    <ConfigProvider theme={theme}>
      {contextHolder}

      <section className="folders-layout">
        <div className="folders-layout__bg" aria-hidden="true" />

        {/* top-right on desktop, floating round button bottom-right on mobile */}
        <Flex className="folders-toolbar">
          <Button
            type="primary"
            shape="round"
            icon={<PlusOutlined />}
            className="folders-toolbar__create"
            onClick={openCreate}
            aria-label="Create folder"
          >
            <span className="folders-toolbar__label">New Folder</span>
          </Button>
        </Flex>

        {error && folders.length > 0 && (
          <Alert
            type="error"
            showIcon
            closable
            message={error}
            onClose={() => setError('')}
            className="folders-error"
          />
        )}

        <div className="folders-content">{content}</div>

        <Modal
          open={createOpen}
          title="Create folder"
          centered
          width={380}
          closable={false}
          maskClosable={!creating}
          keyboard={!creating}
          onCancel={closeCreate}
          wrapClassName="folders-modal"
          okText="Create folder"
          cancelText="Cancel"
          confirmLoading={creating}
          okButtonProps={{ disabled: creating }}
          cancelButtonProps={{ disabled: creating }}
          onOk={() => form.submit()}
          afterClose={() => {
            form.resetFields()
            setCreateError('')
          }}
        >
          <Form form={form} layout="vertical" onFinish={handleCreateFolder} requiredMark={false}>
            <Form.Item
              name="name"
              rules={[
                { required: true, whitespace: true, message: 'Enter a folder name' },
                { max: 40, message: 'Keep it under 40 characters' },
              ]}
            >
              <Input
                size="large"
                placeholder="Folder name"
                autoFocus
                allowClear
                disabled={creating}
                onChange={() => setCreateError('')}
              />
            </Form.Item>
          </Form>

          {createError && <Alert type="error" showIcon message={createError} />}
        </Modal>
      </section>
    </ConfigProvider>
  )
}

export default FoldersLayout