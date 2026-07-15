import { getDb } from './db';
import { fetchRoster } from './api';
import { ROSTER_REFRESH_MS } from '../constants';
import type { RosterEntry } from '../types';

let _lastRefreshedAt: number | null = null;
let _memCache: RosterEntry[] | null = null;

export function getLastRefreshedAt(): number | null {
  return _lastRefreshedAt;
}

// Always check memory first — avoids IDB round-trip on every face match
export async function getRoster(): Promise<RosterEntry[]> {
  if (_memCache) return _memCache;
  const db = await getDb();
  const all = await db.getAll('roster');
  _memCache = all;
  return all;
}

export async function refreshRoster(): Promise<RosterEntry[]> {
  const entries = await fetchRoster();
  const db = await getDb();
  const tx = db.transaction('roster', 'readwrite');
  await tx.store.clear();
  const now = Date.now();
  for (const entry of entries) {
    await tx.store.put({ ...entry, updatedAt: now });
  }
  await tx.done;
  _lastRefreshedAt = now;
  _memCache = entries;
  return entries;
}

// Try network first, fall back to IDB cache if offline — kiosk stays usable without network
export async function initRoster(): Promise<RosterEntry[]> {
  try {
    return await refreshRoster();
  } catch {
    const db = await getDb();
    const cached = await db.getAll('roster');
    if (cached.length > 0) {
      _memCache = cached;
      // Note: _lastRefreshedAt stays null so StatusBar won't show a stale age
      return cached;
    }
    throw new Error('No worker roster available and no cached data. Connect to the network and retry.');
  }
}

export async function isRosterStale(): Promise<boolean> {
  const db = await getDb();
  const all = await db.getAll('roster');
  if (all.length === 0) return true;
  const oldestUpdate = Math.min(...all.map((e) => e.updatedAt));
  return Date.now() - oldestUpdate > ROSTER_REFRESH_MS;
}
