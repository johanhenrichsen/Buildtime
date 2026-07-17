import { useEffect, useState } from 'react';

interface Props {
  isOnline: boolean;
  pendingCount: number;
  rosterSize: number;
  lastRefreshedAt: number | null;
}

export function StatusBar({ isOnline, pendingCount }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  void now;

  return (
    <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 h-9 bg-neutral-950 border-b border-neutral-800 text-xs text-neutral-500 z-10">
      <span className="font-semibold text-neutral-300 tracking-wide">BuildTime</span>
      <div className="flex items-center gap-4">
        {pendingCount > 0 && (
          <span className="text-amber-400 font-medium">{pendingCount} pending sync</span>
        )}
        <span className={isOnline ? 'text-emerald-500' : 'text-red-400'}>
          {isOnline ? 'Online' : 'Offline — saves locally'}
        </span>
      </div>
    </div>
  );
}
