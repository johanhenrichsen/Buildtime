export type EventType = 'in' | 'out';
export type MatchMethod = 'face' | 'face_low_confidence' | 'manual_exception';

export type KioskPhase =
  | 'init'       // loading models + roster
  | 'idle'       // ready, no face in frame
  | 'liveness'   // face detected, collecting frames
  | 'matching'   // liveness passed, running matcher
  | 'choose'     // matched — worker picks clock in or out
  | 'result'     // showing outcome
  | 'pin'        // manual PIN fallback entry
  | 'error';     // unrecoverable setup error

export interface MatchedWorker {
  workerId: string;
  name: string;
  confidence: number;
  matchMethod: MatchMethod;
  flagged: boolean;
  defaultEventType: EventType;
}

export type ResultKind = 'success' | 'flagged' | 'no_match' | 'rate_limited';

export interface CheckinResult {
  kind: ResultKind;
  workerName?: string;
  eventType?: EventType;
  confidence?: number;       // 0–1 (derived from L2 distance)
  message: string;
}

export interface RosterEntry {
  workerId: string;
  name: string;
  employeeNo: string;
  embedding: number[];       // 128-dim float array
}

export interface PendingEvent {
  clientEventId: string;     // UUID generated on device
  workerId: string;
  eventType: EventType;
  clientTs: string;          // ISO-8601 — stored for audit, never used for payroll
  confidenceScore: number;
  matchMethod: MatchMethod;
  flaggedForReview: boolean;
  synced: boolean;
}

export interface LivenessFrame {
  noseTipX: number;
  noseTipY: number;
  ear: number;               // eye aspect ratio
}
