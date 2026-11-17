import { useMemo, useState } from 'react'
import { Check, ChevronDown, MapPin, Search } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { availabilityLabel } from '../lib/format'
import type { DeckItem } from './MatchDeck'
import { Avatar, Chip } from './ui'
import { MediaGallery } from './MediaParts'
import { VerificationBadge } from './Safety'
import { Facts } from './Facts'
import { parseFacts } from '../lib/facts'

type Sort = 'best' | 'price' | 'speed' | 'fit' | 'available' | 'name'

/**
 * Everyone who matched, as a list you can search, filter and sort, then choose from.
 * It sits under the swipe cards so you can compare instead of going one by one.
 */
export function MatchList({ items, onChoose, needText }: { items: DeckItem[]; onChoose: (item: DeckItem) => Promise<boolean>; needText?: string }) {
  const { profile } = useAuth()
  const myCity = profile?.city?.trim().toLowerCase() || null
  const [term, setTerm] = useState('')
  const [sort, setSort] = useState<Sort>('best')
  const [open, setOpen] = useState(false) // available now
  const [verified, setVerified] = useState(false)
  const [near, setNear] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const shown = useMemo(() => {
    const t = term.trim().toLowerCase()
    let list = items.filter((i) => {
      const p = i.person
      if (open && p.availability_status !== 'open') return false
      if (verified && (!p.verification || p.verification === 'none')) return false
      if (near && myCity && (p.city ?? '').trim().toLowerCase() !== myCity) return false
      if (t && !(p.display_name + ' ' + (p.headline ?? '') + ' ' + (p.offer_text ?? '') + ' ' + i.hits.join(' ')).toLowerCase().includes(t)) return false
      return true
    })
    const f = (i: DeckItem) => parseFacts(i.person.offer_text || i.person.offer_summary)
    if (sort === 'price') list = [...list].sort((a, b) => (f(a).price?.amount ?? Infinity) - (f(b).price?.amount ?? Infinity))
    if (sort === 'speed') list = [...list].sort((a, b) => {
      const per = (i: DeckItem) => { const s = f(i).speed; return s ? (s.period === 'hour' ? s.amount * 8 : s.amount) : -1 }
      return per(b) - per(a)
    })
    if (sort === 'available') list = [...list].sort((a, b) => Number(b.person.availability_status === 'open') - Number(a.person.availability_status === 'open'))
    if (sort === 'name') list = [...list].sort((a, b) => a.person.display_name.localeCompare(b.person.display_name))
    return list
  }, [items, term, sort, open, verified, near, myCity])

  async function choose(i: DeckItem) {
    if (armed !== i.matchId) {
      setArmed(i.matchId)
      setTimeout(() => setArmed((a) => (a === i.matchId ? null : a)), 4000)
      return
    }
    setBusy(i.matchId)
    await onChoose(i)
    setBusy(null)
    setArmed(null)
  }

  if (items.length === 0) return null
  const hasPrice = items.some((i) => parseFacts(i.person.offer_text || i.person.offer_summary).price)
  const hasSpeed = items.some((i) => parseFacts(i.person.offer_text || i.person.offer_summary).speed)

  const toggle = (on: boolean, set: (v: boolean) => void, label: string) => (
    <button onClick={() => set(!on)} aria-pressed={on} className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${on ? 'bg-accent text-black' : 'bg-surface-2 hover:bg-accent-soft'}`}>
      {label}
    </button>
  )

  return (
    <section className="mx-auto mt-12 max-w-3xl" aria-label="All matches as a list">
      <h2 className="text-xl font-bold">Compare everyone</h2>
      <p className="mt-1 text-sm text-muted">Search the people who match, filter, and choose the one you like.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="matchlist-search" className="sr-only">Search the matches</label>
          <input id="matchlist-search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by name or words in their profile" className="min-h-11 w-full rounded-2xl bg-surface-2 pl-10 pr-4 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-fg" />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-h-11 rounded-2xl bg-surface-2 px-3 text-sm">
            <option value="best">Best match</option>
            {hasPrice && <option value="price">Lowest price</option>}
            {hasSpeed && <option value="speed">Fastest</option>}
            <option value="available">Available first</option>
            <option value="name">Name A to Z</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filters">
        {toggle(open, setOpen, 'Available now')}
        {toggle(verified, setVerified, 'Verified')}
        {myCity && toggle(near, setNear, `In ${profile?.city}`)}
      </div>
      <p className="mt-3 text-xs text-muted" aria-live="polite">Showing {shown.length} of {items.length}</p>

      <ul className="mt-3 space-y-3">
        {shown.map((i) => {
          const p = i.person
          const isOpen = expanded === i.matchId
          return (
            <li key={i.matchId} className="rounded-3xl bg-surface p-4 shadow-card">
              <div className="flex items-start gap-3">
                <Avatar name={p.display_name} src={p.avatar_url} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">{p.display_name}</p>
                  {p.headline && <p className="line-clamp-2 text-sm text-muted">{p.headline}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${p.availability_status === 'open' ? 'bg-accent' : 'bg-muted'}`} aria-hidden />{availabilityLabel[p.availability_status]}</span>
                    {p.city && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden /> {p.city}</span>}
                    <VerificationBadge level={p.verification} />
                    {p.is_demo && <Chip tone="neutral">Demo</Chip>}
                  </div>
                  <div className="mt-2"><Facts text={p.offer_text || p.offer_summary} need={needText} /></div>
                  {i.media && i.media.length > 0 && <div className="mt-2"><MediaGallery items={i.media.slice(0, 4)} size="sm" /></div>}
                  {i.hits.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-muted">You both mention:</span>
                      {i.hits.map((h) => <span key={h} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-black">{h}</span>)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => choose(i)}
                  disabled={busy === i.matchId}
                  className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold transition ${armed === i.matchId ? 'bg-accent text-black' : 'bg-fg text-bg hover:opacity-85'}`}
                >
                  {busy === i.matchId ? 'Sending…' : armed === i.matchId ? <span className="inline-flex items-center gap-1"><Check size={14} aria-hidden /> Tap to confirm</span> : 'Choose'}
                </button>
              </div>
              {(p.offer_text || p.offer_summary) && (
                <>
                  <button onClick={() => setExpanded(isOpen ? null : i.matchId)} aria-expanded={isOpen} className="mt-3 inline-flex items-center gap-1 text-xs font-bold underline">
                    {isOpen ? 'Hide profile' : 'Read their profile'} <ChevronDown size={14} className={isOpen ? 'rotate-180' : ''} aria-hidden />
                  </button>
                  {isOpen && <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-surface-2 p-3 text-sm leading-relaxed">{p.offer_text ?? p.offer_summary}</p>}
                </>
              )}
            </li>
          )
        })}
      </ul>
      {shown.length === 0 && <p className="mt-4 rounded-2xl bg-surface-2 p-4 text-center text-sm">No one matches those filters. Clear a filter to see everyone.</p>}
    </section>
  )
}
