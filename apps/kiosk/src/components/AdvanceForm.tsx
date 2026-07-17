import { useState } from 'react';
import type { RosterEntry } from '../types';

interface Props {
  worker: Pick<RosterEntry, 'workerId' | 'name' | 'employeeNo'>;
  onSubmit: (amount: number, reason: string) => Promise<void>;
  onCancel: () => void;
}

const PRESET_AMOUNTS = [500, 1000, 2000, 5000];

export function AdvanceForm({ worker, onSubmit, onCancel }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const initials = worker.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const numAmount = parseInt(amount, 10);
  const valid = numAmount >= 1 && reason.trim().length >= 5;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(numAmount, reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request.');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-neutral-900 text-white px-6">
      <div className="w-full max-w-sm">
        {/* Worker */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-neutral-700 border border-neutral-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {initials}
          </div>
          <div>
            <div className="font-semibold leading-tight">{worker.name}</div>
            <div className="text-xs text-neutral-500">{worker.employeeNo}</div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-5">Request Cash Advance</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Preset amounts */}
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider mb-2 block">Amount (PHP)</label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {PRESET_AMOUNTS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    amount === String(p)
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-300 active:bg-neutral-700'
                  }`}
                >
                  {p.toLocaleString()}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              max={500000}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Custom amount…"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white text-lg placeholder-neutral-600 outline-none focus:border-blue-500"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="text-xs text-neutral-400 uppercase tracking-wider mb-2 block">Reason</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="Brief explanation (at least 5 characters)…"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-600 outline-none focus:border-blue-500 resize-none text-sm"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/30 border border-red-700/40 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!valid || submitting}
            className="w-full py-4 rounded-xl bg-blue-600 text-white text-lg font-bold disabled:opacity-40 active:bg-blue-500 transition-opacity"
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 text-neutral-500 text-sm hover:text-neutral-300 transition-colors"
          >
            ← Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
