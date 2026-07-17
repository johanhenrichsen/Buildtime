import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Bell, Flag, Wallet, RefreshCcw, X } from 'lucide-react';
import { useNotifications } from '@/lib/queries';
import type { NotificationItem } from '@/lib/api';

const SEEN_KEY = 'notifications_seen_at';

function getSeenAt(): number {
  return parseInt(localStorage.getItem(SEEN_KEY) ?? '0', 10);
}

function markSeen() {
  localStorage.setItem(SEEN_KEY, String(Date.now()));
}

function typeIcon(type: NotificationItem['type']) {
  if (type === 'flagged') return <Flag className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
  if (type === 'advance') return <Wallet className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />;
  return <RefreshCcw className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
}

function typeLabel(type: NotificationItem['type']) {
  if (type === 'flagged') return 'Flagged';
  if (type === 'advance') return 'Advance';
  return 'Re-enroll';
}

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export function NotificationBell() {
  const [open, setOpen]           = useState(false);
  const [seenAt, setSeenAt]       = useState(getSeenAt);
  const panelRef                  = useRef<HTMLDivElement>(null);
  const { data, isLoading }       = useNotifications();
  const items                     = data?.items ?? [];

  const unreadCount = items.filter(i => new Date(i.ts).getTime() > seenAt).length;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleOpen() {
    setOpen(o => !o);
    if (!open) {
      markSeen();
      setSeenAt(Date.now());
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">Notifications</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading && (
              <p className="text-sm text-muted-foreground px-4 py-6 text-center">Loading…</p>
            )}

            {!isLoading && items.length === 0 && (
              <p className="text-sm text-muted-foreground px-4 py-6 text-center">No notifications</p>
            )}

            {items.map(item => (
              <Link key={`${item.type}:${item.id}`} href={item.link} onClick={() => setOpen(false)}>
                <div className={`flex items-start gap-3 px-4 py-3 hover:bg-accent/40 transition-colors border-b border-border last:border-0 ${
                  new Date(item.ts).getTime() > seenAt ? 'bg-accent/20' : ''
                }`}>
                  <div className="mt-0.5">{typeIcon(item.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {typeLabel(item.type)}
                      </span>
                      <span className="text-xs text-muted-foreground/60">·</span>
                      <span className="text-xs text-muted-foreground/60">{relativeTime(item.ts)}</span>
                    </div>
                    <p className="text-sm font-medium leading-tight truncate">{item.workerName}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{item.message}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
