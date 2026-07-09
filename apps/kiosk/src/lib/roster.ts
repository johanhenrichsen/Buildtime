import { getDb } from './db';
import { fetchRoster, getKioskId } from './api';
import { ROSTER_REFRESH_MS } from '../constants';
import type { RosterEntry } from '../types';

export async function getRoster(): Promise<RosterEntry[]> {
  const db = await getDb();
  const all = await db.getAll('roster');
  return all;
}

export async function refreshRoster(): Promise<RosterEntry[]> {
  const kioskId = getKioskId();
  if (!kioskId) throw new Error('Kiosk not authenticated');

  const entries = await fetchRoster(kioskId);
  const db = await getDb();
  const tx = db.transaction('roster', 'readwrite');
  await tx.store.clear();
  const now = Date.now();
  for (const entry of entries) {
    await tx.store.put({ ...entry, updatedAt: now });
  }
  await tx.done;
  return entries;
}

// Returns true when the cached roster is stale and should be refreshed
export async function isRosterStale(): Promise<boolean> {
  const db = await getDb();
  const all = await db.getAll('roster');
  if (all.length === 0) return true;
  const oldestUpdate = Math.min(...all.map((e) => e.updatedAt));
  return Date.now() - oldestUpdate > ROSTER_REFRESH_MS;
}
