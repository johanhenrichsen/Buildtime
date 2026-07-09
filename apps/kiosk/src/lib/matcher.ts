import type { RosterEntry } from '../types';

// face-api.js FaceRecognitionNet descriptors use L2 Euclidean distance
// (same as the library's built-in FaceMatcher). Lower = better match.
export function l2Distance(a: Float32Array, b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export interface MatchResult {
  workerId: string;
  name: string;
  distance: number;
  confidence: number;  // 0–1: max(0, 1 - distance / 1.5)
}

export function findBestMatch(
  descriptor: Float32Array,
  roster: RosterEntry[],
): MatchResult | null {
  if (roster.length === 0) return null;

  let best: MatchResult | null = null;

  for (const entry of roster) {
    const distance = l2Distance(descriptor, entry.embedding);
    const confidence = Math.max(0, 1 - distance / 1.5);

    if (!best || distance < best.distance) {
      best = { workerId: entry.workerId, name: entry.name, distance, confidence };
    }
  }

  return best;
}
