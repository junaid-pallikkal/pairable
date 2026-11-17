import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import {
  Bell,
  Compass,
  Home,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Package,
  Search,
  Settings,
  Shield,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ButtonLink, IconButton, PageSpinner } from './ui'
import { Assistant } from './Assistant'

/* ---------- Logo & theme ---------- */

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight" aria-label="SOLVIA home">
      <img src="/favicon.svg" alt="" width={28} height={28} />
      SOLVIA
    </Link>
  )
}

type Theme = 'system' | 'light' | 'dark'
function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('solvia_theme') as Theme) || 'system'
    } catch {
      return 'system'
    }
  })
  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
  const icon: Record<Theme, LucideIcon> = { system: Monitor, light: Sun, dark: Moon }
  return (
    <IconButton
      icon={icon[theme]}
      label={`Theme: ${theme}`}
      className={className}
      onClick={() => {
        const t = next[theme]
        setTheme(t)
        try {
          localStorage.setItem('solvia_theme', t)
        } catch {
          /* ignore */
        }
        applyTheme(t)
      }}
    />
  )
}

/* ---------- Public layout ---------- */

export function PublicLayout() {
  const { session } = useAuth()
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-surface focus:p-3">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm font-semibold sm:flex" aria-label="Main">
            <NavLink to="/explore" className="hover:text-primary">Explore</NavLink>
            <NavLink to="/how-it-works" className="hover:text-primary">How it works</NavLink>
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {session ? (
              <ButtonLink to="/app">Open app</ButtonLink>
            ) : (
              <>
                <ButtonLink to="/sign-in" variant="ghost" className="hidden sm:inline-flex">Sign in</ButtonLink>
                <ButtonLink to="/sign-up">Get started</ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line py-8 text-sm text-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4">
          <span>© SOLVIA</span>
          <nav className="flex gap-5" aria-label="Footer">
            <Link to="/about" className="hover:text-fg">About</Link>
            <Link to="/privacy" className="hover:text-fg">Privacy</Link>
            <Link to="/terms" className="hover:text-fg">Terms</Link>
          </nav>
        </div>
      </footer>
      <Assistant />
    </div>
  )
}

/* ---------- Auth guard ---------- */

export function RequireAuth() {
  const { session, profile, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <PageSpinner />
  if (!session) return <Navigate to="/sign-in" state={{ from: loc.pathname + loc.search }} replace />
  if (!profile) return <PageSpinner />
  if (profile.status !== 'active') return <Suspended />
  if (!profile.onboarded_at && loc.pathname !== '/app/welcome') {
    return <Navigate to="/app/welcome" replace />
  }
  return <Outlet />
}

function Suspended() {
  const { signOut } = useAuth()
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Your account is not active</h1>
      <p className="text-muted">It was paused after a review. If you think this is a mistake, contact support.</p>
      <button onClick={() => signOut()} className="min-h-11 rounded-xl bg-fg px-5 text-sm font-semibold text-bg">Sign out</button>
    </div>
  )
}

/* ---------- App layout ---------- */

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/app', label: 'Dashboard', icon: Home, end: true },
  { to: '/app/find', label: 'Find solvers', icon: Search },
  { to: '/app/explore', label: 'Explore', icon: Compass },
  { to: '/app/connections', label: 'Connections', icon: Users },
  { to: '/app/messages', label: 'Messages', icon: MessageSquare },
  { to: '/app/resources', label: 'Resources', icon: Package },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]
const ADMIN_ITEM = { to: '/app/admin', label: 'Admin', icon: Shield, end: false }
const MOBILE = ['/app', '/app/find', '/app/messages', '/app/connections', '/app/settings'].map((t) => NAV.find((n) => n.to === t)!)

function useUnread(uid: string | undefined) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!uid) return
    let alive = true
    const load = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
      if (alive) setN(count ?? 0)
    }
    load()
    const ch = supabase
      .channel('unread-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, load)
      .subscribe()
    return () => {
      alive = false
      supabase.removeChannel(ch)
    }
  }, [uid])
  return n
}

const circle = 'rounded-full! border border-fg bg-surface'

export function AppLayout() {
  const { session, profile, signOut } = useAuth()
  const items = profile?.is_admin ? [...NAV, ADMIN_ITEM] : NAV
  const unread = useUnread(session?.user.id)
  const nav = useNavigate()

  const bell = (
    <div className="relative">
      <IconButton icon={Bell} label="Notifications" className={circle} onClick={() => nav('/app/notifications')} />
      {unread > 0 && (
        <span className="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-black">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </div>
  )
  const out = (
    <IconButton
      icon={LogOut}
      label="Sign out"
      className={circle}
      onClick={async () => {
        await signOut()
        nav('/')
      }}
    />
  )

  return (
    <div className="min-h-screen bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-surface focus:p-3">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col bg-surface pb-6 pt-7 md:flex">
        <div className="mb-10 px-8">
          <Logo />
        </div>
        <nav className="flex flex-col gap-1.5 pr-4" aria-label="App">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-r-2xl pl-8 pr-4 text-sm font-semibold ${
                  isActive ? 'bg-fg text-bg' : 'text-fg hover:bg-surface-2'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} aria-hidden className={isActive ? 'text-accent' : ''} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 px-8">
          <ThemeToggle className={circle} />
          {bell}
          {out}
        </div>
      </aside>

      <div className="min-h-screen md:pl-60">
        <header className="flex h-16 items-center justify-between px-5 md:hidden">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle className={circle} />
            {bell}
            {out}
          </div>
        </header>
        <main id="main" className="mx-auto max-w-5xl px-5 py-6 pb-28 md:px-12 md:py-10 md:pb-16">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="App"
        className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 gap-1 rounded-2xl bg-surface p-1.5 shadow-float md:hidden"
      >
        {MOBILE.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold ${
                isActive ? 'bg-fg text-bg' : 'text-muted'
              }`
            }
          >
            <Icon size={20} aria-hidden />
            {label.split(' ')[0]}
          </NavLink>
        ))}
      </nav>
      <Assistant />
    </div>
  )
}
