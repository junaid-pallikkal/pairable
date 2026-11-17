import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Bookmark, Dices, Lock, Search, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { loadHelpers, loadProblems, topicsFrom, useSaved, type ExploreItem, type HelperItem, type ProblemItem, type Sort } from '../lib/explore'
import { Button, ButtonLink, ErrorState, Skeleton } from '../components/ui'
import { CardFor } from '../components/ExploreCards'
import { ExploreSheet } from '../components/ExploreSheet'
import { Mascot } from '../components/Mascot'

type Tab = 'problems' | 'solvers'
const PAGE = 12

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export default function Explore() {
  const { session } = useAuth()
  const signedIn = !!session
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'solvers' ? 'solvers' : 'problems'

  const [input, setInput] = useState('')
  const term = useDebounced(input.trim(), 350)
  const [sort, setSort] = useState<Sort>('new')
  const [savedOnly, setSavedOnly] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const { saved, toggle } = useSaved()
  const searchRef = useRef<HTMLInputElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  const problems = useData(() => loadProblems(signedIn, term, sort), [signedIn, term, sort])
  const helpers = useData<HelperItem[]>(() => (signedIn ? loadHelpers(term, sort) : Promise.resolve([])), [signedIn, term, sort])

  const active = tab === 'problems' ? problems : helpers
  const all: ExploreItem[] = useMemo(() => (active.data ?? []) as ExploreItem[], [active.data])
  const visibleAll = useMemo(() => (savedOnly ? all.filter((i) => saved.has(i.key)) : all), [all, savedOnly, saved])
  const shown = visibleAll.slice(0, limit)
  const topics = useMemo(() => topicsFrom(all), [all])
  const waitingCount = (problems.data ?? []).filter((p) => p.waiting).length
  const savedCount = [...saved].filter((k) => k.startsWith(tab === 'problems' ? 'p:' : 'h:')).length

  useEffect(() => setLimit(PAGE), [tab, term, sort, savedOnly])
  useEffect(() => {
    if (tab === 'solvers' && sort === 'waiting') setSort('new')
  }, [tab, sort])

  const openIndex = openKey ? visibleAll.findIndex((i) => i.key === openKey) : -1
  function open(key: string) {
    opener.current = document.activeElement as HTMLElement
    setOpenKey(key)
  }
  function close() {
    setOpenKey(null)
    opener.current?.focus()
  }
  function go(i: number) {
    const item = visibleAll[i]
    if (item) {
      setOpenKey(item.key)
      if (i >= limit) setLimit(i + 1)
    }
  }
  function surprise() {
    if (visibleAll.length === 0) return
    const pool = visibleAll.filter((i) => i.key !== openKey)
    open((pool[Math.floor(Math.random() * pool.length)] ?? visibleAll[0]).key)
  }

  // keyboard: / to search, Esc to close, arrows to flip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
      if (e.key === 'Escape' && openKey) return close()
      if (typing) return
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (openKey && e.key === 'ArrowRight') go(openIndex + 1)
      if (openKey && e.key === 'ArrowLeft') go(openIndex - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const setTab = (t: Tab) => {
    setParams(t === 'solvers' ? { tab: 'solvers' } : {}, { replace: true })
    setOpenKey(null)
  }

  const sorts: { id: Sort; label: string; show: boolean; needsAccount?: boolean }[] = [
    { id: 'new', label: 'Newest', show: true },
    { id: 'fit', label: 'Best for me', show: true, needsAccount: true },
    { id: 'waiting', label: 'Waiting longest', show: tab === 'problems' },
  ]

  const locked = tab === 'solvers' && !signedIn

  return (
    <div className={signedIn ? '' : 'mx-auto max-w-6xl px-4 py-10'}>
      {/* header with Pip */}
      <div className="relative mb-8 overflow-hidden rounded-[2rem] bg-fg p-7 text-bg md:p-9">
        <div className="absolute -left-10 -top-12 h-48 w-48 rounded-full bg-accent/30 blur-3xl" aria-hidden />
        <div className="relative max-w-lg">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Explore</h1>
          <p className="mt-2 text-sm text-white/70">
            {tab === 'problems'
              ? problems.data
                ? `${problems.data.length} problems${waitingCount ? ` · ${waitingCount} waiting for a helper` : ''}`
                : 'Finding problems…'
              : signedIn
                ? helpers.data
                  ? `${helpers.data.length} people ready to help`
                  : 'Finding people…'
                : 'Sign in to meet people who can help.'}
          </p>
          <p className="mt-4 hidden max-w-xs rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 text-sm sm:block">
            {tab === 'problems' ? 'See something you can help with? Tap it and say hello.' : 'Found someone interesting? Tap them and start a chat.'}
          </p>
        </div>
        <Mascot className="pointer-events-none absolute -bottom-10 right-2 hidden h-56 w-auto sm:block md:right-10" />
      </div>

      {/* Problems | Solvers */}
      <div role="tablist" aria-label="What to explore" className="mb-6 inline-flex rounded-full bg-surface-2 p-1.5">
        {([
          ['problems', 'Problems', problems.data?.length],
          ['solvers', 'Solvers', signedIn ? helpers.data?.length : undefined],
        ] as const).map(([id, label, n]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-full px-6 text-sm font-bold transition ${tab === id ? 'bg-fg text-bg shadow-card' : 'text-muted hover:text-fg'}`}
          >
            {label}
            {n !== undefined && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${tab === id ? 'bg-accent text-black' : 'bg-surface'}`}>{n}</span>}
          </button>
        ))}
      </div>

      {!locked && (
        <>
          {/* search, sort, saved, surprise */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[14rem] max-w-xl flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <label htmlFor="explore-search" className="sr-only">Search</label>
              <input
                id="explore-search"
                ref={searchRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={tab === 'problems' ? 'Search problems, e.g. stories for kids' : 'Search people, e.g. grandmother'}
                className="min-h-12 w-full rounded-2xl bg-surface-2 pl-11 pr-20 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-fg"
              />
              {input ? (
                <button onClick={() => setInput('')} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full hover:bg-surface">
                  <X size={16} aria-hidden />
                </button>
              ) : (
                <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-surface px-2 py-0.5 text-xs text-muted sm:block">/</kbd>
              )}
            </div>
            <Button variant="secondary" onClick={surprise} disabled={visibleAll.length === 0}>
              <Dices size={16} aria-hidden /> Surprise me
            </Button>
            <button
              onClick={() => setSavedOnly((s) => !s)}
              aria-pressed={savedOnly}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${savedOnly ? 'bg-fg text-bg' : 'border border-line bg-surface shadow-card'}`}
            >
              <Bookmark size={16} fill={savedOnly ? 'currentColor' : 'none'} aria-hidden /> Saved {savedCount > 0 && `(${savedCount})`}
            </button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Sort">
            {sorts.filter((s) => s.show).map((s) => {
              const disabled = !!s.needsAccount && !signedIn
              return (
                <button
                  key={s.id}
                  disabled={disabled}
                  onClick={() => setSort(s.id)}
                  aria-pressed={sort === s.id}
                  title={disabled ? 'Sign in to use this' : undefined}
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold transition disabled:opacity-40 ${sort === s.id ? 'bg-accent text-black' : 'bg-surface-2 hover:bg-accent-soft'}`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>

          {topics.length > 0 && (
            <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Popular topics">
              <span className="flex shrink-0 items-center text-xs font-semibold text-muted">Popular now</span>
              {topics.map((t) => (
                <button
                  key={t}
                  onClick={() => setInput(t === input ? '' : t)}
                  aria-pressed={input === t}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition hover:-translate-y-0.5 ${input === t ? 'border-fg bg-fg text-bg' : 'border-line bg-surface'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* content */}
      {locked ? (
        <div className="rounded-[2rem] bg-surface-2 p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-fg text-accent"><Lock size={24} aria-hidden /></div>
          <h2 className="text-2xl font-bold">Meet the people who can help</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted">Sign in to browse solvers and start a chat with anyone who fits.</p>
          <div className="mt-6 flex justify-center gap-2">
            <ButtonLink to="/sign-in" state={{ from: '/app/explore?tab=solvers' }}>Sign in</ButtonLink>
            <ButtonLink to="/sign-up" state={{ from: '/app/explore?tab=solvers' }} variant="secondary">Create account</ButtonLink>
          </div>
        </div>
      ) : active.loading ? (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading">
          {Array.from({ length: 6 }).map((_, i) => <li key={i}><Skeleton className="h-52 !rounded-[1.75rem]" /></li>)}
        </ul>
      ) : active.error ? (
        <ErrorState message={active.error} onRetry={active.reload} />
      ) : visibleAll.length === 0 ? (
        <div className="rounded-[2rem] bg-surface-2 p-10 text-center">
          <Mascot className="mx-auto h-36 w-auto" />
          <h2 className="mt-2 text-xl font-bold">{savedOnly ? 'Nothing saved yet' : term ? `Nothing matches “${term}”` : 'Nothing here yet'}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            {savedOnly ? 'Tap the bookmark on anything you like to keep it here.' : term ? 'Try fewer or different words.' : 'Check back soon, or tell Pip what you need.'}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            {(term || savedOnly) && <Button variant="secondary" onClick={() => { setInput(''); setSavedOnly(false) }}>Clear filters</Button>}
            {signedIn && <ButtonLink to="/app/ask">Tell Pip</ButtonLink>}
          </div>
        </div>
      ) : (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((item, i) => (
              <CardFor
                key={item.key}
                item={item}
                index={i}
                saved={saved.has(item.key)}
                onToggleSave={() => toggle(item.key)}
                onOpen={() => open(item.key)}
                searching={!!term}
              />
            ))}
          </ul>
          {shown.length < visibleAll.length && (
            <div className="mt-8 text-center">
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>Show more ({visibleAll.length - shown.length} left)</Button>
            </div>
          )}
          {shown.length >= visibleAll.length && visibleAll.length > 3 && (
            <p className="mt-8 text-center text-sm text-muted">You have seen everything. Try “Surprise me”, or search for something new.</p>
          )}
        </>
      )}

      {openIndex >= 0 && (
        <ExploreSheet items={visibleAll} index={openIndex} onIndex={go} onClose={close} saved={saved} onToggleSave={toggle} />
      )}
    </div>
  )
}

export type { ProblemItem }
