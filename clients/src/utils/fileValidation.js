
const BLOCKED_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs',
  '.ts', '.tsx',
  '.html', '.htm', '.xhtml', '.svg',
  '.py', '.pyw', '.php', '.phtml',
  '.rb', '.pl', '.cgi', '.lua',
  '.sh', '.bash', '.zsh', '.fish',
  '.bat', '.cmd',
  '.ps1', '.psm1', '.psd1',
  '.vbs', '.vbe', '.wsf', '.wsh', '.hta',
  '.exe', '.dll', '.com', '.scr', '.msi',
  '.jar', '.class', '.app', '.dmg',
]);

export const isBlockedFile = (fileName = '') => {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return true;
  }

  const extension = fileName
    .split(/[\\/]/)
    .pop()
    .match(/\.[^.]+$/)?.[0]
    ?.toLowerCase();

  return BLOCKED_EXTENSIONS.has(extension);
};
