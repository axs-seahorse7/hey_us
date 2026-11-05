
const RAW_EXTENSIONS = new Set([
  'arw', 'cr2', 'cr3', 'nef', 'dng',
  'raf', 'orf', 'rw2', 'pef', 'srw',
]);

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif',
  'bmp', 'tif', 'tiff', 'avif', 'heic', 'heif',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv',
]);

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac',
]);

const TEXT_EXTENSIONS = new Set([
  'txt', 'csv', 'json', 'xml', 'md', 'log',
]);

const OFFICE_EXTENSIONS = new Set([
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'odt', 'ods', 'odp',
]);

const ARCHIVE_EXTENSIONS = new Set([
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz',
]);

export const getFileExtension = (fileName = '') => {
  const name = String(fileName).trim().toLowerCase();
  const lastDot = name.lastIndexOf('.');

  if (lastDot <= 0 || lastDot === name.length - 1) {
    return '';
  }

  return name.slice(lastDot + 1);
};

export const getMediaType = (media = {}) => {
  const fileName =
    media.fileName ||
    media.name ||
    media.originalName ||
    '';

  const extension = getFileExtension(fileName);

  const contentType = String(
    media.contentType || media.mimeType || media.type || ''
  )
    .split(';')[0]
    .trim()
    .toLowerCase();

  // SVG is intentionally excluded because uploaded SVG files
  // can contain active content.
  if (
    extension === 'svg' ||
    contentType === 'image/svg+xml'
  ) {
    return 'unknown';
  }

  // RAW must be checked before image/* MIME types.
  if (RAW_EXTENSIONS.has(extension)) {
    return 'raw';
  }

  if (IMAGE_EXTENSIONS.has(extension) || contentType.startsWith('image/')) {
    return 'image';
  }

  if (extension === 'pdf' || contentType === 'application/pdf') {
    return 'pdf';
  }

  if (VIDEO_EXTENSIONS.has(extension) || contentType.startsWith('video/')) {
    return 'video';
  }

  if (AUDIO_EXTENSIONS.has(extension) || contentType.startsWith('audio/')) {
    return 'audio';
  }

  if (
    TEXT_EXTENSIONS.has(extension) ||
    contentType.startsWith('text/') ||
    contentType === 'application/json' ||
    contentType === 'application/xml'
  ) {
    return 'text';
  }

  if (OFFICE_EXTENSIONS.has(extension)) {
    return 'office';
  }

  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return 'archive';
  }

  return 'unknown';
};
