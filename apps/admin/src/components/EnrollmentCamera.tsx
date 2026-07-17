import { useCallback, useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { enrollWorker } from '../lib/api';

const MODEL_PATH    = '/models';
const TARGET_FRAMES = 10;   // frames collected before auto-enroll
const CAPTURE_MS    = 350;  // ms between auto-captures
const MIN_SCORE     = 0.60; // minimum detection confidence to accept a frame

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
  for (const d of descriptors) {
    for (let i = 0; i < len; i++) avg[i] += d[i];
  }
  for (let i = 0; i < len; i++) avg[i] /= descriptors.length;
  return l2normalize(avg);
}

const HINTS = [
  'Look straight ahead',
  'Tilt slightly left',
  'Tilt slightly right',
  'Look slightly up',
  'Look slightly down',
  'Relax your face',
  'Look straight ahead',
  'Tilt slightly left',
  'Natural expression',
  'Hold still…',
];

interface Props {
  workerId: string;
  onResult: (msg: string, success: boolean) => void;
}

export function EnrollmentCamera({ workerId, onResult }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);
  const lastCaptureRef = useRef<number>(0);

  const detectionRef = useRef<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>> | null>(null);

  const [modelsReady, setModelsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceVisible, setFaceVisible] = useState(false);
  const [captures, setCaptures]       = useState<{ descriptor: Float32Array; score: number }[]>([]);
  const [enrolling, setEnrolling]     = useState(false);
  const [done, setDone]               = useState(false);

  const capturesRef = useRef<{ descriptor: Float32Array; score: number }[]>([]);

  useEffect(() => {
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
        setCameraError(`Camera access denied: ${String(e)}`);
      }
    }

    init();
    return () => {
      stream?.getTracks().forEach(t => t.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Detection + auto-capture loop
  useEffect(() => {
    if (!modelsReady || done) return;

    async function detect() {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      const result = await faceapi
        .detectSingleFace(videoRef.current, detectorOptions)
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      detectionRef.current = result ?? null;
      setFaceVisible(!!result);

      // Draw overlay
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
            ctx.strokeStyle = pct >= 1 ? '#22c55e' : pct > 0.5 ? '#f59e0b' : '#3b82f6';
            ctx.lineWidth   = 2;
            ctx.strokeRect(x, y, width, height);
          }
        }
      }

      // Auto-capture: throttled, only when face is good quality and not yet full
      const now = performance.now();
      if (
        result &&
        result.detection.score >= MIN_SCORE &&
        capturesRef.current.length < TARGET_FRAMES &&
        now - lastCaptureRef.current >= CAPTURE_MS
      ) {
        lastCaptureRef.current = now;
        const newCapture = { descriptor: result.descriptor, score: result.detection.score };
        capturesRef.current = [...capturesRef.current, newCapture];
        setCaptures([...capturesRef.current]);
      }

      rafRef.current = requestAnimationFrame(detect);
    }

    rafRef.current = requestAnimationFrame(detect);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [modelsReady, done]);

  // Auto-enroll when TARGET_FRAMES reached
  useEffect(() => {
    if (captures.length >= TARGET_FRAMES && !enrolling && !done) {
      handleEnroll();
    }
  }, [captures.length]);

  const handleEnroll = useCallback(async () => {
    const current = capturesRef.current;
    if (current.length === 0) return;
    setEnrolling(true);
    setDone(true);
    try {
      const descriptors  = current.map(c => c.descriptor);
      const avgDesc      = averageDescriptors(descriptors);
      const qualityScore = current.reduce((s, c) => s + c.score, 0) / current.length;
      await enrollWorker(workerId, Array.from(avgDesc), qualityScore);
      onResult(`Enrolled successfully using ${current.length} frames (avg quality ${(qualityScore * 100).toFixed(0)}%)`, true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onResult(msg.includes('409') || msg.includes('already') ? `Re-enrolled: ${msg}` : `Error: ${msg}`, false);
      setDone(false);
    } finally {
      setEnrolling(false);
    }
  }, [workerId, onResult]);

  const handleReset = useCallback(() => {
    capturesRef.current = [];
    lastCaptureRef.current = 0;
    setCaptures([]);
    setDone(false);
    setEnrolling(false);
  }, []);

  if (cameraError) {
    return <div className="text-red-600 text-sm p-4 bg-red-50 rounded border border-red-200">{cameraError}</div>;
  }

  if (!modelsReady) {
    return <div className="text-slate-500 text-sm p-4">Loading face recognition models…</div>;
  }

  const progress  = Math.min(captures.length / TARGET_FRAMES, 1);
  const hintIndex = Math.min(captures.length, HINTS.length - 1);

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-md mx-auto aspect-video bg-black rounded overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} muted playsInline />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: 'scaleX(-1)' }} />

        {/* Live hint overlay */}
        {!enrolling && !done && (
          <div className="absolute bottom-2 left-0 right-0 text-center">
            <span className="text-xs bg-black/60 text-white px-3 py-1 rounded-full">
              {faceVisible ? HINTS[hintIndex] : 'Position face in frame'}
            </span>
          </div>
        )}

        {enrolling && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-white text-sm font-medium">Saving enrollment…</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="max-w-md mx-auto space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Capturing frames</span>
          <span>{captures.length}/{TARGET_FRAMES}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: progress >= 1 ? '#22c55e' : progress > 0.5 ? '#f59e0b' : '#3b82f6',
            }}
          />
        </div>
        <p className="text-xs text-slate-400 text-center">
          {captures.length === 0
            ? 'Auto-capturing when face is detected'
            : captures.length < TARGET_FRAMES
            ? 'Keep facing the camera, follow the prompts above'
            : 'All frames captured — enrolling…'}
        </p>
      </div>

      {/* Manual controls — only show if auto-capture hasn't finished */}
      {!done && captures.length < TARGET_FRAMES && (
        <div className="flex justify-center gap-3">
          <button
            onClick={() => {
              const det = detectionRef.current;
              if (!det || capturesRef.current.length >= TARGET_FRAMES) return;
              const newCapture = { descriptor: det.descriptor, score: det.detection.score };
              capturesRef.current = [...capturesRef.current, newCapture];
              setCaptures([...capturesRef.current]);
            }}
            disabled={!faceVisible}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded disabled:opacity-40 hover:bg-blue-700"
          >
            Capture Now
          </button>
          {captures.length > 0 && (
            <button onClick={handleReset} className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900">
              Reset
            </button>
          )}
        </div>
      )}

      {done && !enrolling && (
        <div className="flex justify-center">
          <button onClick={handleReset} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded">
            Re-enroll
          </button>
        </div>
      )}
    </div>
  );
}
