import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { loadModels } from './lib/faceApi';
import { initRoster, refreshRoster, getRoster, getLastRefreshedAt } from './lib/roster';
import { recordEvent, getExpectedEventType, getPendingCount } from './lib/queue';
import { startSyncLoop, runSync } from './lib/sync';
import { playSuccess, playFlagged, playFail } from './lib/audio';
import { useCamera } from './hooks/useCamera';
import { useFaceDetection } from './hooks/useFaceDetection';
import { useLiveness } from './hooks/useLiveness';
import { StatusBar } from './components/StatusBar';
import { SplashScreen } from './components/SplashScreen';
import { CameraView } from './components/CameraView';
import { CheckinResult as CheckinResultView } from './components/CheckinResult';
import { ChooseAction } from './components/ChooseAction';
import { PinEntry } from './components/PinEntry';
import { AdvanceForm } from './components/AdvanceForm';
import { SelfService } from './components/SelfService';
import { MATCH_DIST_HIGH, MATCH_DIST_LOW, RESULT_DISPLAY_MS } from './constants';
import { requestAdvance } from './lib/api';
import { findBestMatchMulti } from './lib/matcher';
import type { CheckinResult, EventType, KioskPhase, MatchedWorker, RosterEntry } from './types';

const AUTO_RETRY_DELAY_MS = 30_000;
const SPLASH_MIN_MS       = 1_600;  // minimum time splash stays visible

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

  const [advanceWorker, setAdvanceWorker] = useState<RosterEntry | null>(null);

  const videoRef        = useRef<HTMLVideoElement>(null);
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const matchingRef     = useRef(false);
  const splashOpenedAt  = useRef(Date.now());
  const [splashVisible,  setSplashVisible]  = useState(true);
  const [splashExiting,  setSplashExiting]  = useState(false);

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

  // ── Splash exit — wait for minimum display time then slide up ────────────
  useEffect(() => {
    if (phase === 'init' || !splashVisible || splashExiting) return;
    const elapsed   = Date.now() - splashOpenedAt.current;
    const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
    const id = setTimeout(() => {
      setSplashExiting(true);
      setTimeout(() => setSplashVisible(false), 700); // match CSS duration-700
    }, remaining);
    return () => clearTimeout(id);
  }, [phase, splashVisible, splashExiting]);

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

  // ── Self-service flow ─────────────────────────────────────────────────────
  const handleSelfIdSuccess = useCallback((entry: RosterEntry) => {
    setAdvanceWorker(entry);
    setPhase('self_service');
  }, []);

  const handleSelfClose = useCallback(() => {
    setAdvanceWorker(null);
    setPhase('idle');
  }, []);

  const handleSelfRequestAdvance = useCallback(() => {
    setPhase('advance_form');
  }, []);

  // ── Cash advance flow ─────────────────────────────────────────────────────
  const handleAdvancePinSuccess = useCallback((entry: RosterEntry) => {
    setAdvanceWorker(entry);
    setPhase('advance_form');
  }, []);

  const handleAdvanceSubmit = useCallback(async (amount: number, reason: string) => {
    if (!advanceWorker) return;
    await requestAdvance(advanceWorker.workerId, amount, reason);
    setAdvanceWorker(null);
    setResult({ kind: 'success', workerName: advanceWorker.name, message: 'Advance request submitted — see your supervisor for approval' });
    setPhase('result');
    setTimeout(() => {
      setResult(null);
      setPhase('idle');
    }, RESULT_DISPLAY_MS);
  }, [advanceWorker]);

  const handleAdvanceCancel = useCallback(() => {
    setAdvanceWorker(null);
    setPhase('idle');
  }, []);

  // ── Live clock for idle screen ────────────────────────────────────────────
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const clockTime = useMemo(() =>
    clockNow.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
  [clockNow]);
  const clockDate = useMemo(() =>
    clockNow.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }),
  [clockNow]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-neutral-900 text-white overflow-hidden flex flex-col">
      {splashVisible && <SplashScreen exiting={splashExiting} />}
      <StatusBar
        isOnline={isOnline}
        pendingCount={pendingCount}
        rosterSize={rosterSize}
        lastRefreshedAt={lastRefreshedAt}
      />

      <div className="flex-1 relative mt-9 overflow-hidden">
        {phase === 'init' && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-neutral-400 text-sm">{loadMsg}</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center mb-2">
              <span className="text-red-400 text-3xl font-bold">!</span>
            </div>
            <p className="text-white text-xl font-bold">Kiosk Offline</p>
            <p className="text-neutral-400 text-sm max-w-sm">{initError}</p>
            {retryCountdown > 0 && (
              <p className="text-neutral-600 text-sm">Retrying in {retryCountdown}s</p>
            )}
            <button
              onClick={() => { localStorage.removeItem('kiosk_token'); init(); }}
              className="mt-2 px-8 py-3 bg-white text-neutral-900 rounded-xl text-base font-bold active:opacity-80"
            >
              Retry Now
            </button>
          </div>
        )}

        {/* ── Idle: action selection ─────────────────────────────────────── */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full px-8">
            {/* Live clock */}
            <div className="text-center mb-10">
              <div className="text-6xl font-bold tabular-nums text-white leading-none">
                {clockTime}
              </div>
              <div className="text-neutral-500 text-base mt-2">{clockDate}</div>
            </div>

            <div className="w-full max-w-sm space-y-3">
              <button
                onClick={() => handleSelectAction('in')}
                className="w-full py-7 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white text-2xl font-bold transition-colors"
              >
                Clock In
              </button>

              <button
                onClick={() => handleSelectAction('out')}
                className="w-full py-7 rounded-xl bg-orange-600 active:bg-orange-700 text-white text-2xl font-bold transition-colors"
              >
                Clock Out
              </button>

              <button
                onClick={() => setPhase('pin')}
                className="w-full py-4 rounded-xl bg-neutral-800 text-neutral-300 text-base font-medium border border-neutral-700 active:bg-neutral-700 transition-colors"
              >
                Use Employee ID
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPhase('self_id')}
                  className="py-3 rounded-xl bg-neutral-800 text-neutral-400 text-sm font-medium border border-neutral-700 active:bg-neutral-700 transition-colors"
                >
                  My Status
                </button>
                <button
                  onClick={() => setPhase('advance_id')}
                  className="py-3 rounded-xl bg-neutral-800 text-neutral-400 text-sm font-medium border border-neutral-700 active:bg-neutral-700 transition-colors"
                >
                  Request Advance
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Camera error overlay — only show when camera phases are active */}
        {cameraError && cameraActive && (
          <div className="absolute inset-0 bg-neutral-900 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center mb-2">
              <span className="text-neutral-400 text-2xl">⊘</span>
            </div>
            <p className="text-white text-lg font-bold">Camera Unavailable</p>
            <p className="text-neutral-400 text-sm max-w-xs">{cameraError}</p>
            <div className="flex gap-3 mt-2">
              <button onClick={handleCancelScan} className="px-5 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300">
                ← Go Back
              </button>
              <button onClick={() => window.location.reload()} className="px-5 py-2 bg-white text-neutral-900 rounded-lg text-sm font-medium">
                Reload
              </button>
            </div>
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

        {phase === 'self_id' && (
          <div className="absolute inset-0">
            <PinEntry
              roster={pinRoster}
              onSuccess={handleSelfIdSuccess}
              onCancel={handleSelfClose}
            />
          </div>
        )}

        {phase === 'self_service' && advanceWorker && (
          <div className="absolute inset-0">
            <SelfService
              worker={advanceWorker}
              onClose={handleSelfClose}
              onRequestAdvance={handleSelfRequestAdvance}
            />
          </div>
        )}

        {phase === 'advance_id' && (
          <div className="absolute inset-0">
            <PinEntry
              roster={pinRoster}
              onSuccess={handleAdvancePinSuccess}
              onCancel={handleAdvanceCancel}
            />
          </div>
        )}

        {phase === 'advance_form' && advanceWorker && (
          <div className="absolute inset-0">
            <AdvanceForm
              worker={advanceWorker}
              onSubmit={handleAdvanceSubmit}
              onCancel={handleAdvanceCancel}
            />
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
