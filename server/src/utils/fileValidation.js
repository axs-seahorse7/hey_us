
import path from 'node:path';

const BLOCKED_EXTENSIONS = new Set([
  // JavaScript and web scripts
  '.js', '.jsx', '.mjs', '.cjs',
  '.ts', '.tsx',
  '.html', '.htm', '.xhtml',
  '.svg',

  // Python and other programming scripts
  '.py', '.pyw',
  '.php', '.phtml',
  '.rb', '.pl', '.cgi',
  '.lua', '.r', '.ipynb',

  // Shell scripts
  '.sh', '.bash', '.zsh', '.fish',
  '.bat', '.cmd',
  '.ps1', '.psm1', '.psd1',
  '.vbs', '.vbe', '.wsf', '.wsh',
  '.hta',

  // Executable files
  '.exe', '.dll', '.com',
  '.scr', '.msi',
  '.jar', '.class',
  '.app', '.dmg',
]);

export const isBlockedFile = (fileName = '') => {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return true;
  }

  const extension = path.extname(fileName).toLowerCase();

  return BLOCKED_EXTENSIONS.has(extension);
};

export const getBlockedExtension = (fileName = '') => {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return null;
  }

  const extension = path.extname(fileName).toLowerCase();

  return BLOCKED_EXTENSIONS.has(extension) ? extension : null;
};
