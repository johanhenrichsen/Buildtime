import { useEffect, useState } from 'react';
import { getWorkers, Worker } from '../lib/api';
import { EnrollmentCamera } from '../components/EnrollmentCamera';

export default function EnrollmentPage() {
  const [workers,    setWorkers]    = useState<Worker[]>([]);
  const [selected,   setSelected]   = useState<string>('');
  const [result,     setResult]     = useState<{ msg: string; success: boolean } | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    getWorkers({ status: 'active', limit: 200 })
      .then(res => setWorkers(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleResult(msg: string, success: boolean) {
    setResult({ msg, success });
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Face Enrollment</h2>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Select Worker</label>
        {loading ? (
          <p className="text-slate-500 text-sm">Loading workers…</p>
        ) : (
          <select
            value={selected}
            onChange={e => { setSelected(e.target.value); setResult(null); }}
            className="border rounded px-3 py-2 text-sm w-72 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">— choose a worker —</option>
            {workers.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.employeeNo})</option>
            ))}
          </select>
        )}
      </div>

      {result && (
        <div className={`mb-4 p-3 rounded text-sm ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {result.msg}
        </div>
      )}

      {selected && (
        <EnrollmentCamera
          workerId={selected}
          onResult={handleResult}
        />
      )}
    </div>
  );
}
