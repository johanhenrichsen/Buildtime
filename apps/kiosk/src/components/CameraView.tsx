import { RefObject, useEffect } from 'react';
import type { FaceDetection } from '../hooks/useFaceDetection';
import type { LivenessStatus } from '../hooks/useLiveness';
import type { EventType, KioskPhase } from '../types';
import { LIVENESS_FRAMES } from '../constants';

interface Props {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  detection: FaceDetection;
  livenessStatus: LivenessStatus;
  livenessFrameCount: number;
  phase: KioskPhase;
  selectedAction?: EventType;
  onCancel?: () => void;
  onUseEmployeeId?: () => void;
}

export function CameraView({
  videoRef,
  canvasRef,
  detection,
  livenessStatus,
  livenessFrameCount,
  phase,
  selectedAction,
  onCancel,
  onUseEmployeeId,
}: Props) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detection.box) {
      // Face guide oval when no face detected
      if (phase === 'scanning') {
        const cx = canvas.width / 2;
        const cy = canvas.height * 0.46;
        const rx = canvas.width * 0.20;
        const ry = canvas.height * 0.33;

        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      return;
    }

    const { x, y, width, height } = detection.box;

    ctx.lineWidth = 3;
    ctx.strokeStyle =
      phase === 'matching'        ? '#facc15' :
      livenessStatus === 'passed' ? '#22c55e' :
      livenessStatus === 'failed' ? '#ef4444' : '#ffffff';

    ctx.strokeRect(x, y, width, height);

    // Liveness progress bar
    if (phase === 'liveness' && livenessStatus === 'collecting') {
      const progress = Math.min(livenessFrameCount / LIVENESS_FRAMES, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y + height + 6, width, 4);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x, y + height + 6, width * progress, 4);
    }
  }, [detection.box, livenessStatus, livenessFrameCount, phase, canvasRef, videoRef]);

  const actionLabel = selectedAction === 'in' ? 'Clock In' : 'Clock Out';
  const actionBg    = selectedAction === 'in' ? 'bg-emerald-600' : 'bg-orange-600';

  const progress = Math.min(livenessFrameCount / LIVENESS_FRAMES, 1);
  const prompt =
    phase === 'scanning' ? 'Look at the camera' :
    phase === 'liveness' ? (
      livenessStatus === 'failed'
        ? 'Move slightly and hold still…'
        : `Hold still… ${Math.round(progress * 100)}%`
    ) :
    phase === 'matching' ? 'Verifying…' : '';

  return (
    <div className="relative w-full h-full bg-black">
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

      {/* Action banner */}
      {selectedAction && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 ${actionBg} text-white text-sm font-bold px-5 py-1.5 rounded-lg`}>
          {actionLabel}
        </div>
      )}

      {/* Prompt */}
      {prompt && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none">
          <span className="bg-black/70 text-white text-sm px-4 py-2 rounded-lg">
            {prompt}
          </span>
        </div>
      )}

      {/* Bottom controls */}
      {(onCancel || onUseEmployeeId) && (
        <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-4">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-5 py-2 text-sm text-white/70 bg-black/50 hover:bg-black/70 rounded-lg transition"
            >
              ← Cancel
            </button>
          )}
          {onUseEmployeeId && (
            <button
              onClick={onUseEmployeeId}
              className="px-5 py-2 text-sm text-white bg-black/50 hover:bg-black/70 rounded-lg transition font-medium"
            >
              Use Employee ID
            </button>
          )}
        </div>
      )}
    </div>
  );
}
