import { RefObject, useEffect, useRef } from 'react';
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

// ── Colour palette per state ─────────────────────────────────────────────────
function stateColor(phase: KioskPhase, status: LivenessStatus): [number, number, number, number] {
  if (phase === 'matching')       return [250, 204,  21, 0.90]; // amber
  if (status === 'passed')        return [ 34, 197,  94, 1.00]; // green
  if (status === 'failed')        return [239,  68,  68, 0.65]; // red
  return [255, 255, 255, 0.85];                                  // white
}

// ── Corner bracket helper ────────────────────────────────────────────────────
function drawBrackets(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number, g: number, b: number, alpha: number,
) {
  const cw  = Math.min(w * 0.22, 30);
  const ch  = Math.min(h * 0.22, 30);

  ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.setLineDash([]);

  // Top-left
  ctx.beginPath(); ctx.moveTo(x, y + ch);     ctx.lineTo(x, y);         ctx.lineTo(x + cw, y);     ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(x + w - cw, y); ctx.lineTo(x + w, y);     ctx.lineTo(x + w, y + ch); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(x, y + h - ch); ctx.lineTo(x, y + h);     ctx.lineTo(x + cw, y + h); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(x + w - cw, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - ch); ctx.stroke();
}

export function CameraView({
  videoRef, canvasRef,
  detection, livenessStatus, livenessFrameCount,
  phase, selectedAction,
  onCancel, onUseEmployeeId,
}: Props) {
  // Refs so the RAF loop always sees current values without re-registering
  const detRef    = useRef(detection);
  const statusRef = useRef(livenessStatus);
  const countRef  = useRef(livenessFrameCount);
  const phaseRef  = useRef(phase);

  useEffect(() => { detRef.current    = detection;         }, [detection]);
  useEffect(() => { statusRef.current = livenessStatus;    }, [livenessStatus]);
  useEffect(() => { countRef.current  = livenessFrameCount;}, [livenessFrameCount]);
  useEffect(() => { phaseRef.current  = phase;             }, [phase]);

  // Animation-local state via refs
  const smoothBox  = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const scanPos    = useRef(0);
  const lastTs     = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    let raf: number;

    function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

    function frame(ts: number) {
      const dt = Math.min(ts - (lastTs.current || ts), 50); // cap to prevent post-tab jumps
      lastTs.current = ts;

      // Keep canvas in sync with video dimensions
      const W = video.videoWidth  || 640;
      const H = video.videoHeight || 480;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width  = W;
        canvas.height = H;
      }

      const ctx    = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);

      const box    = detRef.current.box;
      const status = statusRef.current;
      const count  = countRef.current;
      const ph     = phaseRef.current;

      // ── No face detected — animated guide oval ─────────────────────────
      if (!box) {
        smoothBox.current = null;
        scanPos.current   = 0;

        const cx = W / 2;
        const cy = H * 0.45;
        const rx = W * 0.21;
        const ry = H * 0.32;

        // Softly pulsing opacity
        const pulse = 0.15 + 0.07 * Math.sin(ts / 750);

        // Outer dim oval
        ctx.strokeStyle    = `rgba(255,255,255,${pulse * 0.5})`;
        ctx.lineWidth      = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx + 4, ry + 4, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Main dashed oval with animated offset (gives a "spinning" effect)
        ctx.strokeStyle    = `rgba(255,255,255,${pulse + 0.12})`;
        ctx.lineWidth      = 1.5;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -(ts / 22) % 11;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        raf = requestAnimationFrame(frame);
        return;
      }

      // ── Face detected — smooth-track the box ──────────────────────────
      const target = { x: box.x, y: box.y, w: box.width, h: box.height };

      if (!smoothBox.current) {
        smoothBox.current = { ...target };
      } else {
        const sp  = smoothBox.current;
        const k   = Math.min(1, (dt / 1000) * 14); // ~14x per second
        sp.x = lerp(sp.x, target.x, k);
        sp.y = lerp(sp.y, target.y, k);
        sp.w = lerp(sp.w, target.w, k);
        sp.h = lerp(sp.h, target.h, k);
      }

      const { x, y, w, h } = smoothBox.current;
      const [r, g, b, alpha] = stateColor(ph, status);

      // ── Scan line (collecting only) ─────────────────────────────────────
      if (status === 'collecting' && ph !== 'matching') {
        scanPos.current = (scanPos.current + dt / 1600) % 1;
        const sy = y + scanPos.current * h;

        // Subtle glow above the scan line
        const glow = ctx.createLinearGradient(x, y, x, sy);
        glow.addColorStop(0, `rgba(${r},${g},${b},0)`);
        glow.addColorStop(1, `rgba(${r},${g},${b},0.04)`);
        ctx.fillStyle = glow;
        ctx.fillRect(x, y, w, scanPos.current * h);

        // The scan line — horizontal gradient fades at edges
        const line = ctx.createLinearGradient(x, 0, x + w, 0);
        line.addColorStop(0,    `rgba(${r},${g},${b},0)`);
        line.addColorStop(0.12, `rgba(${r},${g},${b},0.65)`);
        line.addColorStop(0.5,  `rgba(${r},${g},${b},1)`);
        line.addColorStop(0.88, `rgba(${r},${g},${b},0.65)`);
        line.addColorStop(1,    `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = line;
        ctx.fillRect(x, sy - 1, w, 2.5);
      } else if (status !== 'collecting') {
        scanPos.current = 0;
      }

      // ── Corner brackets ─────────────────────────────────────────────────
      // Subtle inner glow brackets (larger, more transparent) for depth
      drawBrackets(ctx, x - 1, y - 1, w + 2, h + 2, r, g, b, alpha * 0.15);
      // Main brackets
      drawBrackets(ctx, x, y, w, h, r, g, b, alpha);

      // ── Circular liveness progress arc ──────────────────────────────────
      if (status === 'collecting' && count > 0) {
        const progress = Math.min(count / LIVENESS_FRAMES, 1);
        const cx2      = x + w / 2;
        const cy2      = y + h / 2;
        // Radius just outside the face box diagonal
        const radius   = Math.hypot(w / 2, h / 2) + 10;
        const startAng = -Math.PI / 2;
        const endAng   = startAng + progress * Math.PI * 2;

        // Dim background ring
        ctx.strokeStyle = `rgba(255,255,255,0.07)`;
        ctx.lineWidth   = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(cx2, cy2, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Filled progress arc
        ctx.strokeStyle = `rgba(${r},${g},${b},0.75)`;
        ctx.lineWidth   = 2.5;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.arc(cx2, cy2, radius, startAng, endAng);
        ctx.stroke();
      }

      // ── Success fill flash (gentle green tint) ───────────────────────────
      if (status === 'passed') {
        const flash = 0.05 + 0.03 * Math.sin(ts / 160);
        ctx.fillStyle = `rgba(34,197,94,${flash})`;
        ctx.fillRect(x, y, w, h);
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, videoRef]); // stable — changing values read via refs

  // ── Derived prompt text ──────────────────────────────────────────────────
  const progress = Math.min(livenessFrameCount / LIVENESS_FRAMES, 1);
  const prompt =
    phase === 'scanning' ? 'Position your face in the oval' :
    phase === 'liveness' ? (
      livenessStatus === 'failed'
        ? 'Keep still — move slightly to reset'
        : livenessStatus === 'passed'
        ? 'Verifying…'
        : `Hold still… ${Math.round(progress * 100)}%`
    ) :
    phase === 'matching' ? 'Verifying…' : '';

  const actionLabel = selectedAction === 'in' ? 'Clock In' : 'Clock Out';
  const actionColor = selectedAction === 'in' ? '#059669' : '#ea580c';

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
        autoPlay muted playsInline
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Action label — subtle pill top-center */}
      {selectedAction && (
        <div
          className="absolute top-5 left-1/2 -translate-x-1/2 text-white text-xs font-semibold px-4 py-1.5 rounded-full tracking-wide"
          style={{ backgroundColor: actionColor + 'cc', backdropFilter: 'blur(4px)' }}
        >
          {actionLabel}
        </div>
      )}

      {/* Status prompt — bottom of frame, clean glassy pill */}
      {prompt && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none">
          <div
            className="text-white text-sm px-5 py-2 rounded-full font-medium"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {prompt}
          </div>
        </div>
      )}

      {/* Cancel / Use Employee ID buttons */}
      {(onCancel || onUseEmployeeId) && (
        <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-sm text-white/70 rounded-full font-medium transition-colors active:opacity-60"
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              ← Back
            </button>
          )}
          {onUseEmployeeId && (
            <button
              onClick={onUseEmployeeId}
              className="px-5 py-2.5 text-sm text-white font-semibold rounded-full transition-colors active:opacity-60"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              Use Employee ID
            </button>
          )}
        </div>
      )}
    </div>
  );
}
