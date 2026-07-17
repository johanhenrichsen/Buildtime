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
      setError('Employee ID not found. Check your number and try again.');
      setPin('');
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submit();
  }

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-neutral-900 px-6">
      <div className="w-full max-w-xs">
        <h2 className="text-white text-2xl font-bold text-center mb-1">Employee ID</h2>
        <p className="text-neutral-500 text-sm text-center mb-5">Enter your employee number</p>

        {/* Hidden input for hardware keyboard */}
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

        {/* Display field */}
        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-5 py-4 text-center mb-1 min-h-[60px] flex items-center justify-center"
        >
          <span className="text-white text-3xl font-mono tracking-widest">
            {pin || <span className="text-neutral-600">— — — — —</span>}
          </span>
        </button>

        {error
          ? <p className="text-red-400 text-sm text-center mb-3 mt-1">{error}</p>
          : <p className="text-neutral-600 text-xs text-center mb-3 mt-1">Tap field to use keyboard</p>
        }

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 mt-1">
          {keys.map((k, i) =>
            k === '' ? (
              <div key={i} />
            ) : k === '⌫' ? (
              <button
                key={i}
                onClick={del}
                className="h-14 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-xl font-medium active:bg-neutral-700"
              >
                {k}
              </button>
            ) : (
              <button
                key={i}
                onClick={() => press(k)}
                className="h-14 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-2xl font-semibold active:bg-neutral-700"
              >
                {k}
              </button>
            )
          )}
        </div>

        <button
          onClick={submit}
          disabled={pin.length === 0}
          className="w-full mt-3 py-4 rounded-xl bg-blue-600 text-white text-lg font-bold disabled:opacity-40 active:bg-blue-500 transition-opacity"
        >
          Confirm
        </button>

        <button
          onClick={onCancel}
          className="w-full mt-2 py-2 text-neutral-500 text-sm hover:text-neutral-300 transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
