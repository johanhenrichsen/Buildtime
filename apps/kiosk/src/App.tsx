import { useCallback, useEffect, useRef, useState } from 'react';
import { loadModels } from './lib/faceApi';
import { initRoster, refreshRoster, getRoster, getLastRefreshedAt } from './lib/roster';
import { recordEvent, getExpectedEventType, getPendingCount } from './lib/queue';
import { startSyncLoop, runSync } from './lib/sync';
import { playSuccess, playFlagged, playFail } from './lib/audio';
import { useCamera } from './hooks/useCamera';
import { useFaceDetection } from './hooks/useFaceDetection';
import { useLiveness } from './hooks/useLiveness';
import { StatusBar } from './components/StatusBar';
import { CameraView } from './components/CameraView';
import { CheckinResult as CheckinResultView } from './components/CheckinResult';
import { ChooseAction } from './components/ChooseAction';
import { PinEntry } from './components/PinEntry';
import { MATCH_DIST_HIGH, MATCH_DIST_LOW, RESULT_DISPLAY_MS } from './constants';
import { findBestMatchMulti } from './lib/matcher';
import type { CheckinResult, EventType, KioskPhase, MatchedWorker, RosterEntry } from './types';

const AUTO_RETRY_DELAY_MS = 30_000;

function friendlyInitError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('timed out') || msg.includes('timeout'))
    return 'Network is too slow — check your connection. Retrying…';
  if (msg.includes('authentication') || msg.includes('401') || msg.includes('403'))
    return 'Device not recognized — contact your supervisor.';
  if (msg.includes('roster') || msg.includes('worker list'))
    return 'Could not load worker list. Retrying…';
  if (msg.includes('No worker roster'))
    return 'No worker data yet — connect to the network and retry.';
  return 'Setup failed — check your connection and tap Retry.';
}

export default function App() {
  const [phase, setPhase]                     = useState<KioskPhase>('init');
  const [loadMsg, setLoadMsg]                 = useState('Starting up…');
  const [result, setResult]                   = useState<CheckinResult | null>(null);
  const [selectedAction, setSelectedAction]   = useState<EventType | null>(null);
  const [matchedWorker, setMatchedWorker]     = useState<MatchedWorker | null>(null);
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

  // Camera always warms up immediately — detection only starts once action is selected
  // PRODUCT DECISION: set cameraActive=true during 'idle' to show live preview on action screen.
  // Pro: workers see themselves, can position better. Con: shows camera feed while choosing.
  const cameraActive = phase === 'scanning' || phase === 'liveness' || phase === 'matching';
  const { ready: cameraReady, error: cameraError } = useCamera(videoRef);
  const detection = useFaceDetection(videoRef, cameraReady, cameraActive);
  const liveness  = useLiveness(detection);

  // ── Initialise: models + roster load in parallel ─────────────────────────
  const init = useCallback(async () => {
    setInitError(null);
    setRetryCountdown(0);
    setPhase('init');
    setLoadMsg('Starting up…');
    try {
      // Parallel load: face models (from cache after first run) + roster (from network or IDB cache)
      const [roster] = await Promise.all([initRoster(), loadModels()]);
      setRosterSize(roster.length);
      setPinRoster(roster);
      setLastRefreshedAt(getLastRefreshedAt());
      setPending(await getPendingCount());
      setPhase('idle');
      startSyncLoop((n) => setPending(n));
    } catch (e) {
      setInitError(friendlyInitError(e));
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

  // ── Background roster refresh ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'idle') return;
    const id = setInterval(async () => {
      try {
        const roster = await refreshRoster();
        setRosterSize(roster.length);
        setPinRoster(roster);
        setLastRefreshedAt(getLastRefreshedAt());
      } catch { /* non-fatal — stale cache still works */ }
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── Worker selects action on idle screen ─────────────────────────────────
  const handleSelectAction = useCallback((action: EventType) => {
    setSelectedAction(action);
    setPhase('scanning');
  }, []);

  // ── Cancel scanning, return to action selection ───────────────────────────
  const handleCancelScan = useCallback(() => {
    setSelectedAction(null);
    liveness.reset();
    matchingRef.current = false;
    setPhase('idle');
  }, [liveness]);

  // ── Record the event and build result ────────────────────────────────────
  const doRecord = useCallback(async (
    worker: { workerId: string; name: string; confidence: number; matchMethod: MatchedWorker['matchMethod']; flagged: boolean },
    eventType: EventType,
  ): Promise<CheckinResult> => {
    await recordEvent({
      clientEventId:    crypto.randomUUID(),
      workerId:         worker.workerId,
      eventType,
      clientTs:         new Date().toISOString(),
      confidenceScore:  worker.confidence,
      matchMethod:      worker.matchMethod,
      flaggedForReview: worker.flagged,
    });
    setPending((n) => n + 1);
    runSync((n) => setPending(n));

    const time  = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    const label = eventType === 'in' ? 'Clocked in' : 'Clocked out';

    if (worker.flagged) {
      playFlagged();
      return { kind: 'flagged', workerName: worker.name, eventType, confidence: worker.confidence, message: `${label} at ${time} — flagged for HR review` };
    }
    playSuccess();
    return { kind: 'success', workerName: worker.name, eventType, confidence: worker.confidence, message: `${label} at ${time}` };
  }, []);

  // ── Show result then return to idle ─────────────────────────────────────
  const showResult = useCallback((checkinResult: CheckinResult) => {
    setResult(checkinResult);
    setSelectedAction(null);
    setMatchedWorker(null);
    setPhase('result');
    setTimeout(() => {
      setResult(null);
      matchingRef.current = false;
      liveness.reset();
      setPhase('idle');
    }, RESULT_DISPLAY_MS);
  }, [liveness]);

  // ── Face match handler ───────────────────────────────────────────────────
  // Takes all descriptors collected during the liveness window and picks the
  // frame with the lowest distance — one blurry or off-angle frame won't fail.
  const handleMatch = useCallback(async (descriptors: Float32Array[]) => {
    if (matchingRef.current || !selectedAction) return;
    matchingRef.current = true;
    setPhase('matching');

    try {
      const roster = await getRoster();
      const match  = findBestMatchMulti(descriptors, roster);

      if (!match || match.distance > MATCH_DIST_LOW) {
        playFail();
        showResult({ kind: 'no_match', message: 'Face not recognized — use Employee ID below or ask your supervisor' });
        return;
      }

      const flagged = match.distance > MATCH_DIST_HIGH;
      const checkinResult = await doRecord(
        { workerId: match.workerId, name: match.name, confidence: match.confidence, matchMethod: flagged ? 'face_low_confidence' : 'face', flagged },
        selectedAction,
      );
      showResult(checkinResult);
    } catch {
      matchingRef.current = false;
      liveness.reset();
      showResult({ kind: 'no_match', message: 'Could not record — check your connection and try again' });
    }
  }, [selectedAction, doRecord, showResult, liveness]);

  // ── Phase transitions ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'scanning' && detection.detected) setPhase('liveness');
    if (phase === 'liveness' && !detection.detected) { setPhase('scanning'); liveness.reset(); }
  }, [detection.detected, phase]);

  useEffect(() => {
    if (phase === 'liveness' && liveness.status === 'passed' && liveness.descriptors.length > 0) {
      handleMatch(liveness.descriptors);
    }
  }, [liveness.status, liveness.descriptors, phase, handleMatch]);

  // ── PIN fallback ─────────────────────────────────────────────────────────
  const handlePinSuccess = useCallback(async (entry: RosterEntry) => {
    setPhase('matching');
    try {
      const defaultEventType = await getExpectedEventType(entry.workerId);
      setMatchedWorker({ workerId: entry.workerId, name: entry.name, confidence: 1, matchMethod: 'manual_exception', flagged: false, defaultEventType });
      setPhase('choose');
    } catch {
      // IDB read failed — still safe to proceed, just default to 'in'
      setMatchedWorker({ workerId: entry.workerId, name: entry.name, confidence: 1, matchMethod: 'manual_exception', flagged: false, defaultEventType: 'in' });
      setPhase('choose');
    }
  }, []);

  // ── PIN choose handler ────────────────────────────────────────────────────
  const handleChoose = useCallback(async (eventType: EventType) => {
    if (!matchedWorker) return;
    try {
      const checkinResult = await doRecord(matchedWorker, eventType);
      showResult(checkinResult);
    } catch {
      showResult({ kind: 'no_match', message: 'Could not record — check your connection and try again' });
    }
  }, [matchedWorker, doRecord, showResult]);

  const handleCancelChoose = useCallback(() => {
    setMatchedWorker(null);
    matchingRef.current = false;
    setPhase('idle');
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-900 text-white overflow-hidden flex flex-col">
      <StatusBar
        isOnline={isOnline}
        pendingCount={pendingCount}
        rosterSize={rosterSize}
        lastRefreshedAt={lastRefreshedAt}
      />

      <div className="flex-1 relative mt-9 overflow-hidden">
        {phase === 'init' && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-300">{loadMsg}</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <p className="text-5xl mb-2">⚠️</p>
            <p className="text-red-400 text-xl font-bold">Kiosk offline</p>
            <p className="text-slate-300 text-base max-w-sm">{initError}</p>
            {retryCountdown > 0 && (
              <p className="text-slate-500 text-sm">Auto-retrying in {retryCountdown}s…</p>
            )}
            <button
              onClick={() => { localStorage.removeItem('kiosk_token'); init(); }}
              className="mt-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-base font-semibold active:scale-95 transition-transform"
            >
              Retry Now
            </button>
          </div>
        )}

        {/* ── Idle: action selection ─────────────────────────────────────── */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full gap-5 px-8">
            <p className="text-slate-400 text-sm tracking-widest uppercase mb-2">What would you like to do?</p>

            <button
              onClick={() => handleSelectAction('in')}
              className="w-full max-w-sm py-8 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white text-3xl font-black tracking-wide transition-transform shadow-lg shadow-emerald-500/30"
            >
              Clock In
            </button>

            <button
              onClick={() => handleSelectAction('out')}
              className="w-full max-w-sm py-8 rounded-2xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-white text-3xl font-black tracking-wide transition-transform shadow-lg shadow-orange-500/30"
            >
              Clock Out
            </button>

            <button
              onClick={() => setPhase('pin')}
              className="w-full max-w-sm py-4 rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-95 text-white text-lg font-semibold transition-transform border border-slate-600 flex items-center justify-center gap-2"
            >
              <span className="text-xl">🪪</span>
              Use Employee ID
            </button>
          </div>
        )}

        {/* Camera error overlay — only show when camera phases are active */}
        {cameraError && cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-4xl">📷</p>
            <p className="text-red-400 text-lg font-bold">Camera unavailable</p>
            <p className="text-slate-300 text-sm max-w-xs">{cameraError}</p>
            <button onClick={handleCancelScan} className="mt-2 px-6 py-2 bg-slate-700 rounded-lg text-sm">
              ← Go Back
            </button>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-blue-600 rounded-lg text-sm">
              Reload Page
            </button>
          </div>
        )}

        {/* Always mounted — camera stream is warm before user selects action */}
        <div className={`absolute inset-0 ${!cameraActive || cameraError ? 'hidden' : ''}`}>
          <CameraView
            videoRef={videoRef}
            canvasRef={canvasRef}
            detection={detection}
            livenessStatus={liveness.status}
            livenessFrameCount={liveness.frameCount}
            phase={phase}
            selectedAction={selectedAction ?? undefined}
            onCancel={phase === 'scanning' ? handleCancelScan : undefined}
            onUseEmployeeId={phase === 'scanning' ? () => { handleCancelScan(); setPhase('pin'); } : undefined}
          />
        </div>

        {phase === 'pin' && (
          <div className="absolute inset-0">
            <PinEntry roster={pinRoster} onSuccess={handlePinSuccess} onCancel={() => setPhase('idle')} />
          </div>
        )}

        {phase === 'choose' && matchedWorker && (
          <div className="absolute inset-0">
            <ChooseAction
              worker={matchedWorker}
              onChoose={handleChoose}
              onCancel={handleCancelChoose}
              rateLimitError={null}
            />
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
