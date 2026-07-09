import { RefObject, useEffect, useState } from 'react';

export function useCamera(videoRef: RefObject<HTMLVideoElement>) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play().then(() => setReady(true)).catch(() => setReady(true));
        };
      } catch (e) {
        setError(e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Camera access denied — please allow camera permission and refresh.'
          : 'Camera unavailable. Check device and refresh.');
      }
    }

    start();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      setReady(false);
    };
  }, [videoRef]);

  return { ready, error };
}
