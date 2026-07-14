let ctx: AudioContext | null = null;

function getCtx() {
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
  return ctx;
}

function tone(freq: number, type: OscillatorType, startAt: number, duration: number, volume = 0.25) {
  const ac = getCtx();
  const osc  = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ac.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + startAt + duration);
  osc.start(ac.currentTime + startAt);
  osc.stop(ac.currentTime + startAt + duration + 0.01);
}

export function playSuccess() {
  // Ascending C-E-G chime
  tone(523, 'sine', 0,    0.25);
  tone(659, 'sine', 0.15, 0.25);
  tone(784, 'sine', 0.30, 0.40);
}

export function playFlagged() {
  // Single mid note — "recorded but review needed"
  tone(440, 'sine', 0, 0.35);
}

export function playFail() {
  // Descending buzz
  tone(300, 'sawtooth', 0,    0.20, 0.15);
  tone(220, 'sawtooth', 0.20, 0.25, 0.15);
}

export function playRateLimited() {
  tone(350, 'triangle', 0, 0.30, 0.12);
}
