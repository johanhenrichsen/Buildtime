let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  type: OscillatorType,
  startAt: number,
  duration: number,
  volume = 0.28,
  pitchEnd?: number,
) {
  const ac   = getCtx();
  const osc  = ac.createOscillator();
  const gain = ac.createGain();

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + startAt);
  if (pitchEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(pitchEnd, ac.currentTime + startAt + duration);
  }

  // Attack: fast ramp up then decay
  gain.gain.setValueAtTime(0, ac.currentTime + startAt);
  gain.gain.linearRampToValueAtTime(volume, ac.currentTime + startAt + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + startAt + duration);

  osc.start(ac.currentTime + startAt);
  osc.stop(ac.currentTime + startAt + duration + 0.02);
}

// Clock In — ascending two-note chime: clean "ding-ding ↑"
export function playClockIn() {
  tone(698, 'sine', 0,    0.18, 0.30); // F5
  tone(880, 'sine', 0.13, 0.32, 0.30); // A5
}

// Clock Out — descending mirror: "ding-ding ↓"
export function playClockOut() {
  tone(880, 'sine', 0,    0.18, 0.28); // A5
  tone(698, 'sine', 0.13, 0.32, 0.26); // F5
}

// Flagged — single neutral chime (recorded but needs review)
export function playFlagged() {
  tone(587, 'sine', 0, 0.40, 0.22); // D5
}

// No match / error — descending buzz
export function playFail() {
  tone(380, 'sawtooth', 0,    0.14, 0.16);
  tone(240, 'sawtooth', 0.14, 0.22, 0.14);
}

// Rate limited — short neutral tap
export function playRateLimited() {
  tone(400, 'triangle', 0, 0.20, 0.12);
}

// Keep legacy name for any other callers
export const playSuccess = playClockIn;
