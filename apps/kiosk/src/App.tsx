import { useCallback, useEffect, useRef, useState } from 'react';
import { loadModels } from './lib/faceApi';
import { refreshRoster, getRoster, getLastRefreshedAt } from './lib/roster';
import { findBestMatch } from './lib/matcher';
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
import type { CheckinResult, EventType, KioskPhase, MatchedWorker, RosterEntry } from './types';

const AUTO_RETRY_DELAY_MS = 30_000;

export default function App() {
  const [phase, setPhase]                     = useState<KioskPhase>('init');
  const [loadMsg, setLoadMsg]                 = useState('Loading face recognition models…');
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

  // Camera only active after an action has been selected
  const cameraActive = phase === 'scanning' || phase === 'liveness' || phase === 'matching';
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

  // ── Record the event and show result ────────────────────────────────────
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
  const handleMatch = useCallback(async (descriptor: Float32Array) => {
    if (matchingRef.current || !selectedAction) return;
    matchingRef.current = true;
    setPhase('matching');

    try {
      const roster = await getRoster();
      const match  = findBestMatch(descriptor, roster);

      if (!match || match.distance > MATCH_DIST_LOW) {
        playFail();
        showResult({ kind: 'no_match', message: 'Face not recognized — try Employee ID' });
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
      setPhase('scanning');
      liveness.reset();
    }
  }, [selectedAction, doRecord, showResult, liveness]);

  // ── Phase transitions ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'scanning' && detection.detected) setPhase('liveness');
    if (phase === 'liveness' && !detection.detected) { setPhase('scanning'); liveness.reset(); }
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
      const defaultEventType = await getExpectedEventType(entry.workerId);
      setMatchedWorker({ workerId: entry.workerId, name: entry.name, confidence: 1, matchMethod: 'manual_exception', flagged: false, defaultEventType });
      setPhase('choose');
    } catch {
      setPhase('idle');
    }
  }, []);

  // ── PIN choose handler ────────────────────────────────────────────────────
  const handleChoose = useCallback(async (eventType: EventType) => {
    if (!matchedWorker) return;
    const checkinResult = await doRecord(matchedWorker, eventType);
    showResult(checkinResult);
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

        {/* ── Idle: action selection screen ───────────────────────────────── */}
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

        {/* ── Camera: scanning, liveness, matching ────────────────────────── */}
        {cameraError && cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-4xl">📷</p>
            <p className="text-red-400 text-lg font-medium">Camera unavailable</p>
            <p className="text-slate-400 text-sm max-w-xs">{cameraError}</p>
            <button onClick={() => window.location.reload()} className="mt-2 px-6 py-2 bg-blue-600 rounded-lg text-sm">
              Refresh
            </button>
          </div>
        )}

        {/* Always mounted while camera phases are possible */}
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
