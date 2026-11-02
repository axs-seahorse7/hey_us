import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { decodeRawToTiffBuffer } from './src/utils/rawDecoder.js';

const input = 'D:/Temp/Temp Images/DSC02523.ARW';

const rawBuffer = await readFile(input);

const tiffBuffer = await decodeRawToTiffBuffer(
  rawBuffer,
  'DSC02523.ARW',
);

await writeFile(
  'D:/Temp/Temp Images/DSC02523-node-test.tiff',
  tiffBuffer,
);

console.log('RAW decoding test completed successfully.');