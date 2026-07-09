import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getUser, clearToken } from '../lib/auth';

const navLinks = [
  { to: '/workers',    label: 'Workers' },
  { to: '/enrollment', label: 'Enrollment' },
  { to: '/dtr',        label: 'DTR' },
  { to: '/flagged',    label: 'Flagged' },
  { to: '/audit',      label: 'Audit Log' },
];

export function Layout() {
  const navigate  = useNavigate();
  const user      = getUser();

  function handleLogout() {
    clearToken();
    navigate('/login');
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-800 text-white flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-slate-700">
          <h1 className="text-lg font-bold">BuildTime</h1>
          <p className="text-xs text-slate-400 mt-1 truncate">{user?.name ?? 'Admin'}</p>
        </div>

        <nav className="flex-1 py-4">
          {navLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${
                  isActive ? 'bg-slate-700 font-medium' : 'text-slate-300'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
