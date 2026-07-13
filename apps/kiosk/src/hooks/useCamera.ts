import { RefObject, useEffect, useState } from 'react';

export function useCamera(videoRef: RefObject<HTMLVideoElement>) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId = 0;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        // The <video> element may not be in the DOM yet (kiosk is still in 'init'
        // phase). Poll with rAF until videoRef.current is available.
        function attach() {
          const video = videoRef.current;
          if (!video) { rafId = requestAnimationFrame(attach); return; }
          video.srcObject = stream!;
          video.onloadedmetadata = () => {
            video.play().then(() => setReady(true)).catch(() => setReady(true));
          };
        }
        attach();
      } catch (e) {
        console.error('[useCamera] getUserMedia failed:', e);
        const name = e instanceof DOMException ? e.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera access denied — tap the lock icon in your browser, allow the camera, then refresh.'
            : name === 'NotFoundError'
              ? 'No camera found — connect a camera and refresh.'
              : name === 'NotReadableError'
                ? 'Camera is in use by another app — close it and refresh.'
                : `Camera error (${name || String(e)}) — refresh to retry.`
        );
      }
    }

    start();

    return () => {
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
      setReady(false);
    };
  }, [videoRef]);

  return { ready, error };
}
