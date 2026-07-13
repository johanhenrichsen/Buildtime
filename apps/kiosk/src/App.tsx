import { useCallback, useEffect, useRef, useState } from 'react';
import { loadModels } from './lib/faceApi';
import { refreshRoster, getRoster } from './lib/roster';
import { findBestMatch } from './lib/matcher';
import { recordEvent, isRateLimited, getExpectedEventType, getPendingCount } from './lib/queue';
import { startSyncLoop, runSync } from './lib/sync';
import { useCamera } from './hooks/useCamera';
import { useFaceDetection } from './hooks/useFaceDetection';
import { useLiveness } from './hooks/useLiveness';
import { StatusBar } from './components/StatusBar';
import { CameraView } from './components/CameraView';
import { CheckinResult as CheckinResultView } from './components/CheckinResult';
import { MATCH_DIST_HIGH, MATCH_DIST_LOW, RESULT_DISPLAY_MS } from './constants';
import type { CheckinResult, KioskPhase } from './types';

export default function App() {
  const [phase, setPhase]           = useState<KioskPhase>('init');
  const [loadMsg, setLoadMsg]       = useState('Loading face recognition models…');
  const [result, setResult]         = useState<CheckinResult | null>(null);
  const [pendingCount, setPending]  = useState(0);
  const [rosterSize, setRosterSize] = useState(0);
  const [isOnline, setIsOnline]     = useState(navigator.onLine);
  const [initError, setInitError]   = useState<string | null>(null);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const matchingRef = useRef(false);  // guard against concurrent match calls

  // ── Initialise models + roster ───────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        setLoadMsg('Loading face recognition models…');
        await loadModels();
        setLoadMsg('Fetching worker roster…');
        await refreshRoster();
        const roster = await getRoster();
        setRosterSize(roster.length);
        setPending(await getPendingCount());
        setPhase('idle');
        startSyncLoop((n) => setPending(n));
      } catch (e) {
        setInitError(String(e));
        setPhase('error');
      }
    }
    init();
  }, []);

  // ── Online / offline events ───────────────────────────────────────────────
  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  runSync((n) => setPending(n)); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── Camera + detection (only active when kiosk is idle/liveness/matching) ─
  const cameraActive = phase === 'idle' || phase === 'liveness' || phase === 'matching';
  const { ready: cameraReady, error: cameraError } = useCamera(videoRef);
  const detection = useFaceDetection(videoRef, cameraReady, cameraActive);
  const liveness  = useLiveness(detection);

  // ── Phase transitions ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'idle' && detection.detected) {
      setPhase('liveness');
    }
    if (phase === 'liveness' && !detection.detected) {
      setPhase('idle');
      liveness.reset();
    }
  }, [detection.detected, phase]);

  const handleMatch = useCallback(async (descriptor: Float32Array) => {
    if (matchingRef.current) return;
    matchingRef.current = true;
    setPhase('matching');

    try {
      const roster = await getRoster();
      const match  = findBestMatch(descriptor, roster);

      let checkinResult: CheckinResult;

      if (!match || match.distance > MATCH_DIST_LOW) {
        checkinResult = { kind: 'no_match', message: 'Face not recognized' };
      } else {
        const flagged     = match.distance > MATCH_DIST_HIGH;
        const eventType   = await getExpectedEventType(match.workerId);
        const rateLimited = await isRateLimited(match.workerId, eventType);

        if (rateLimited) {
          checkinResult = {
            kind: 'rate_limited',
            workerName: match.name,
            message: 'Already scanned recently — please wait',
          };
        } else {
          const matchMethod = flagged ? 'face_low_confidence' : 'face';
          await recordEvent({
            clientEventId:   crypto.randomUUID(),
            workerId:        match.workerId,
            eventType,
            clientTs:        new Date().toISOString(),
            confidenceScore: match.confidence,
            matchMethod,
            flaggedForReview: flagged,
          });
          setPending((n) => n + 1);

          checkinResult = {
            kind:       flagged ? 'flagged' : 'success',
            workerName: match.name,
            eventType,
            confidence: match.confidence,
            message:    flagged
              ? 'Low confidence — flagged for HR review'
              : `${eventType.toUpperCase()} recorded`,
          };
        }
      }

      setResult(checkinResult);
      setPhase('result');

      setTimeout(() => {
        setResult(null);
        liveness.reset();
        matchingRef.current = false;
        setPhase('idle');
      }, RESULT_DISPLAY_MS);
    } catch {
      matchingRef.current = false;
      setPhase('idle');
      liveness.reset();
    }
  }, [liveness]);

  // Trigger match when liveness passes
  useEffect(() => {
    if (phase === 'liveness' && liveness.status === 'passed' && detection.descriptor) {
      handleMatch(detection.descriptor);
    }
  }, [liveness.status, phase, detection.descriptor, handleMatch]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-900 text-white overflow-hidden flex flex-col">
      <StatusBar isOnline={isOnline} pendingCount={pendingCount} rosterSize={rosterSize} />

      <div className="flex-1 relative mt-9">
        {phase === 'init' && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-300">{loadMsg}</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <p className="text-red-400 text-lg">Setup failed</p>
            <p className="text-slate-400 text-sm">{initError ?? cameraError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-blue-600 rounded-lg"
            >
              Retry
            </button>
          </div>
        )}

        {cameraError && phase !== 'init' && phase !== 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <p className="text-4xl">📷</p>
            <p className="text-red-400 text-lg font-medium">Camera unavailable</p>
            <p className="text-slate-400 text-sm max-w-xs">{cameraError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-6 py-2 bg-blue-600 rounded-lg text-sm"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Always mounted so videoRef.current is set when useCamera's effect runs.
            Hidden (display:none) until the kiosk is ready — stream still attaches. */}
        <div className={`h-full w-full ${!cameraActive || cameraError ? 'hidden' : ''}`}>
          <CameraView
            videoRef={videoRef}
            canvasRef={canvasRef}
            detection={detection}
            livenessStatus={liveness.status}
            livenessFrameCount={liveness.frameCount}
            phase={phase}
          />
        </div>

        {phase === 'result' && result && <CheckinResultView result={result} />}
      </div>
    </div>
  );
}
