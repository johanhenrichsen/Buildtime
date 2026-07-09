// Copies face-api model weights from node_modules into public/models/
// so they are served as static assets and cached by the PWA service worker.
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dest   = join(__dirname, '../public/models');
const source = join(__dirname, '../node_modules/@vladmandic/face-api/model');

mkdirSync(dest, { recursive: true });

if (!existsSync(source)) {
  console.warn('[models] @vladmandic/face-api not found — run npm install first');
  process.exit(0);
}

// @vladmandic/face-api ships models as single .bin files (not shards)
const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model.bin',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin',
];

for (const file of files) {
  try {
    copyFileSync(join(source, file), join(dest, file));
    console.log(`[models] Copied ${file}`);
  } catch (e) {
    console.warn(`[models] Could not copy ${file}: ${e.message}`);
  }
}
