import { RefObject, useEffect, useRef, useState } from 'react';
import { detectFace, computeEAR } from '../lib/faceApi';
import { DETECTION_INTERVAL_MS } from '../constants';
import type { LivenessFrame } from '../types';

export interface FaceDetection {
  detected: boolean;
  descriptor: Float32Array | null;
  livenessFrame: LivenessFrame | null;
  box: { x: number; y: number; width: number; height: number } | null;
}

export function useFaceDetection(
  videoRef: RefObject<HTMLVideoElement>,
  cameraReady: boolean,
  active: boolean,
): FaceDetection {
  const [detection, setDetection] = useState<FaceDetection>({
    detected: false,
    descriptor: null,
    livenessFrame: null,
    box: null,
  });

  const lastRunRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active || !cameraReady) {
      setDetection({ detected: false, descriptor: null, livenessFrame: null, box: null });
      return;
    }

    let alive = true;

    async function loop() {
      if (!alive) return;

      const now = performance.now();
      if (now - lastRunRef.current >= DETECTION_INTERVAL_MS) {
        lastRunRef.current = now;
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          try {
            const result = await detectFace(video);
            if (!alive) return;

            if (result) {
              const noseTip = result.landmarks.getNose()[3];
              setDetection({
                detected: true,
                descriptor: result.descriptor,
                livenessFrame: {
                  noseTipX: noseTip.x,
                  noseTipY: noseTip.y,
                  ear: computeEAR(result.landmarks),
                },
                box: {
                  x: result.detection.box.x,
                  y: result.detection.box.y,
                  width: result.detection.box.width,
                  height: result.detection.box.height,
                },
              });
            } else {
              setDetection({ detected: false, descriptor: null, livenessFrame: null, box: null });
            }
          } catch {
            // Detection errors are transient — keep looping
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, cameraReady, videoRef]);

  return detection;
}
