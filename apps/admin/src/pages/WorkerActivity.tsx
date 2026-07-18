import { useState } from 'react';
import { Link } from 'wouter';
import { CheckCircle, XCircle, Users } from 'lucide-react';
import { useWorkerActivity } from '@/lib/queries';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Manila',
  });
}

function WorkerAvatar({ name, photo }: { name: string; photo?: string | null }) {
  if (photo) {
    return <img src={photo} alt={name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />;
  }
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground flex-shrink-0">
      {initials}
    </div>
  );
}

type Filter = 'all' | 'on_site' | 'off_site';

export default function WorkerActivity() {
  const { data: workers = [], isLoading } = useWorkerActivity();
  const [filter, setFilter] = useState<Filter>('all');

  const onSiteCount  = workers.filter(w => w.status === 'on_site').length;
  const offSiteCount = workers.filter(w => w.status === 'off_site').length;
  const visible      = filter === 'all' ? workers : workers.filter(w => w.status === filter);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">Worker Activity</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Live on-site / off-site status — updates every 30 seconds</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
          <Users className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold tabular-nums">{workers.length}</p>
            <p className="text-xs text-muted-foreground">Active workers</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">{onSiteCount}</p>
            <p className="text-xs text-muted-foreground">On site now</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
          <XCircle className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold tabular-nums">{offSiteCount}</p>
            <p className="text-xs text-muted-foreground">Off site</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted w-fit mb-4">
        {(['all', 'on_site', 'off_site'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-white shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'all' ? 'All' : f === 'on_site' ? 'On Site' : 'Off Site'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No workers match this filter.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {visible.map(w => (
            <Link key={w.workerId} href={`/workers/${w.workerId}`}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors cursor-pointer">
                <WorkerAvatar name={w.name} photo={w.photo} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">{w.name}</p>
                  <p className="text-xs text-muted-foreground">{w.employeeNo}</p>
                </div>
                {w.status === 'on_site' ? (
                  <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      On Site
                    </span>
                    {w.siteName && (
                      <span className="text-xs text-muted-foreground">{w.siteName}</span>
                    )}
                    {w.lastEventAt && (
                      <span className="text-xs text-muted-foreground">since {formatTime(w.lastEventAt)}</span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted border border-border rounded-full px-2.5 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                      Off Site
                    </span>
                    {w.lastEventAt && (
                      <span className="text-xs text-muted-foreground">last seen {formatTime(w.lastEventAt)}</span>
                    )}
                    {!w.lastEventAt && (
                      <span className="text-xs text-muted-foreground">no check-in today</span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
