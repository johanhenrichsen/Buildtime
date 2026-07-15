import { getToken, clearToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL ?? '';

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
  }

  return res;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<{ access_token: string }> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return json(res);
}

// ── Sites ─────────────────────────────────────────────────────────────────────

export interface Site {
  id: string;
  name: string;
  status: string;
  address?: string;
  createdAt?: string;
}

export async function getSites(): Promise<PaginatedResponse<Site>> {
  const res = await apiFetch('/api/v1/sites');
  return json(res);
}

// ── Workers ──────────────────────────────────────────────────────────────────

export interface Worker {
  id: string;
  employeeNo: string;
  name: string;
  email?: string;
  roleId: string;
  employmentType: string;
  dailyRate: string;
  hireDate: string;
  status: string;
  role?: { id: string; name: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

export async function getWorkers(params?: { status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Worker>> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.page)   qs.set('page',   String(params.page));
  if (params?.limit)  qs.set('limit',  String(params.limit));
  const res = await apiFetch(`/api/v1/workers?${qs}`);
  return json(res);
}

export async function createWorker(data: Partial<Worker> & { password?: string }): Promise<Worker> {
  const res = await apiFetch('/api/v1/workers', { method: 'POST', body: JSON.stringify(data) });
  return json(res);
}

export async function updateWorker(id: string, data: Partial<Worker>): Promise<Worker> {
  const res = await apiFetch(`/api/v1/workers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  return json(res);
}

// ── Roles ─────────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
}

export async function getRoles(): Promise<Role[]> {
  const res = await apiFetch('/api/v1/roles');
  return json(res);
}

// ── Enrollment ───────────────────────────────────────────────────────────────

export interface EnrollmentStatus {
  workerId: string;
  enrolled: boolean;
  embedding: {
    id: string;
    qualityScore: number;
    enrolledAt: string;
    active: boolean;
    enrolledByWorker: { id: string; name: string } | null;
  } | null;
}

export async function getEnrollmentStatus(workerId: string): Promise<EnrollmentStatus> {
  const res = await apiFetch(`/api/v1/enrollment/${workerId}`);
  return json(res);
}

export async function enrollWorker(workerId: string, descriptor: number[], qualityScore: number): Promise<unknown> {
  const res = await apiFetch(`/api/v1/enrollment/${workerId}`, {
    method: 'POST',
    body: JSON.stringify({ embeddingVector: descriptor, qualityScore }),
  });
  return json(res);
}

export async function revokeEnrollment(workerId: string): Promise<void> {
  await apiFetch(`/api/v1/enrollment/${workerId}`, { method: 'DELETE' });
}

// ── Cutoffs ──────────────────────────────────────────────────────────────────

export interface Cutoff {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  createdAt: string;
}

export async function getCutoffs(): Promise<PaginatedResponse<Cutoff>> {
  const res = await apiFetch('/api/v1/cutoffs');
  return json(res);
}

export async function createCutoff(data: { periodStart: string; periodEnd: string }): Promise<Cutoff> {
  const res = await apiFetch('/api/v1/cutoffs', { method: 'POST', body: JSON.stringify(data) });
  return json(res);
}

// ── DTR ──────────────────────────────────────────────────────────────────────

export interface DtrRecord {
  id: string;
  date: string;
  regularHrs: string;
  otHrs: string;
  nightDiffHrs: string;
  lateMin: number;
  undertimeMin: number;
  status: string;
  worker: { id: string; name: string; employeeNo: string };
}

export async function getDtr(cutoffId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<DtrRecord>> {
  const qs = new URLSearchParams({ cutoffId });
  if (params?.page)  qs.set('page',  String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const res = await apiFetch(`/api/v1/dtr?${qs}`);
  return json(res);
}

export async function updateDtr(id: string, data: {
  regularHrs?: number;
  otHrs?: number;
  nightDiffHrs?: number;
  lateMin?: number;
  undertimeMin?: number;
  reason: string;
}): Promise<DtrRecord> {
  const res = await apiFetch(`/api/v1/dtr/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  return json(res);
}

export async function exportDtr(cutoffId: string): Promise<unknown[]> {
  const res = await apiFetch(`/api/v1/dtr/export?cutoffId=${cutoffId}`);
  return json(res);
}

export async function computeDtr(cutoffId: string): Promise<unknown> {
  const res = await apiFetch(`/api/v1/rules/compute-dtr/${cutoffId}`, { method: 'POST' });
  return json(res);
}

// ── Attendance flagged ────────────────────────────────────────────────────────

export interface FlaggedEvent {
  id: string;
  eventType: string;
  serverTs: string;
  confidenceScore: number;
  matchMethod: string;
  worker: { id: string; name: string; employeeNo: string };
}

export async function getFlagged(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<FlaggedEvent>> {
  const qs = new URLSearchParams();
  if (params?.page)  qs.set('page',  String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const res = await apiFetch(`/api/v1/attendance/flagged?${qs}`);
  return json(res);
}

export async function reviewFlagged(id: string, decision: 'approve' | 'reject', reason: string): Promise<unknown> {
  const res = await apiFetch(`/api/v1/attendance/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, reason }),
  });
  return json(res);
}

// ── Cash advances ─────────────────────────────────────────────────────────────

export interface CashAdvance {
  id: string;
  workerId: string;
  amount: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'deducted';
  requestedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  cutoffId: string | null;
  worker: { id: string; name: string; employeeNo: string };
  reviewer: { id: string; name: string } | null;
}

export async function getCashAdvances(params?: {
  workerId?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<CashAdvance>> {
  const qs = new URLSearchParams();
  if (params?.workerId) qs.set('workerId', params.workerId);
  if (params?.status)   qs.set('status',   params.status);
  if (params?.page)     qs.set('page',     String(params.page));
  if (params?.limit)    qs.set('limit',    String(params.limit));
  const res = await apiFetch(`/api/v1/cash-advances?${qs}`);
  return json(res);
}

export async function createCashAdvance(data: {
  workerId: string;
  amount: number;
  reason: string;
}): Promise<CashAdvance> {
  const res = await apiFetch('/api/v1/cash-advances', { method: 'POST', body: JSON.stringify(data) });
  return json(res);
}

export async function reviewCashAdvance(
  id: string,
  decision: 'approved' | 'rejected',
  note?: string,
): Promise<CashAdvance> {
  const res = await apiFetch(`/api/v1/cash-advances/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, note }),
  });
  return json(res);
}

export async function markCashAdvanceDeducted(id: string, cutoffId: string): Promise<CashAdvance> {
  const res = await apiFetch(`/api/v1/cash-advances/${id}/deduct`, {
    method: 'PATCH',
    body: JSON.stringify({ cutoffId }),
  });
  return json(res);
}

// ── Attendance event log ──────────────────────────────────────────────────────

export interface AttendanceEventRow {
  id: string;
  eventType: string;
  serverTs: string;
  matchMethod: string;
  flaggedForReview: boolean;
  worker: { name: string; employeeNo: string };
  site: { name: string };
}

export async function getAttendanceEvents(params: {
  from: string;
  to: string;
  workerId?: string;
}): Promise<AttendanceEventRow[]> {
  const qs = new URLSearchParams({ from: params.from, to: params.to });
  if (params.workerId) qs.set('workerId', params.workerId);
  const res = await apiFetch(`/api/v1/attendance/events?${qs}`);
  return json(res);
}

// ── Manual attendance ─────────────────────────────────────────────────────────

export async function manualAttendance(data: {
  workerId: string;
  eventType: 'in' | 'out';
  siteId: string;
}): Promise<{ id: string; eventType: string; serverTs: string }> {
  const res = await apiFetch('/api/v1/attendance/manual', { method: 'POST', body: JSON.stringify(data) });
  return json(res);
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ts: string;
  actor: { id: string; name: string; employeeNo: string };
}

export async function getAuditLog(params?: {
  entity?: string;
  entityId?: string;
  actorId?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<AuditEntry>> {
  const qs = new URLSearchParams();
  if (params?.entity)   qs.set('entity',   params.entity);
  if (params?.entityId) qs.set('entityId', params.entityId);
  if (params?.actorId)  qs.set('actorId',  params.actorId);
  if (params?.page)     qs.set('page',     String(params.page));
  if (params?.limit)    qs.set('limit',    String(params.limit));
  const res = await apiFetch(`/api/v1/audit-log?${qs}`);
  return json(res);
}
