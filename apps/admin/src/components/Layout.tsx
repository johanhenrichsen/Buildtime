import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Users,
  Building2,
  FileText,
  Flag,
  Shield,
  BarChart2,
  Camera,
  LogOut,
  ChevronRight,
  HardHat,
  Menu,
  Wallet,
  X,
  LayoutDashboard,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearToken, getUser } from '@/lib/auth';
import { useFlagged, useCashAdvances } from '@/lib/queries';

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
};

const NAV: NavItem[] = [
  { label: 'Dashboard',     path: '/',           icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'Workers',       path: '/workers',    icon: <Users className="w-4 h-4" /> },
  { label: 'Sites',         path: '/sites',      icon: <Building2 className="w-4 h-4" /> },
  { label: 'Shifts',        path: '/shifts',     icon: <Clock className="w-4 h-4" /> },
  { label: 'Enrollment',    path: '/enrollment', icon: <Camera className="w-4 h-4" /> },
  { label: 'Payroll / DTR', path: '/payroll',    icon: <FileText className="w-4 h-4" /> },
  { label: 'Cash Advances', path: '/advances',   icon: <Wallet className="w-4 h-4" /> },
  { label: 'Flagged Events',path: '/flagged',    icon: <Flag className="w-4 h-4" /> },
  { label: 'Audit Log',     path: '/audit',      icon: <Shield className="w-4 h-4" /> },
  { label: 'Reports',       path: '/reports',    icon: <BarChart2 className="w-4 h-4" /> },
];

type LayoutProps = { children: React.ReactNode };

export function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const user = getUser();

  const { data: flaggedData }  = useFlagged();
  const { data: advancesData } = useCashAdvances({ status: 'pending', limit: 1 });
  const flaggedCount  = flaggedData?.meta?.total ?? flaggedData?.data?.length ?? 0;
  const advancesCount = advancesData?.meta?.total ?? 0;

  const badgeCounts: Record<string, number> = {
    '/flagged':  flaggedCount,
    '/advances': advancesCount,
  };

  function handleSignOut() {
    clearToken();
    setLocation('/login');
  }

  function closeAndNavigate() {
    setOpen(false);
  }

  const sidebar = (
    <aside className="w-60 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-full border-r border-sidebar-border">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 bg-sidebar-primary rounded-md flex items-center justify-center flex-shrink-0">
          <HardHat className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-sidebar-foreground leading-tight">BuildTime</p>
          <p className="text-xs text-sidebar-foreground/50 leading-tight">Admin Portal</p>
        </div>
        {/* Close button — mobile only */}
        <button
          className="md:hidden p-1 rounded text-sidebar-foreground/60 hover:text-sidebar-foreground"
          onClick={() => setOpen(false)}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {user && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/50 mb-0.5 uppercase tracking-widest font-medium">Signed in as</p>
          <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV.map((item) => {
          const isActive = item.path === '/'
            ? location === '/'
            : location === item.path || location.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={closeAndNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors mb-0.5 ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
              }`}
            >
              {item.icon}
              {item.label}
              <span className="ml-auto flex items-center gap-1">
                {(badgeCounts[item.path] ?? 0) > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {(badgeCounts[item.path] ?? 0) > 99 ? '99+' : badgeCounts[item.path]}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3 h-3" />}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 text-xs"
          onClick={handleSignOut}
        >
          <LogOut className="w-3.5 h-3.5 mr-2" />
          Sign Out
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between h-14 px-4 bg-sidebar border-b border-sidebar-border">
        <button
          className="p-1.5 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-sidebar-primary rounded flex items-center justify-center">
            <HardHat className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-sidebar-foreground">BuildTime</span>
        </div>
        <div className="w-8" />
      </div>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — always visible on md+, drawer on mobile */}
      <div
        className={`
          fixed md:relative inset-y-0 left-0 z-50 flex flex-col
          transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {sidebar}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
