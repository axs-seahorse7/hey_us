import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  access,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFile = promisify(execFileCallback);

const RAW_TIMEOUT = 120000;

export async function decodeRawToTiffBuffer(rawBuffer, fileName) {
  const executable = process.env.LIBRAW_DCRAW_PATH;

  if (!executable) {
    throw new Error('LIBRAW_DCRAW_PATH is not configured.');
  }

  const tempDir = await mkdtemp(
    path.join(tmpdir(), 'dear-us-raw-'),
  );

  try {
    const safeName = path.basename(fileName || 'image.arw')
      .replace(/[^\w.-]/g, '_');

    const inputPath = path.join(tempDir, safeName);
    const outputPath = `${inputPath}.tiff`;

    await writeFile(inputPath, rawBuffer);

    console.log(`[RAW] Decoding: ${safeName}`);

    await execFile(
      executable,
      ['-w', '-T', inputPath],
      {
        cwd: tempDir,
        windowsHide: true,
        timeout: RAW_TIMEOUT,
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    await access(outputPath);

    const tiffBuffer = await readFile(outputPath);

    console.log(
      `[RAW] Decoded successfully: ${safeName} (${tiffBuffer.length} bytes)`,
    );

    return tiffBuffer;
  } catch (error) {
    const details = error.stderr || error.message;

    throw new Error(`LibRaw decoding failed: ${details}`);
  } finally {
    await rm(tempDir, {
      recursive: true,
      force: true,
    });
  }
}