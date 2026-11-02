import sharp from 'sharp';
import { stat } from 'node:fs/promises';

const input = 'D:/Temp/Temp Images/DSC02523-node-test.tiff';
const output = 'D:/Temp/Temp Images/DSC02523-node-test.webp';

const metadata = await sharp(input).metadata();

console.log('Original dimensions:', metadata.width, 'x', metadata.height);
console.log('Input format:', metadata.format);

await sharp(input)
  .rotate()
  .webp({
    quality: 85,
    effort: 5,
  })
  .toFile(output);

const result = await stat(output);

console.log('WebP generated successfully.');
console.log('WebP size:', (result.size / 1024 / 1024).toFixed(2), 'MB');
console.log('Output:', output);