import { useCallback, useEffect, useRef, useState } from 'react';
import { LIVENESS_FRAMES, LIVENESS_VARIANCE_PX } from '../constants';
import type { FaceDetection } from './useFaceDetection';
import type { LivenessFrame } from '../types';

export type LivenessStatus = 'collecting' | 'passed' | 'failed';

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function checkLiveness(frames: LivenessFrame[]): boolean {
  const varX = stdDev(frames.map((f) => f.noseTipX));
  const varY = stdDev(frames.map((f) => f.noseTipY));
  return Math.sqrt(varX ** 2 + varY ** 2) >= LIVENESS_VARIANCE_PX;
}

export function useLiveness(detection: FaceDetection) {
  const framesRef      = useRef<LivenessFrame[]>([]);
  const descriptorsRef = useRef<Float32Array[]>([]);

  const [status, setStatus]           = useState<LivenessStatus>('collecting');
  const [frameCount, setFrameCount]   = useState(0);
  const [descriptors, setDescriptors] = useState<Float32Array[]>([]);

  useEffect(() => {
    if (!detection.detected || !detection.livenessFrame) {
      framesRef.current      = [];
      descriptorsRef.current = [];
      setFrameCount(0);
      if (status !== 'collecting') setStatus('collecting');
      return;
    }

    if (status === 'passed') return;

    framesRef.current.push(detection.livenessFrame);
    if (detection.descriptor) descriptorsRef.current.push(detection.descriptor);
    setFrameCount(framesRef.current.length);

    if (framesRef.current.length >= LIVENESS_FRAMES) {
      const passed = checkLiveness(framesRef.current);
      if (passed) {
        // Snapshot all accumulated descriptors for multi-frame matching
        setDescriptors([...descriptorsRef.current]);
        setStatus('passed');
      } else {
        // Slide the window: drop the oldest frame and descriptor
        framesRef.current.shift();
        descriptorsRef.current.shift();
        setStatus('failed');
        setTimeout(() => setStatus('collecting'), 500);
      }
    }
  }, [detection.livenessFrame]);

  const reset = useCallback(() => {
    framesRef.current      = [];
    descriptorsRef.current = [];
    setFrameCount(0);
    setDescriptors([]);
    setStatus('collecting');
  }, []);

  return { status, frameCount, descriptors, reset };
}
