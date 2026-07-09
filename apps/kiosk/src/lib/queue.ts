import { getDb } from './db';
import { RATE_LIMIT_MS } from '../constants';
import type { EventType, PendingEvent } from '../types';

function rateLimitKey(workerId: string, eventType: EventType): string {
  return `${workerId}-${eventType}`;
}

export async function isRateLimited(workerId: string, eventType: EventType): Promise<boolean> {
  const db = await getDb();
  const entry = await db.get('rateLimit', rateLimitKey(workerId, eventType));
  if (!entry) return false;
  return Date.now() - entry.lastTs < RATE_LIMIT_MS;
}

// Determines whether the next event for a worker should be IN or OUT
// by checking which direction was most recently recorded.
export async function getExpectedEventType(workerId: string): Promise<EventType> {
  const db = await getDb();
  const lastIn  = await db.get('rateLimit', rateLimitKey(workerId, 'in'));
  const lastOut = await db.get('rateLimit', rateLimitKey(workerId, 'out'));

  if (!lastIn && !lastOut) return 'in';   // first scan → IN
  if (!lastIn)  return 'in';
  if (!lastOut) return 'out';
  // Alternate based on whichever happened later
  return lastIn.lastTs > lastOut.lastTs ? 'out' : 'in';
}

export async function recordEvent(event: Omit<PendingEvent, 'synced'>): Promise<void> {
  const db = await getDb();
  const fullEvent: PendingEvent = { ...event, synced: false };
  await db.put('queue', fullEvent);

  // Update rate-limit store for this direction
  const key = rateLimitKey(event.workerId, event.eventType);
  await db.put('rateLimit', { key, lastTs: Date.now() });
}

export async function getPendingEvents(): Promise<PendingEvent[]> {
  const db = await getDb();
  const all = await db.getAll('queue');
  return all.filter((e) => !e.synced);
}

export async function markSynced(clientEventIds: string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('queue', 'readwrite');
  for (const id of clientEventIds) {
    const entry = await tx.store.get(id);
    if (entry) await tx.store.put({ ...entry, synced: true });
  }
  await tx.done;
}

export async function getPendingCount(): Promise<number> {
  return (await getPendingEvents()).length;
}
