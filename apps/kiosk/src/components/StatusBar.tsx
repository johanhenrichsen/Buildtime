interface Props {
  isOnline: boolean;
  pendingCount: number;
  rosterSize: number;
}

export function StatusBar({ isOnline, pendingCount, rosterSize }: Props) {
  return (
    <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-black/50 text-xs text-white z-10">
      <span className="font-semibold tracking-wide">BuildTime</span>
      <div className="flex items-center gap-4">
        <span title={`${rosterSize} enrolled workers cached`}>
          👥 {rosterSize}
        </span>
        {pendingCount > 0 && (
          <span className="text-yellow-400" title="Events pending sync">
            ⏳ {pendingCount} pending
          </span>
        )}
        <span className={isOnline ? 'text-green-400' : 'text-red-400'}>
          {isOnline ? '● Online' : '● Offline'}
        </span>
      </div>
    </div>
  );
}
