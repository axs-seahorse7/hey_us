
import {
  FileOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileZipOutlined,
  FileTextOutlined,
  CodeOutlined,
} from '@ant-design/icons'

const FILE_ICON_MAP = {
  pdf: { icon: FilePdfOutlined, color: '#E53935', bg: '#FDECEC' },

  doc: { icon: FileWordOutlined, color: '#2874C8', bg: '#EAF2FC' },
  docx: { icon: FileWordOutlined, color: '#2874C8', bg: '#EAF2FC' },

  xls: { icon: FileExcelOutlined, color: '#16864A', bg: '#E8F5EC' },
  xlsx: { icon: FileExcelOutlined, color: '#16864A', bg: '#E8F5EC' },
  csv: { icon: FileExcelOutlined, color: '#16864A', bg: '#E8F5EC' },

  ppt: { icon: FilePptOutlined, color: '#D96B27', bg: '#FFF0E6' },
  pptx: { icon: FilePptOutlined, color: '#D96B27', bg: '#FFF0E6' },

  zip: { icon: FileZipOutlined, color: '#8052B8', bg: '#F2EBFA' },
  rar: { icon: FileZipOutlined, color: '#8052B8', bg: '#F2EBFA' },
  '7z': { icon: FileZipOutlined, color: '#8052B8', bg: '#F2EBFA' },

  txt: { icon: FileTextOutlined, color: '#64748B', bg: '#F1F5F9' },
  md: { icon: FileTextOutlined, color: '#64748B', bg: '#F1F5F9' },

  json: { icon: CodeOutlined, color: '#475569', bg: '#EEF2F6' },
  js: { icon: CodeOutlined, color: '#D6A500', bg: '#FFF8D9' },
  jsx: { icon: CodeOutlined, color: '#1597B8', bg: '#E5F7FB' },
  ts: { icon: CodeOutlined, color: '#3178C6', bg: '#EAF2FC' },
  tsx: { icon: CodeOutlined, color: '#1597B8', bg: '#E5F7FB' },
  html: { icon: CodeOutlined, color: '#E76F32', bg: '#FFF0E6' },
  css: { icon: CodeOutlined, color: '#7952B3', bg: '#F2EBFA' },
  xml: { icon: CodeOutlined, color: '#64748B', bg: '#F1F5F9' },
}

export function getFileIcon(fileName) {
  const extension = fileName?.split('.').pop()?.toLowerCase()

  return FILE_ICON_MAP[extension] || {
    icon: FileOutlined,
    color: '#64748B',
    bg: '#F1F5F9',
  }
}
