import { FormEvent, useEffect, useState } from 'react';
import {
  getCutoffs, getDtr, computeDtr, updateDtr, exportDtr,
  Cutoff, DtrRecord,
} from '../lib/api';
import { downloadCsv } from '../lib/csv';

interface EditModalProps {
  record: DtrRecord;
  onSave: (data: {
    regularHrs?: number;
    otHrs?: number;
    nightDiffHrs?: number;
    lateMin?: number;
    undertimeMin?: number;
    reason: string;
  }) => Promise<void>;
  onClose: () => void;
}

function EditModal({ record, onSave, onClose }: EditModalProps) {
  const [regularHrs,   setRegularHrs]   = useState(String(record.regularHrs));
  const [otHrs,        setOtHrs]        = useState(String(record.otHrs));
  const [nightDiffHrs, setNightDiffHrs] = useState(String(record.nightDiffHrs));
  const [lateMin,      setLateMin]      = useState(String(record.lateMin));
  const [undertimeMin, setUndertimeMin] = useState(String(record.undertimeMin));
  const [reason,       setReason]       = useState('');
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError('Reason is required'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        regularHrs:   parseFloat(regularHrs),
        otHrs:        parseFloat(otHrs),
        nightDiffHrs: parseFloat(nightDiffHrs),
        lateMin:      parseInt(lateMin, 10),
        undertimeMin: parseInt(undertimeMin, 10),
        reason:       reason.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="font-semibold mb-4">
          Edit DTR — {record.worker.name} ({record.date.slice(0, 10)})
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { label: 'Regular Hrs',     value: regularHrs,   set: setRegularHrs,   step: '0.01' },
            { label: 'OT Hrs',          value: otHrs,        set: setOtHrs,        step: '0.01' },
            { label: 'Night Diff Hrs',  value: nightDiffHrs, set: setNightDiffHrs, step: '0.01' },
            { label: 'Late (min)',       value: lateMin,      set: setLateMin,      step: '1' },
            { label: 'Undertime (min)', value: undertimeMin, set: setUndertimeMin, step: '1' },
          ].map(({ label, value, set, step }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input type="number" step={step} value={value} onChange={e => set(e.target.value)} min="0"
                className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reason (required)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} required
              className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded disabled:opacity-50 hover:bg-blue-700">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-1.5 text-sm text-slate-600 hover:text-slate-900">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DtrPage() {
  const [cutoffs,   setCutoffs]   = useState<Cutoff[]>([]);
  const [cutoffId,  setCutoffId]  = useState('');
  const [records,   setRecords]   = useState<DtrRecord[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [computing, setComputing] = useState(false);
  const [editing,   setEditing]   = useState<DtrRecord | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    getCutoffs().then(r => setCutoffs(r.data)).catch(console.error);
  }, []);

  async function loadDtr(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await getDtr(id, { limit: 200 });
      setRecords(res.data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleCutoffChange(id: string) {
    setCutoffId(id);
    if (id) loadDtr(id);
    else setRecords([]);
  }

  async function handleCompute() {
    if (!cutoffId) return;
    setComputing(true);
    setError(null);
    try {
      await computeDtr(cutoffId);
      await loadDtr(cutoffId);
    } catch (e) {
      setError(String(e));
    } finally {
      setComputing(false);
    }
  }

  async function handleEdit(data: Parameters<EditModalProps['onSave']>[0]) {
    if (!editing) return;
    await updateDtr(editing.id, data);
    setEditing(null);
    if (cutoffId) await loadDtr(cutoffId);
  }

  async function handleExport() {
    if (!cutoffId) return;
    try {
      const rows = await exportDtr(cutoffId);
      const cutoff = cutoffs.find(c => c.id === cutoffId);
      const filename = `dtr_${cutoff?.periodStart?.slice(0,10) ?? cutoffId}.csv`;
      downloadCsv(rows as Record<string, unknown>[], filename);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Daily Time Records</h2>

      <div className="flex gap-3 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cutoff Period</label>
          <select value={cutoffId} onChange={e => handleCutoffChange(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">— select cutoff —</option>
            {cutoffs.map(c => (
              <option key={c.id} value={c.id}>
                {c.periodStart.slice(0,10)} – {c.periodEnd.slice(0,10)}
              </option>
            ))}
          </select>
        </div>

        {cutoffId && (
          <>
            <button onClick={handleCompute} disabled={computing}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded disabled:opacity-50 hover:bg-indigo-700">
              {computing ? 'Computing…' : 'Run Compute'}
            </button>
            <button onClick={handleExport}
              className="px-4 py-2 bg-slate-600 text-white text-sm rounded hover:bg-slate-700">
              Export CSV
            </button>
          </>
        )}
      </div>

      {error   && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && <p className="text-slate-500 text-sm">Loading…</p>}

      {!loading && records.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left">
                {['Employee', 'Date', 'Reg Hrs', 'OT Hrs', 'Night Diff', 'Late (min)', 'Undertime (min)', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2 font-medium text-slate-600 border-b">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2">{r.worker.name}</td>
                  <td className="px-3 py-2">{r.date.slice(0,10)}</td>
                  <td className="px-3 py-2">{Number(r.regularHrs).toFixed(2)}</td>
                  <td className="px-3 py-2">{Number(r.otHrs).toFixed(2)}</td>
                  <td className="px-3 py-2">{Number(r.nightDiffHrs).toFixed(2)}</td>
                  <td className="px-3 py-2">{r.lateMin}</td>
                  <td className="px-3 py-2">{r.undertimeMin}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      r.status === 'approved' ? 'bg-green-100 text-green-700' :
                      r.status === 'disputed' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => setEditing(r)}
                      className="text-blue-600 hover:text-blue-800 text-xs underline">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditModal record={editing} onSave={handleEdit} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
