import { Activity, Bell, CalendarDays, Dumbbell, LayoutDashboard, Settings, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import type { User } from '../../context/AuthContext';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/assessment', label: 'Assessment', icon: ShieldAlert },
  { to: '/plan', label: 'Workout Plan', icon: CalendarDays },
  { to: '/session', label: 'Live Tracker', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Navbar({ user }: { user: User | null }) {
  const role = user?.role || user?.roles?.[0];
  const allLinks =
    role?.toLowerCase() === 'admin'
      ? [...links, { to: '/admin', label: 'Admin', icon: ShieldCheck }]
      : links;

  return (
    <>
      {/* Desktop Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-7 px-4 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2.5 font-black tracking-tight group">
            <span className="grid size-9 place-items-center rounded-xl bg-lime-400 text-zinc-950 shadow-sm transition-transform group-hover:scale-105">
              <Dumbbell className="h-5 w-5 stroke-[2.5]" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-white">
              PHYSIO<span className="text-lime-400">COACH</span> <span className="rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">AI</span>
            </span>
          </Link>

          <nav className="hidden flex-1 justify-center gap-1.5 md:flex">
            {allLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'relative flex items-center gap-2 rounded-xl px-4 py-2 text-xs tracking-wide transition-all duration-150',
                    isActive
                      ? 'bg-lime-400/10 text-lime-400 border border-lime-400/30 font-extrabold'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white font-bold',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User profile capsule */}
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-xl text-zinc-400 transition-colors hover:text-lime-400"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            <div className="text-right hidden sm:block">
              <p className="max-w-40 truncate text-xs font-bold text-white">
                {user?.displayName || user?.email?.split('@')[0] || 'Athlete'}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {role || 'Standard'}
              </p>
            </div>
            <div className="grid size-9 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-xs font-black text-lime-400">
              {(user?.displayName || user?.email || 'A').slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Thumb Zone Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-zinc-800 bg-zinc-950/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-1 backdrop-blur-lg md:hidden">
        {allLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] tracking-wider transition-colors',
                isActive ? 'text-lime-400 font-black' : 'text-zinc-500 hover:text-zinc-300 font-bold',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={clsx('h-5 w-5 transition-transform', isActive && 'scale-110')} />
                <span>{label}</span>
                {isActive && (
                  <span className="absolute bottom-0 size-1.5 rounded-full bg-lime-400 mt-0.5" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

