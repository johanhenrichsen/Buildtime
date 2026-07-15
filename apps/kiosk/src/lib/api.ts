import { API_URL, DEVICE_KEY } from '../constants';
import type { PendingEvent, RosterEntry } from '../types';

export interface KioskToken {
  sub: string;
  siteId: string;
  type: 'kiosk';
  exp: number;
}

let _token: string | null = localStorage.getItem('kiosk_token');
let _tokenPayload: KioskToken | null = parseToken(_token);

function parseToken(token: string | null): KioskToken | null {
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1])) as KioskToken;
  } catch {
    return null;
  }
}

function isExpired(payload: KioskToken | null): boolean {
  if (!payload) return true;
  return Date.now() / 1000 >= payload.exp - 60;
}

// Fetch with a hard timeout — prevents infinite hangs on slow/no signal
async function fetchWithTimeout(input: string, init?: RequestInit, timeoutMs = 15_000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    if ((e as DOMException).name === 'AbortError') {
      throw new Error(`Request timed out — check your network connection`);
    }
    throw e;
  }
}

async function getToken(): Promise<string> {
  if (_token && !isExpired(_tokenPayload)) return _token;

  const res = await fetchWithTimeout(
    `${API_URL}/api/v1/auth/kiosk-token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceKey: DEVICE_KEY }),
    },
    8_000,
  );
  if (!res.ok) throw new Error(`Device authentication failed (${res.status}) — contact your supervisor`);

  const { access_token } = (await res.json()) as { access_token: string };
  _token = access_token;
  _tokenPayload = parseToken(_token);
  localStorage.setItem('kiosk_token', _token);
  return _token;
}

export function getKioskId(): string {
  return _tokenPayload?.sub ?? '';
}

async function authedFetch(path: string, init?: RequestInit, timeoutMs?: number): Promise<Response> {
  const token = await getToken();
  return fetchWithTimeout(
    `${API_URL}${path}`,
    {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
    },
    timeoutMs,
  );
}

export async function fetchRoster(): Promise<RosterEntry[]> {
  await getToken();
  const kioskId = _tokenPayload!.sub;
  const res = await authedFetch(`/api/v1/kiosks/${kioskId}/roster`, undefined, 15_000);
  if (!res.ok) {
    if (res.status === 401 || res.status === 404) {
      // Stale cached token — the stored kiosk ID no longer matches the server.
      // Clear it so the next retry forces a fresh device-key auth.
      _token = null;
      _tokenPayload = null;
      localStorage.removeItem('kiosk_token');
    }
    throw new Error(`Could not load worker list (${res.status})`);
  }
  return res.json() as Promise<RosterEntry[]>;
}

export async function syncEvents(events: PendingEvent[]): Promise<void> {
  if (events.length === 0) return;
  // Strip `synced` — it's internal IDB state; API rejects unknown fields (forbidNonWhitelisted)
  const payload = events.map(({ synced: _omit, ...rest }) => rest);
  const res = await authedFetch(
    '/api/v1/attendance/sync',
    { method: 'POST', body: JSON.stringify({ events: payload }) },
    10_000,
  );
  if (!res.ok) throw new Error(`Sync failed (${res.status})`);
}
