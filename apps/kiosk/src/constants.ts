// Match thresholds — face-api.js FaceRecognitionNet uses L2 Euclidean distance.
// Lower distance = better match (opposite of cosine similarity).
// Real-world job-site conditions (outdoor light, helmets, budget cameras) push distances
// higher than lab benchmarks. Raised from 0.50/0.65 to accommodate this.
//
// Three-tier decision:
//   distance ≤ MATCH_DIST_HIGH  → high-confidence auto-approve
//   MATCH_DIST_HIGH < d ≤ MATCH_DIST_REJECT → flag for HR review (probably the person)
//   MATCH_DIST_REJECT < d ≤ MATCH_DIST_LOW  → auto-reject, no event recorded (probably not them)
//   distance > MATCH_DIST_LOW   → no match at all
export const MATCH_DIST_HIGH   = 0.60;  // ≈60% confidence cutoff
export const MATCH_DIST_REJECT = 0.68;  // ≈55% confidence — below this, reject instead of flag
export const MATCH_DIST_LOW    = 0.75;  // ≈50% confidence — below this, no match

export const RATE_LIMIT_MS     = 3 * 60 * 1000;  // 3 min between events per worker per direction
export const RESULT_DISPLAY_MS = 2_500;           // ms to show result before resetting to idle

// Liveness: require LIVENESS_FRAMES frames with nose-tip position std-dev > LIVENESS_VARIANCE_PX
// 8 frames × 120ms ≈ 1s minimum liveness window (was 12 × 150ms ≈ 1.8s)
export const LIVENESS_FRAMES       = 8;
export const LIVENESS_VARIANCE_PX  = 2.5;  // px — below this = likely static image
export const EAR_BLINK_THRESHOLD   = 0.22; // eye aspect ratio below this = blink
// PRODUCT DECISION: uncomment blink requirement in useLiveness.ts for stronger anti-spoofing.
// It stops photo bypass but may reject real users who don't blink in the 1s window.

// Face detection runs every this many ms (throttles CPU on budget tablets)
export const DETECTION_INTERVAL_MS = 120;

// Roster cache refresh interval
export const ROSTER_REFRESH_MS = 30 * 60 * 1000;  // 30 min

// Sync pending queue to server every N ms when online
export const SYNC_INTERVAL_MS = 30 * 1_000;  // 30 sec

export const EMBEDDING_DIM = 128;  // face-api.js FaceRecognitionNet (FaceNet)

export const API_URL      = import.meta.env.VITE_API_URL as string ?? 'http://localhost:3000';
export const DEVICE_KEY   = import.meta.env.VITE_KIOSK_DEVICE_KEY as string;
