import { useCallback, useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { enrollWorker } from '../lib/api';

const MODEL_PATH = '/models';
const MIN_CAPTURES = 3;
const MAX_CAPTURES = 5;

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

interface Props {
  workerId: string;
  onResult: (msg: string, success: boolean) => void;
}

export function EnrollmentCamera({ workerId, onResult }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [modelsReady, setModelsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detection, setDetection]     = useState<faceapi.FaceDetection | null>(null);
  const [captures, setCaptures]       = useState<{ descriptor: Float32Array; score: number }[]>([]);
  const [enrolling, setEnrolling]     = useState(false);

  const detectionRef = useRef<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>> | null>(null);
  const rafRef       = useRef<number | null>(null);

  // Load models + start camera
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

  // Detection loop
  useEffect(() => {
    if (!modelsReady) return;

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
      setDetection(result?.detection ?? null);

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
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth   = 2;
            ctx.strokeRect(x, y, width, height);
          }
        }
      }

      rafRef.current = requestAnimationFrame(detect);
    }

    rafRef.current = requestAnimationFrame(detect);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [modelsReady]);

  const handleCapture = useCallback(() => {
    const det = detectionRef.current;
    if (!det) return;
    setCaptures(prev => [
      ...prev,
      { descriptor: det.descriptor, score: det.detection.score },
    ]);
  }, []);

  const handleEnroll = useCallback(async () => {
    if (captures.length < MIN_CAPTURES) return;
    setEnrolling(true);
    try {
      const descriptors  = captures.map(c => c.descriptor);
      const avgDesc      = averageDescriptors(descriptors);
      const qualityScore = captures.reduce((s, c) => s + c.score, 0) / captures.length;

      await enrollWorker(workerId, Array.from(avgDesc), qualityScore);
      setCaptures([]);
      onResult('Enrollment successful', true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onResult(msg.includes('409') || msg.includes('already') ? `Re-enrollment: ${msg}` : `Error: ${msg}`, false);
    } finally {
      setEnrolling(false);
    }
  }, [captures, workerId, onResult]);

  if (cameraError) {
    return <div className="text-red-600 text-sm p-4 bg-red-50 rounded">{cameraError}</div>;
  }

  if (!modelsReady) {
    return <div className="text-slate-500 text-sm p-4">Loading face recognition models…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-md mx-auto aspect-video bg-black rounded overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      </div>

      <div className="flex items-center gap-4 justify-center">
        <p className="text-sm text-slate-600">
          Captures: {captures.length}/{MAX_CAPTURES}
        </p>

        {captures.length < MAX_CAPTURES && (
          <button
            onClick={handleCapture}
            disabled={!detection}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded disabled:opacity-40 hover:bg-blue-700"
          >
            Capture
          </button>
        )}

        {captures.length >= MIN_CAPTURES && (
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded disabled:opacity-40 hover:bg-green-700"
          >
            {enrolling ? 'Enrolling…' : 'Enroll'}
          </button>
        )}

        {captures.length > 0 && (
          <button
            onClick={() => setCaptures([])}
            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
          >
            Reset
          </button>
        )}
      </div>

      {!detection && (
        <p className="text-center text-sm text-slate-400">Position a face in the frame to capture</p>
      )}
    </div>
  );
}
