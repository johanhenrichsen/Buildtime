import { useEffect, useRef, useState } from 'react';
import type { RosterEntry } from '../types';

interface Props {
  roster: RosterEntry[];
  onSuccess: (entry: RosterEntry) => void;
  onCancel: () => void;
}

export function PinEntry({ roster, onSuccess, onCancel }: Props) {
  const [pin, setPin]     = useState('');
  const [error, setError] = useState('');
  const inputRef          = useRef<HTMLInputElement>(null);

  // Auto-focus hidden input on mount so hardware keyboard works immediately
  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleKeyInput(e: React.ChangeEvent<HTMLInputElement>) {
    setPin(e.target.value.toUpperCase());
    setError('');
  }

  function press(digit: string) {
    if (pin.length >= 12) return;
    setPin((p) => p + digit);
    setError('');
    inputRef.current?.focus();
  }

  function del() {
    setPin((p) => p.slice(0, -1));
    setError('');
    inputRef.current?.focus();
  }

  function submit() {
    const q = pin.trim().toUpperCase();
    const match = roster.find((e) => e.employeeNo.toUpperCase() === q);
    if (match) {
      onSuccess(match);
    } else {
      setError('No worker found with that ID. Check your employee number and try again.');
      setPin('');
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submit();
  }

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-slate-900 px-6">
      <div className="w-full max-w-xs">
        <h2 className="text-white text-2xl font-bold text-center mb-1">Enter Your Employee ID</h2>
        <p className="text-slate-400 text-sm text-center mb-6">Your employee number, e.g. EMP-001</p>

        {/* Hidden input — captures keyboard/numpad hardware input and routes through state */}
        <input
          ref={inputRef}
          type="text"
          value={pin}
          onChange={handleKeyInput}
          onKeyDown={handleKeyDown}
          className="sr-only"
          aria-label="Employee ID"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
        />

        {/* Display — tap to show on-screen keyboard (needed for alpha-numeric IDs like EMP-001) */}
        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="w-full bg-slate-800 rounded-xl px-5 py-3 text-center mb-2 min-h-[52px] flex items-center justify-center cursor-text"
          aria-label="Tap to type employee ID"
        >
          <span className="text-white text-3xl font-mono tracking-widest">
            {pin || <span className="text-slate-600">_ _ _ _ _</span>}
          </span>
        </button>
        <p className="text-slate-500 text-xs text-center mb-1">Tap the field above to type with keyboard</p>
        {error && <p className="text-red-400 text-sm text-center mb-2">{error}</p>}

        {/* Numpad — quick entry for purely numeric IDs */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {keys.map((k, i) =>
            k === '' ? (
              <div key={i} />
            ) : k === '⌫' ? (
              <button
                key={i}
                onClick={del}
                className="h-16 rounded-xl bg-slate-700 text-white text-xl font-medium active:bg-slate-600"
              >
                {k}
              </button>
            ) : (
              <button
                key={i}
                onClick={() => press(k)}
                className="h-16 rounded-xl bg-slate-700 text-white text-2xl font-medium active:bg-slate-600"
              >
                {k}
              </button>
            )
          )}
        </div>

        <button
          onClick={submit}
          disabled={pin.length === 0}
          className="w-full mt-4 py-3 rounded-xl bg-blue-600 text-white text-lg font-semibold disabled:opacity-40 active:bg-blue-500"
        >
          Confirm
        </button>

        <button
          onClick={onCancel}
          className="w-full mt-2 py-2 text-slate-400 text-sm hover:text-slate-300"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
