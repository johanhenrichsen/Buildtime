import { Link } from 'wouter';
import { useDashboardStats, useOnSite } from '@/lib/queries';
import { Users, LogIn, Flag, Wallet } from 'lucide-react';

function Stat({ label, value, icon, to }: { label: string; value: number | undefined; icon: React.ReactNode; to?: string }) {
  const inner = (
    <div className="bg-card border border-border rounded-lg p-5 flex items-center gap-4 hover:bg-accent/40 transition-colors">
      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value ?? '—'}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  );
  return to ? <Link href={to}>{inner}</Link> : <div>{inner}</div>;
}

function WorkerAvatar({ name, photo }: { name: string; photo?: string | null }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground flex-shrink-0">
      {initials}
    </div>
  );
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: onSite = [], isLoading: onSiteLoading } = useOnSite();

  // Group on-site workers by site
  const bySite = onSite.reduce<Record<string, typeof onSite>>((acc, w) => {
    (acc[w.siteName] ??= []).push(w);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Live workforce status</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="On site now"
          value={statsLoading ? undefined : stats?.onSiteCount}
          icon={<Users className="w-5 h-5" />}
        />
        <Stat
          label="Clock-ins today"
          value={statsLoading ? undefined : stats?.todayClockIns}
          icon={<LogIn className="w-5 h-5" />}
          to="/reports"
        />
        <Stat
          label="Flagged events"
          value={statsLoading ? undefined : stats?.pendingFlagged}
          icon={<Flag className="w-5 h-5" />}
          to="/flagged"
        />
        <Stat
          label="Pending advances"
          value={statsLoading ? undefined : stats?.pendingAdvances}
          icon={<Wallet className="w-5 h-5" />}
          to="/advances"
        />
      </div>

      {/* On-site list */}
      <div>
        <h2 className="text-base font-semibold mb-3">Who's on site now</h2>

        {onSiteLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {!onSiteLoading && onSite.length === 0 && (
          <p className="text-sm text-muted-foreground">Nobody clocked in yet today.</p>
        )}

        {!onSiteLoading && onSite.length > 0 && (
          <div className="space-y-5">
            {Object.entries(bySite).sort(([a], [b]) => a.localeCompare(b)).map(([siteName, workers]) => (
              <div key={siteName}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{siteName}</p>
                <div className="border border-border rounded-lg divide-y divide-border">
                  {workers.map(w => (
                    <Link key={w.workerId} href={`/workers/${w.workerId}`}>
                      <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors cursor-pointer">
                        <WorkerAvatar name={w.name} photo={w.photo} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">{w.name}</p>
                          <p className="text-xs text-muted-foreground">{w.employeeNo}</p>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{formatTime(w.clockedInAt)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
