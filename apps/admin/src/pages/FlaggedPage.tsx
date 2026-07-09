import { useEffect, useState } from 'react';
import { getFlagged, reviewFlagged, FlaggedEvent } from '../lib/api';

export default function FlaggedPage() {
  const [events,    setEvents]    = useState<FlaggedEvent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getFlagged({ limit: 100 });
      setEvents(res.data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleReview(id: string, decision: 'approve' | 'reject') {
    const reason = window.prompt(`Reason for ${decision}ing this event:`);
    if (!reason?.trim()) return;
    setActioning(id);
    try {
      await reviewFlagged(id, decision, reason.trim());
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setActioning(null);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Flagged Events</h2>

      {error   && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && <p className="text-slate-500 text-sm">Loading…</p>}

      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left">
                {['Worker', 'Type', 'Server Time', 'Confidence', 'Method', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-2 font-medium text-slate-600 border-b">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-4 text-slate-400 text-center">No flagged events</td></tr>
              ) : events.map(ev => (
                <tr key={ev.id} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div>{ev.worker.name}</div>
                    <div className="text-xs text-slate-400">{ev.worker.employeeNo}</div>
                  </td>
                  <td className="px-3 py-2 capitalize">{ev.eventType}</td>
                  <td className="px-3 py-2">{new Date(ev.serverTs).toLocaleString('en-PH')}</td>
                  <td className="px-3 py-2">
                    <span className="text-amber-600 font-medium">
                      {(ev.confidenceScore * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{ev.matchMethod}</td>
                  <td className="px-3 py-2 flex gap-2">
                    <button
                      onClick={() => handleReview(ev.id, 'approve')}
                      disabled={actioning === ev.id}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview(ev.id, 'reject')}
                      disabled={actioning === ev.id}
                      className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
