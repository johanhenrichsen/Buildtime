import { useCallback, useEffect, useRef, useState } from 'react';
import { loadModels } from './lib/faceApi';
import { refreshRoster, getRoster, getLastRefreshedAt } from './lib/roster';
import { findBestMatch } from './lib/matcher';
import { recordEvent, isRateLimited, getExpectedEventType, getPendingCount } from './lib/queue';
import { startSyncLoop, runSync } from './lib/sync';
import { playSuccess, playFlagged, playFail, playRateLimited } from './lib/audio';
import { useCamera } from './hooks/useCamera';
import { useFaceDetection } from './hooks/useFaceDetection';
import { useLiveness } from './hooks/useLiveness';
import { StatusBar } from './components/StatusBar';
import { CameraView } from './components/CameraView';
import { CheckinResult as CheckinResultView } from './components/CheckinResult';
import { PinEntry } from './components/PinEntry';
import { MATCH_DIST_HIGH, MATCH_DIST_LOW, RESULT_DISPLAY_MS } from './constants';
import type { CheckinResult, KioskPhase, RosterEntry } from './types';

const AUTO_RETRY_DELAY_MS = 30_000;

export default function App() {
  const [phase, setPhase]                     = useState<KioskPhase>('init');
  const [loadMsg, setLoadMsg]                 = useState('Loading face recognition models…');
  const [result, setResult]                   = useState<CheckinResult | null>(null);
  const [pendingCount, setPending]            = useState(0);
  const [rosterSize, setRosterSize]           = useState(0);
  const [isOnline, setIsOnline]               = useState(navigator.onLine);
  const [initError, setInitError]             = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown]   = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [pinRoster, setPinRoster]             = useState<RosterEntry[]>([]);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const matchingRef = useRef(false);

  // ── Camera + detection (declared early so handleMatch can capture them) ──
  const cameraActive = phase === 'idle' || phase === 'liveness' || phase === 'matching';
  const { ready: cameraReady, error: cameraError } = useCamera(videoRef);
  const detection = useFaceDetection(videoRef, cameraReady, cameraActive);
  const liveness  = useLiveness(detection);

  // ── Initialise models + roster ───────────────────────────────────────────
  const init = useCallback(async () => {
    setInitError(null);
    setRetryCountdown(0);
    setPhase('init');
    try {
      setLoadMsg('Loading face recognition models…');
      await loadModels();
      setLoadMsg('Fetching worker roster…');
      await refreshRoster();
      const roster = await getRoster();
      setRosterSize(roster.length);
      setPinRoster(roster);
      setLastRefreshedAt(getLastRefreshedAt());
      setPending(await getPendingCount());
      setPhase('idle');
      startSyncLoop((n) => setPending(n));
    } catch (e) {
      setInitError(String(e));
      setPhase('error');
      let remaining = AUTO_RETRY_DELAY_MS / 1000;
      setRetryCountdown(remaining);
      const tick = setInterval(() => {
        remaining -= 1;
        setRetryCountdown(remaining);
        if (remaining <= 0) clearInterval(tick);
      }, 1000);
      setTimeout(() => init(), AUTO_RETRY_DELAY_MS);
    }
  }, []);

  useEffect(() => { init(); }, [init]);

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

  // ── Roster refresh tick ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'idle') return;
    const id = setInterval(async () => {
      try {
        const roster = await refreshRoster();
        setRosterSize(roster.length);
        setPinRoster(roster);
        setLastRefreshedAt(getLastRefreshedAt());
      } catch { /* ignore refresh errors — stale cache still works */ }
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── Shared record logic ──────────────────────────────────────────────────
  const recordCheckin = useCallback(async (
    workerId: string,
    name: string,
    confidence: number,
    matchMethod: 'face' | 'face_low_confidence' | 'manual_exception',
    flagged: boolean,
  ): Promise<CheckinResult> => {
    const eventType   = await getExpectedEventType(workerId);
    const rateLimited = await isRateLimited(workerId, eventType);

    if (rateLimited) {
      playRateLimited();
      return { kind: 'rate_limited', workerName: name, message: 'Already scanned recently — please wait' };
    }

    await recordEvent({
      clientEventId:   crypto.randomUUID(),
      workerId,
      eventType,
      clientTs:        new Date().toISOString(),
      confidenceScore: confidence,
      matchMethod,
      flaggedForReview: flagged,
    });
    setPending((n) => n + 1);
    runSync((n) => setPending(n));

    if (flagged) {
      playFlagged();
      return { kind: 'flagged', workerName: name, eventType, confidence, message: 'Low confidence — flagged for HR review' };
    }
    playSuccess();
    return { kind: 'success', workerName: name, eventType, confidence, message: 'Check-in recorded' };
  }, []);

  // ── Face match handler ───────────────────────────────────────────────────
  const handleMatch = useCallback(async (descriptor: Float32Array) => {
    if (matchingRef.current) return;
    matchingRef.current = true;
    setPhase('matching');

    try {
      const roster = await getRoster();
      const match  = findBestMatch(descriptor, roster);

      let checkinResult: CheckinResult;

      if (!match || match.distance > MATCH_DIST_LOW) {
        playFail();
        checkinResult = { kind: 'no_match', message: 'Face not recognized — try PIN' };
      } else {
        const flagged = match.distance > MATCH_DIST_HIGH;
        checkinResult = await recordCheckin(
          match.workerId,
          match.name,
          match.confidence,
          flagged ? 'face_low_confidence' : 'face',
          flagged,
        );
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
  }, [recordCheckin, liveness]);

  // ── Phase transitions ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'idle' && detection.detected) setPhase('liveness');
    if (phase === 'liveness' && !detection.detected) { setPhase('idle'); liveness.reset(); }
  }, [detection.detected, phase]);

  useEffect(() => {
    if (phase === 'liveness' && liveness.status === 'passed' && detection.descriptor) {
      handleMatch(detection.descriptor);
    }
  }, [liveness.status, phase, detection.descriptor, handleMatch]);

  // ── PIN fallback ─────────────────────────────────────────────────────────
  const handlePinSuccess = useCallback(async (entry: RosterEntry) => {
    setPhase('matching');
    try {
      const checkinResult = await recordCheckin(entry.workerId, entry.name, 1, 'manual_exception', false);
      setResult(checkinResult);
      setPhase('result');
      setTimeout(() => { setResult(null); setPhase('idle'); }, RESULT_DISPLAY_MS);
    } catch {
      setPhase('idle');
    }
  }, [recordCheckin]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-900 text-white overflow-hidden flex flex-col">
      <StatusBar
        isOnline={isOnline}
        pendingCount={pendingCount}
        rosterSize={rosterSize}
        lastRefreshedAt={lastRefreshedAt}
      />

      <div className="flex-1 relative mt-9">
        {phase === 'init' && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-300">{loadMsg}</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <p className="text-red-400 text-xl font-bold">Setup failed</p>
            <p className="text-slate-400 text-sm max-w-sm">{initError}</p>
            {retryCountdown > 0 && (
              <p className="text-slate-500 text-xs">Auto-retrying in {retryCountdown}s…</p>
            )}
            <button onClick={init} className="mt-2 px-6 py-2 bg-blue-600 rounded-lg text-sm">
              Retry Now
            </button>
          </div>
        )}

        {cameraError && phase !== 'init' && phase !== 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <p className="text-4xl">📷</p>
            <p className="text-red-400 text-lg font-medium">Camera unavailable</p>
            <p className="text-slate-400 text-sm max-w-xs">{cameraError}</p>
            <button onClick={() => window.location.reload()} className="mt-2 px-6 py-2 bg-blue-600 rounded-lg text-sm">
              Refresh
            </button>
          </div>
        )}

        {/* Always mounted so videoRef.current is set when useCamera's effect runs */}
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

        {phase === 'idle' && !cameraError && (
          <button
            onClick={() => setPhase('pin')}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2 text-xs text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 rounded-full transition"
          >
            Use Employee ID instead
          </button>
        )}

        {phase === 'pin' && (
          <div className="absolute inset-0">
            <PinEntry roster={pinRoster} onSuccess={handlePinSuccess} onCancel={() => setPhase('idle')} />
          </div>
        )}

        {phase === 'result' && result && (
          <div className="absolute inset-0">
            <CheckinResultView result={result} />
          </div>
        )}
      </div>
    </div>
  );
}
