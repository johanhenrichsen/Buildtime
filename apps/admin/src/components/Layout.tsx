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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearToken, getUser } from '@/lib/auth';

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
};

const NAV: NavItem[] = [
  { label: 'Workers', path: '/workers', icon: <Users className="w-4 h-4" /> },
  { label: 'Sites', path: '/sites', icon: <Building2 className="w-4 h-4" /> },
  { label: 'Enrollment', path: '/enrollment', icon: <Camera className="w-4 h-4" /> },
  { label: 'Payroll / DTR', path: '/payroll', icon: <FileText className="w-4 h-4" /> },
  { label: 'Flagged Events', path: '/flagged', icon: <Flag className="w-4 h-4" /> },
  { label: 'Audit Log', path: '/audit', icon: <Shield className="w-4 h-4" /> },
  { label: 'Reports', path: '/reports', icon: <BarChart2 className="w-4 h-4" /> },
];

type LayoutProps = {
  children: React.ReactNode;
};

export function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const user = getUser();

  function handleSignOut() {
    clearToken();
    setLocation('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-60 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 bg-sidebar-primary rounded-md flex items-center justify-center flex-shrink-0">
            <HardHat className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-sidebar-foreground leading-tight">BuildTime</p>
            <p className="text-xs text-sidebar-foreground/50 leading-tight">Admin Portal</p>
          </div>
        </div>

        {user && (
          <div className="px-4 py-3 border-b border-sidebar-border">
            <p className="text-xs text-sidebar-foreground/50 mb-0.5 uppercase tracking-widest font-medium">Signed in as</p>
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV.map((item) => {
            const isActive = location === item.path || location.startsWith(item.path + '/');
            return (
              <Link key={item.path} href={item.path}>
                <a
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-0.5 ${
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                </a>
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

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
