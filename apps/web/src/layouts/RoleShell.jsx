import { useMutation } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Toast from '../components/Toast.jsx';

export default function RoleShell({ title, links }) {
  const navigate = useNavigate();
  const { user, clearSession } = useAuth();
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearSession();
      navigate('/login', { replace: true });
    },
  });

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-emerald-950/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link
            to={`/${user?.role}`}
            className="flex items-center gap-3 font-semibold tracking-tight text-ink"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest text-white">
              A
            </span>
            <span>
              AarogyaCare{' '}
              <span className="ml-1 font-normal text-slate-500">/ {title}</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-ink">{user?.name}</p>
              <p className="text-xs capitalize text-slate-500">
                {user?.role} account
              </p>
            </div>
            <button
              type="button"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
              className="rounded-xl border border-emerald-950/10 px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint disabled:opacity-60"
            >
              {logoutMutation.isPending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
        <nav
          aria-label={`${title} navigation`}
          className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 pb-3 sm:px-8"
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-mint text-forest' : 'text-slate-600 hover:bg-slate-50 hover:text-ink'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        {logoutMutation.isError && (
          <div className="mb-6">
            <Toast message="Your sign-out request could not reach the server. Your local session was cleared." />
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
