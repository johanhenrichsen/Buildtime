import { RefObject, useEffect } from 'react';
import type { FaceDetection } from '../hooks/useFaceDetection';
import type { LivenessStatus } from '../hooks/useLiveness';
import type { KioskPhase } from '../types';
import { LIVENESS_FRAMES } from '../constants';

interface Props {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  detection: FaceDetection;
  livenessStatus: LivenessStatus;
  livenessFrameCount: number;
  phase: KioskPhase;
}

export function CameraView({
  videoRef,
  canvasRef,
  detection,
  livenessStatus,
  livenessFrameCount,
  phase,
}: Props) {
  // Draw face bounding box overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detection.box) return;
    const { x, y, width, height } = detection.box;

    ctx.lineWidth = 3;
    ctx.strokeStyle =
      phase === 'matching' ? '#facc15' :
      livenessStatus === 'passed' ? '#22c55e' :
      livenessStatus === 'failed' ? '#ef4444' : '#3b82f6';

    ctx.strokeRect(x, y, width, height);

    // Liveness progress bar below the box
    if (phase === 'liveness' && livenessStatus === 'collecting') {
      const progress = Math.min(livenessFrameCount / LIVENESS_FRAMES, 1);
      ctx.fillStyle = 'rgba(59,130,246,0.6)';
      ctx.fillRect(x, y + height + 6, width * progress, 4);
    }
  }, [detection.box, livenessStatus, livenessFrameCount, phase, canvasRef, videoRef]);

  const prompt =
    phase === 'idle'      ? 'Position your face in the frame' :
    phase === 'liveness'  ? (livenessStatus === 'failed' ? 'Please move slightly…' : 'Hold still…') :
    phase === 'matching'  ? 'Identifying…' : '';

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
        autoPlay
        muted
        playsInline
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ transform: 'scaleX(-1)' }}
      />
      {prompt && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <span className="bg-black/60 text-white text-sm px-4 py-2 rounded-full">
            {prompt}
          </span>
        </div>
      )}
    </div>
  );
}
