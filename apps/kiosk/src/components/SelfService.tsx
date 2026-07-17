import { useEffect, useState } from 'react';
import { getWorkerStatus } from '../lib/api';
import type { WorkerStatus } from '../lib/api';
import type { RosterEntry } from '../types';

interface Props {
  worker: Pick<RosterEntry, 'workerId' | 'name' | 'employeeNo'>;
  onClose: () => void;
  onRequestAdvance: () => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila',
  });
}

const TIMEOUT_SEC = 30;

export function SelfService({ worker, onClose, onRequestAdvance }: Props) {
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(TIMEOUT_SEC);

  const initials = worker.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  useEffect(() => {
    getWorkerStatus(worker.workerId)
      .then(setStatus)
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load status'))
      .finally(() => setLoading(false));
  }, [worker.workerId]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) { clearInterval(tick); onClose(); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [onClose]);

  const statusColor =
    status?.todayStatus === 'in'  ? 'text-emerald-400 bg-emerald-400/10' :
    status?.todayStatus === 'out' ? 'text-orange-400 bg-orange-400/10'   :
    'text-neutral-400 bg-neutral-800';

  const statusLabel =
    status?.todayStatus === 'in'  ? 'Currently clocked in' :
    status?.todayStatus === 'out' ? 'Clocked out' :
    'No record today';

  return (
    <div className="flex flex-col items-center justify-start w-full h-full bg-neutral-900 text-white px-6 pt-10 overflow-y-auto">
      <div className="w-full max-w-sm">
        {/* Worker header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-neutral-700 border border-neutral-600 flex items-center justify-center text-base font-bold flex-shrink-0">
            {initials}
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">{worker.name}</div>
            <div className="text-xs text-neutral-500">{worker.employeeNo}</div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-neutral-700 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm bg-red-900/30 border border-red-700/40 px-3 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {status && !loading && (
          <>
            {/* Today's status badge */}
            <div className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold mb-5 ${statusColor}`}>
              {statusLabel}
              {status.lastEventAt && (
                <span className="ml-2 font-normal opacity-70">· {formatTime(status.lastEventAt)}</span>
              )}
            </div>

            {/* Today's events timeline */}
            {status.todayEvents.length > 0 && (
              <div className="mb-5">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Today's events</p>
                <div className="space-y-1">
                  {status.todayEvents.map((ev, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 bg-neutral-800 rounded-lg">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        ev.type === 'in' ? 'bg-emerald-400' : 'bg-orange-400'
                      }`} />
                      <span className="text-sm font-medium capitalize">{ev.type === 'in' ? 'Clock in' : 'Clock out'}</span>
                      <span className="text-sm text-neutral-400 ml-auto">{formatTime(ev.time)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending advances */}
            {status.pendingAdvances.length > 0 && (
              <div className="mb-5">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Pending advance requests</p>
                <div className="space-y-1">
                  {status.pendingAdvances.map(a => (
                    <div key={a.id} className="px-3 py-3 bg-neutral-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">PHP {Number(a.amount).toLocaleString()}</span>
                        <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Pending</span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1 truncate">{a.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Request advance shortcut */}
            <button
              onClick={onRequestAdvance}
              className="w-full py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm font-medium active:bg-neutral-700 transition-colors mb-3"
            >
              Request Cash Advance
            </button>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 text-neutral-500 text-sm hover:text-neutral-300 transition-colors"
        >
          Close ({countdown}s)
        </button>
      </div>
    </div>
  );
}
