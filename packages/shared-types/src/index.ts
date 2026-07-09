// ── Enums ────────────────────────────────────────────────────────────────────

export type EmploymentType = 'regular' | 'project-based' | 'casual';
export type WorkerStatus   = 'active' | 'inactive' | 'terminated';
export type SiteStatus     = 'active' | 'inactive';
export type KioskStatus    = 'active' | 'inactive' | 'maintenance';
export type EventType      = 'in' | 'out';
export type MatchMethod    = 'face' | 'face_low_confidence' | 'manual_exception';
export type DtrStatus      = 'draft' | 'approved' | 'disputed';
export type CutoffStatus   = 'open' | 'processing' | 'closed';
export type PayrollStatus  = 'draft' | 'processing' | 'approved' | 'exported';
export type TokenType      = 'worker' | 'kiosk';

// ── Permission names (must match seed data) ──────────────────────────────────

export type Permission =
  | 'checkin_kiosk'
  | 'view_own_dtr'
  | 'approve_ot_leave_crew'
  | 'approve_ot_leave_all'
  | 'edit_attendance'
  | 'manage_workers_site'
  | 'manage_workers_all'
  | 'run_payroll'
  | 'view_labor_cost_site'
  | 'view_labor_cost_all'
  | 'system_config';

// ── JWT payload ───────────────────────────────────────────────────────────────

export interface WorkerJwtPayload {
  sub: string;           // worker.id
  type: 'worker';
  name: string;
  permissions: Permission[];
}

export interface KioskJwtPayload {
  sub: string;           // kiosk.id
  type: 'kiosk';
  siteId: string;
  permissions: ['checkin_kiosk'];
}

export type JwtPayload = WorkerJwtPayload | KioskJwtPayload;

// ── API response shapes ───────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
