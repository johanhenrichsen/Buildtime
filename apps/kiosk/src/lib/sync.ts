import { getPendingEvents, markSynced } from './queue';
import { syncEvents } from './api';
import { isRosterStale, refreshRoster } from './roster';
import { SYNC_INTERVAL_MS } from '../constants';

let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startSyncLoop(onCountChange: (n: number) => void): void {
  if (syncTimer) return;
  syncTimer = setInterval(() => runSync(onCountChange), SYNC_INTERVAL_MS);
}

export function stopSyncLoop(): void {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = null;
}

export async function runSync(onCountChange?: (n: number) => void): Promise<void> {
  if (!navigator.onLine) return;

  try {
    const pending = await getPendingEvents();
    if (pending.length > 0) {
      await syncEvents(pending);
      await markSynced(pending.map((e) => e.clientEventId));
      onCountChange?.(0);
    }

    if (await isRosterStale()) {
      await refreshRoster();
    }
  } catch {
    // Sync failures are non-fatal — events stay in queue and retry next cycle
  }
}
