import { useCallback, useEffect, useRef, useState } from 'react';
import { LIVENESS_FRAMES, LIVENESS_VARIANCE_PX, EAR_BLINK_THRESHOLD } from '../constants';
import type { FaceDetection } from './useFaceDetection';
import type { LivenessFrame } from '../types';

export type LivenessStatus = 'collecting' | 'passed' | 'failed';

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function checkLiveness(frames: LivenessFrame[]): boolean {
  // Require natural facial movement across frames — static images have near-zero variance
  const varX = stdDev(frames.map((f) => f.noseTipX));
  const varY = stdDev(frames.map((f) => f.noseTipY));
  const totalMovement = Math.sqrt(varX ** 2 + varY ** 2);

  if (totalMovement < LIVENESS_VARIANCE_PX) return false;

  // Bonus check: at least one blink detected across frames (not hard-blocked — some people
  // simply don't blink within the window, but it adds signal when present)
  // const hasBlink = frames.some((f) => f.ear < EAR_BLINK_THRESHOLD);
  // Uncomment above to require a blink for stricter liveness

  return true;
}

export function useLiveness(detection: FaceDetection) {
  const framesRef = useRef<LivenessFrame[]>([]);
  const [status, setStatus] = useState<LivenessStatus>('collecting');
  const [frameCount, setFrameCount] = useState(0);

  useEffect(() => {
    if (!detection.detected || !detection.livenessFrame) {
      // Face disappeared — reset accumulation
      framesRef.current = [];
      setFrameCount(0);
      if (status !== 'collecting') setStatus('collecting');
      return;
    }

    if (status === 'passed') return;  // already passed — don't keep appending

    framesRef.current.push(detection.livenessFrame);
    setFrameCount(framesRef.current.length);

    if (framesRef.current.length >= LIVENESS_FRAMES) {
      const passed = checkLiveness(framesRef.current);
      if (passed) {
        setStatus('passed');
      } else {
        // Slide the window: drop the oldest frame and keep collecting
        framesRef.current.shift();
        setStatus('failed');   // briefly indicate failure; collecting will resume
        setTimeout(() => setStatus('collecting'), 500);
      }
    }
  }, [detection.livenessFrame]);  // run whenever a new frame arrives

  const reset = useCallback(() => {
    framesRef.current = [];
    setFrameCount(0);
    setStatus('collecting');
  }, []);

  return { status, frameCount, reset };
}
