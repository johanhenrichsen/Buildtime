import { FormEvent, useEffect, useState } from 'react';
import { getWorkers, createWorker, updateWorker, Worker } from '../lib/api';

interface WorkerFormProps {
  initial?: Partial<Worker>;
  onSave: (data: Partial<Worker> & { password?: string }) => Promise<void>;
  onCancel: () => void;
}

function WorkerForm({ initial, onSave, onCancel }: WorkerFormProps) {
  const [name,           setName]           = useState(initial?.name ?? '');
  const [employeeNo,     setEmployeeNo]     = useState(initial?.employeeNo ?? '');
  const [email,          setEmail]          = useState(initial?.email ?? '');
  const [roleId,         setRoleId]         = useState(initial?.roleId ?? '');
  const [employmentType, setEmploymentType] = useState(initial?.employmentType ?? 'regular');
  const [dailyRate,      setDailyRate]      = useState(initial?.dailyRate ?? '0');
  const [hireDate,       setHireDate]       = useState(initial?.hireDate?.slice(0,10) ?? '');
  const [status,         setStatus]         = useState(initial?.status ?? 'active');
  const [password,       setPassword]       = useState('');
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<Worker> & { password?: string } = {
        name, employeeNo, email: email || undefined, roleId,
        employmentType, dailyRate, hireDate, status,
        ...(password && !initial ? { password } : {}),
      };
      await onSave(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-lg">
      {[
        { label: 'Name',        value: name,           set: setName,           type: 'text' },
        { label: 'Employee No', value: employeeNo,     set: setEmployeeNo,     type: 'text' },
        { label: 'Email',       value: email,          set: setEmail,          type: 'email' },
        { label: 'Role ID',     value: roleId,         set: setRoleId,         type: 'text' },
        { label: 'Daily Rate',  value: dailyRate,      set: setDailyRate,      type: 'number' },
        { label: 'Hire Date',   value: hireDate,       set: setHireDate,       type: 'date' },
      ].map(({ label, value, set, type }) => (
        <div key={label}>
          <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
          <input
            type={type}
            value={value}
            onChange={e => set(e.target.value)}
            className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      ))}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Employment Type</label>
        <select value={employmentType} onChange={e => setEmploymentType(e.target.value)}
          className="w-full border rounded px-3 py-1.5 text-sm">
          <option value="regular">Regular</option>
          <option value="project-based">Project-based</option>
          <option value="casual">Casual</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="w-full border rounded px-3 py-1.5 text-sm">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {!initial && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded disabled:opacity-50 hover:bg-blue-700">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-1.5 text-sm text-slate-600 hover:text-slate-900">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function WorkersPage() {
  const [workers,  setWorkers]  = useState<Worker[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [view,     setView]     = useState<'list' | 'create' | Worker>('list');

  async function load() {
    setLoading(true);
    try {
      const res = await getWorkers({ limit: 100 });
      setWorkers(res.data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(data: Partial<Worker> & { password?: string }) {
    await createWorker(data);
    setView('list');
    load();
  }

  async function handleUpdate(id: string, data: Partial<Worker>) {
    await updateWorker(id, data);
    setView('list');
    load();
  }

  if (view === 'create') {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Create Worker</h2>
        <WorkerForm onSave={handleCreate} onCancel={() => setView('list')} />
      </div>
    );
  }

  if (typeof view === 'object') {
    const worker = view;
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Edit Worker — {worker.name}</h2>
        <WorkerForm
          initial={worker}
          onSave={data => handleUpdate(worker.id, data)}
          onCancel={() => setView('list')}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Workers</h2>
        <button onClick={() => setView('create')}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
          + Create
        </button>
      </div>

      {loading && <p className="text-slate-500 text-sm">Loading…</p>}
      {error   && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left">
                {['Employee No', 'Name', 'Role', 'Status', 'Daily Rate'].map(h => (
                  <th key={h} className="px-3 py-2 font-medium text-slate-600 border-b">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.map(w => (
                <tr key={w.id} onClick={() => setView(w)}
                  className="hover:bg-slate-50 cursor-pointer border-b">
                  <td className="px-3 py-2">{w.employeeNo}</td>
                  <td className="px-3 py-2">{w.name}</td>
                  <td className="px-3 py-2">{w.role?.name ?? w.roleId}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      w.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">₱{Number(w.dailyRate).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
