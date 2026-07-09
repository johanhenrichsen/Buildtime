import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { PendingEvent, RosterEntry } from '../types';

interface BuildtimeDB extends DBSchema {
  roster: {
    key: string;  // workerId
    value: RosterEntry & { updatedAt: number };
    indexes: { 'by-updated': number };
  };
  queue: {
    key: string;  // clientEventId
    value: PendingEvent;
    indexes: { 'by-synced': number };  // 0=pending, 1=synced (IDB doesn't index booleans)
  };
  // Tracks last event time per worker per direction for rate-limiting + IN/OUT alternation
  rateLimit: {
    key: string;  // `${workerId}-${eventType}`
    value: { key: string; lastTs: number };
  };
}

let _db: IDBPDatabase<BuildtimeDB> | null = null;

export async function getDb(): Promise<IDBPDatabase<BuildtimeDB>> {
  if (_db) return _db;
  _db = await openDB<BuildtimeDB>('buildtime-kiosk', 1, {
    upgrade(db) {
      const roster = db.createObjectStore('roster', { keyPath: 'workerId' });
      roster.createIndex('by-updated', 'updatedAt');

      const queue = db.createObjectStore('queue', { keyPath: 'clientEventId' });
      queue.createIndex('by-synced', 'synced');

      db.createObjectStore('rateLimit', { keyPath: 'key' });
    },
  });
  return _db;
}
