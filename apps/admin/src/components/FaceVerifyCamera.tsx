import { useCallback, useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';

const MODEL_PATH    = '/models';
const TARGET_FRAMES = 3;
const CAPTURE_MS    = 400;
const MIN_SCORE     = 0.60;

let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_PATH),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_PATH),
  ]);
  modelsLoaded = true;
}

const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

function l2normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  return v.map(x => x / norm) as unknown as Float32Array;
}

function averageDescriptors(descriptors: Float32Array[]): Float32Array {
  const len = descriptors[0].length;
  const avg = new Float32Array(len);
  for (const d of descriptors) for (let i = 0; i < len; i++) avg[i] += d[i];
  for (let i = 0; i < len; i++) avg[i] /= descriptors.length;
  return l2normalize(avg);
}

interface Props {
  active: boolean;
  onCapture: (descriptor: number[]) => void;
}

export function FaceVerifyCamera({ active, onCapture }: Props) {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const rafRef         = useRef<number | null>(null);
  const lastCaptureRef = useRef<number>(0);
  const capturesRef    = useRef<{ descriptor: Float32Array; score: number }[]>([]);
  const firedRef       = useRef(false);

  const [modelsReady, setModelsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceVisible, setFaceVisible] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);

  const onCaptureStable = useRef(onCapture);
  onCaptureStable.current = onCapture;

  useEffect(() => {
    if (!active) return;
    capturesRef.current = [];
    firedRef.current = false;
    setCaptureCount(0);
    setCameraError(null);
    let stream: MediaStream | null = null;

    async function init() {
      try {
        await loadModels();
        setModelsReady(true);
      } catch (e) {
        setCameraError(`Failed to load face models: ${String(e)}`);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        setCameraError(`Camera unavailable: ${String(e)}`);
      }
    }

    init();
    return () => {
      stream?.getTracks().forEach(t => t.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  const runDetect = useCallback(async function detect() {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }

    const result = await faceapi
      .detectSingleFace(videoRef.current, detectorOptions)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    setFaceVisible(!!result);

    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (canvas && video) {
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (result) {
          const { x, y, width, height } = result.detection.box;
          const pct = capturesRef.current.length / TARGET_FRAMES;
          ctx.strokeStyle = pct >= 1 ? '#22c55e' : '#3b82f6';
          ctx.lineWidth   = 2;
          ctx.strokeRect(x, y, width, height);
        }
      }
    }

    const now = performance.now();
    if (
      result &&
      result.detection.score >= MIN_SCORE &&
      capturesRef.current.length < TARGET_FRAMES &&
      !firedRef.current &&
      now - lastCaptureRef.current >= CAPTURE_MS
    ) {
      lastCaptureRef.current = now;
      capturesRef.current = [...capturesRef.current, { descriptor: result.descriptor, score: result.detection.score }];
      setCaptureCount(capturesRef.current.length);

      if (capturesRef.current.length >= TARGET_FRAMES) {
        firedRef.current = true;
        const avg = averageDescriptors(capturesRef.current.map(c => c.descriptor));
        onCaptureStable.current(Array.from(avg));
        return;
      }
    }

    rafRef.current = requestAnimationFrame(detect);
  }, []);

  useEffect(() => {
    if (!modelsReady || !active) return;
    rafRef.current = requestAnimationFrame(runDetect);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [modelsReady, active, runDetect]);

  if (cameraError) {
    return <p className="text-sm text-red-600 bg-red-50 rounded p-3 text-center">{cameraError}</p>;
  }

  if (!modelsReady) {
    return <p className="text-sm text-muted-foreground text-center py-6">Loading face models…</p>;
  }

  return (
    <div className="space-y-2">
      <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} muted playsInline />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: 'scaleX(-1)' }} />
        <div className="absolute bottom-2 left-0 right-0 text-center">
          <span className="text-xs bg-black/60 text-white px-3 py-1 rounded-full">
            {faceVisible ? `Scanning… ${captureCount}/${TARGET_FRAMES}` : 'Position face in frame'}
          </span>
        </div>
      </div>
    </div>
  );
}
