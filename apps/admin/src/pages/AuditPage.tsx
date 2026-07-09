import { useEffect, useState } from 'react';
import { getAuditLog, AuditEntry } from '../lib/api';

const ENTITY_OPTIONS = ['', 'attendance_event', 'dtr_record', 'worker', 'face_embedding'];

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [entity,  setEntity]  = useState('');
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const limit = 25;

  async function load(p = page, ent = entity) {
    setLoading(true);
    setError(null);
    try {
      const res = await getAuditLog({ entity: ent || undefined, page: p, limit });
      setEntries(res.data);
      setTotal(res.meta.total);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1, entity); setPage(1); }, [entity]);

  const totalPages = Math.ceil(total / limit);

  function changePage(p: number) {
    setPage(p);
    load(p, entity);
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Audit Log</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Filter by Entity</label>
        <select value={entity} onChange={e => setEntity(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-blue-500">
          {ENTITY_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt || '— all entities —'}</option>
          ))}
        </select>
      </div>

      {error   && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && <p className="text-slate-500 text-sm">Loading…</p>}

      {!loading && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  {['Time', 'Actor', 'Action', 'Entity', 'Entity ID'].map(h => (
                    <th key={h} className="px-3 py-2 font-medium text-slate-600 border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-4 text-slate-400 text-center">No entries</td></tr>
                ) : entries.map(e => (
                  <tr key={e.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">
                      {new Date(e.ts).toLocaleString('en-PH')}
                    </td>
                    <td className="px-3 py-2">
                      <div>{e.actor.name}</div>
                      <div className="text-xs text-slate-400">{e.actor.employeeNo}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                    <td className="px-3 py-2 text-xs">{e.entity}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">{e.entityId.slice(0, 8)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex gap-2 mt-4 items-center text-sm">
              <button onClick={() => changePage(page - 1)} disabled={page <= 1}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-slate-100">
                Prev
              </button>
              <span className="text-slate-600">Page {page} of {totalPages}</span>
              <button onClick={() => changePage(page + 1)} disabled={page >= totalPages}
                className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-slate-100">
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
