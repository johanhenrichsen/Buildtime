// Match thresholds — face-api.js FaceRecognitionNet uses L2 Euclidean distance.
// Lower distance = better match (opposite of cosine similarity).
export const MATCH_DIST_HIGH   = 0.50;  // below this → high-confidence auto-approve
export const MATCH_DIST_LOW    = 0.65;  // below this → low-confidence, flagged_for_review
// Above MATCH_DIST_LOW → no match

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
