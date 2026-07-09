import { API_URL, DEVICE_KEY } from '../constants';
import type { PendingEvent, RosterEntry } from '../types';

// Decoded kiosk JWT payload (no signature verification needed client-side)
export interface KioskToken {
  sub: string;     // kioskId
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
  return Date.now() / 1000 >= payload.exp - 60;  // refresh 1 min before expiry
}

async function getToken(): Promise<string> {
  if (_token && !isExpired(_tokenPayload)) return _token;

  const res = await fetch(`${API_URL}/api/v1/auth/kiosk-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceKey: DEVICE_KEY }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);

  const { access_token } = (await res.json()) as { access_token: string };
  _token = access_token;
  _tokenPayload = parseToken(_token);
  localStorage.setItem('kiosk_token', _token);
  return _token;
}

export function getKioskId(): string {
  return _tokenPayload?.sub ?? '';
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
}

export async function fetchRoster(kioskId: string): Promise<RosterEntry[]> {
  const res = await authedFetch(`/api/v1/kiosks/${kioskId}/roster`);
  if (!res.ok) throw new Error(`Roster fetch failed: ${res.status}`);
  return res.json() as Promise<RosterEntry[]>;
}

export async function syncEvents(events: PendingEvent[]): Promise<void> {
  if (events.length === 0) return;
  const res = await authedFetch('/api/v1/attendance/sync', {
    method: 'POST',
    body: JSON.stringify({ events }),
  });
  if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
}
