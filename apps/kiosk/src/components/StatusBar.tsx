import { useEffect, useState } from 'react';
import { ROSTER_REFRESH_MS } from '../constants';

interface Props {
  isOnline: boolean;
  pendingCount: number;
  rosterSize: number;
  lastRefreshedAt: number | null;
}

function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function rosterAgeLabel(lastRefreshedAt: number | null, now: number): string {
  if (!lastRefreshedAt) return '';
  const ageMs      = now - lastRefreshedAt;
  const nextMs     = ROSTER_REFRESH_MS - ageMs;
  const ageMins    = Math.floor(ageMs / 60_000);
  const nextMins   = Math.max(0, Math.ceil(nextMs / 60_000));

  if (ageMins < 1)     return 'Roster: just refreshed';
  if (nextMins <= 1)   return 'Roster: refreshing soon';
  return `Roster: ${ageMins}m old · next in ${nextMins}m`;
}

export function StatusBar({ isOnline, pendingCount, rosterSize, lastRefreshedAt }: Props) {
  const now = useNow();

  return (
    <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-black/50 text-xs text-white z-10">
      <span className="font-semibold tracking-wide">BuildTime</span>

      <div className="flex items-center gap-3">
        {lastRefreshedAt && (
          <span className="text-slate-400 hidden sm:inline" title={`${rosterSize} workers`}>
            {rosterAgeLabel(lastRefreshedAt, now)}
          </span>
        )}
        <span className="text-slate-300" title={`${rosterSize} enrolled workers cached`}>
          👥 {rosterSize}
        </span>
        {pendingCount > 0 ? (
          <span
            className={`font-semibold px-2 py-0.5 rounded-full ${
              pendingCount > 5 ? 'bg-orange-500 text-white' : 'text-yellow-400'
            }`}
            title="Attendance events queued — will sync when online"
          >
            {pendingCount} unsynced
          </span>
        ) : (
          isOnline && <span className="text-green-400/60 text-xs">✓ all synced</span>
        )}
        <span className={isOnline ? 'text-green-400' : 'text-red-400'}>
          {isOnline ? '● Online' : '● Offline — scans save locally'}
        </span>
      </div>
    </div>
  );
}
