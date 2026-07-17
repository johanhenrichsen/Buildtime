import { useEffect, useState } from 'react';

interface Props {
  exiting: boolean;
}

function ClockFace() {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const inner = i % 3 === 0 ? 24 : 26;
    const outer = 30;
    return {
      x1: 36 + inner * Math.cos(angle),
      y1: 36 + inner * Math.sin(angle),
      x2: 36 + outer * Math.cos(angle),
      y2: 36 + outer * Math.sin(angle),
      major: i % 3 === 0,
    };
  });

  return (
    <svg width="80" height="80" viewBox="0 0 72 72" fill="none">
      <circle cx="36" cy="36" r="33" stroke="white" strokeWidth="3" />
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke="white"
          strokeWidth={t.major ? 2.5 : 1.5}
          strokeLinecap="round"
          opacity={t.major ? 1 : 0.35}
        />
      ))}
      {/* Hour hand ~10 */}
      <line x1="36" y1="36" x2="22" y2="19" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      {/* Minute hand ~2 */}
      <line x1="36" y1="36" x2="51" y2="26" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="36" cy="36" r="3.5" fill="white" />
    </svg>
  );
}

export function SplashScreen({ exiting }: Props) {
  const [contentIn, setContentIn] = useState(false);

  useEffect(() => {
    // Stagger the content fade-in so the transition registers
    const id = setTimeout(() => setContentIn(true), 60);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950 transition-transform duration-700 ease-in-out ${
        exiting ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      {/* Branding — fades + rises in on mount */}
      <div
        className={`flex flex-col items-center transition-all duration-500 ease-out ${
          contentIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="mb-7">
          <ClockFace />
        </div>
        <h1 className="text-5xl font-bold text-white tracking-tight leading-none mb-2">
          BuildTime
        </h1>
        <p className="text-neutral-500 text-sm font-medium">Workforce Attendance</p>
      </div>

      {/* Loading dots — hide once exit begins */}
      <div
        className={`absolute bottom-14 flex gap-2 transition-opacity duration-200 ${
          exiting ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
