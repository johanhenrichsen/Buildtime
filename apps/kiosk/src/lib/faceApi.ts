import * as faceapi from '@vladmandic/face-api';

const MODEL_PATH = '/models';

let loaded = false;

export async function loadModels(): Promise<void> {
  if (loaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_PATH),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_PATH),
  ]);
  loaded = true;
}

export const detectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 224,      // smaller = faster on budget tablets
  scoreThreshold: 0.5,
});

// Detect one face with 68 landmarks + 128-dim descriptor.
// Returns null if no face found or confidence too low.
export async function detectFace(video: HTMLVideoElement) {
  return faceapi
    .detectSingleFace(video, detectorOptions)
    .withFaceLandmarks(true)   // tiny landmark model
    .withFaceDescriptor();
}

// Extract Eye Aspect Ratio from landmarks — used for blink detection.
// EAR < ~0.2 indicates a blink.
export function computeEAR(landmarks: faceapi.FaceLandmarks68): number {
  return (eyeAR(landmarks.getLeftEye()) + eyeAR(landmarks.getRightEye())) / 2;
}

function eyeAR(eye: faceapi.Point[]): number {
  const a = dist(eye[1], eye[5]);
  const b = dist(eye[2], eye[4]);
  const c = dist(eye[0], eye[3]);
  return c === 0 ? 0 : (a + b) / (2 * c);
}

function dist(p1: faceapi.Point, p2: faceapi.Point): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}
