import { BellRing, Bookmark, MapPin, Sparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { timeAgo, availabilityLabel, initials } from '../lib/format'
import type { ExploreItem, HelperItem, ProblemItem } from '../lib/explore'
import { Chip } from './ui'
import { VerificationBadge } from './Safety'

const DAY = 864e5
const isNew = (iso: string | null) => !!iso && Date.now() - new Date(iso).getTime() < DAY

function SaveButton({ saved, onToggle, label }: { saved: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${label} from saved` : `Save ${label}`}
      className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2"
    >
      <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-fg' : 'text-muted'} aria-hidden />
    </button>
  )
}

function HitChips({ hits, label }: { hits: string[]; label: string }) {
  if (hits.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      {hits.slice(0, 4).map((h) => (
        <span key={h} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-black">
          {h}
        </span>
      ))}
    </div>
  )
}

function Shell({ index, onOpen, openLabel, children }: { index: number; onOpen: () => void; openLabel: string; children: React.ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reduced ? 0 : Math.min(index, 9) * 0.04 }}
      className="relative"
    >
      <article className="group relative flex h-full flex-col gap-3 rounded-[1.75rem] bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-1.5 hover:shadow-float">
        <button onClick={onOpen} aria-label={openLabel} className="absolute inset-0 z-0 rounded-[1.75rem]" />
        {children}
      </article>
    </motion.li>
  )
}

export function ProblemCard({ item, index, saved, onToggleSave, onOpen }: { item: ProblemItem; index: number; saved: boolean; onToggleSave: () => void; onOpen: () => void }) {
  return (
    <Shell index={index} onOpen={onOpen} openLabel={`Open: ${item.title}`}>
      <div className="pointer-events-none flex flex-wrap items-center gap-2">
        {isNew(item.created_at) && <Chip tone="success" icon={Sparkles}>New</Chip>}
        {item.waiting ? <Chip tone="info" icon={BellRing}>Waiting for a helper</Chip> : item.offers > 0 && <Chip tone="neutral">{item.offers} offered</Chip>}
        {item.fits && <Chip tone="warning">Fits you</Chip>}
        <span className="pointer-events-auto ml-auto -mr-2 -mt-2"><SaveButton saved={saved} onToggle={onToggleSave} label={item.title} /></span>
      </div>
      <h2 className="pointer-events-none line-clamp-2 text-lg font-bold leading-snug">{item.title}</h2>
      <p className="pointer-events-none line-clamp-3 text-sm text-muted">{item.summary}</p>
      <div className="pointer-events-none"><HitChips hits={item.hits} label={item.fits ? 'Fits you:' : 'Mentions:'} /></div>
      <div className="pointer-events-none mt-auto flex items-center gap-3 pt-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden /> {item.city ?? (item.remote_ok ? 'Remote OK' : 'Location not set')}</span>
        <span>{timeAgo(item.created_at)}</span>
        <span className="ml-auto font-bold text-fg opacity-0 transition group-hover:opacity-100">Open →</span>
      </div>
    </Shell>
  )
}

export function HelperCard({ item, index, saved, onToggleSave, onOpen, searching }: { item: HelperItem; index: number; saved: boolean; onToggleSave: () => void; onOpen: () => void; searching: boolean }) {
  return (
    <Shell index={index} onOpen={onOpen} openLabel={`Open ${item.display_name}`}>
      <div className="pointer-events-none flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-black" aria-hidden>
          {initials(item.display_name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold leading-tight">{item.display_name}</h2>
          {item.headline && <p className="line-clamp-2 text-sm text-muted">{item.headline}</p>}
        </div>
        <span className="pointer-events-auto -mr-2 -mt-2"><SaveButton saved={saved} onToggle={onToggleSave} label={item.display_name} /></span>
      </div>
      <p className="pointer-events-none line-clamp-3 text-sm">{item.about}</p>
      <div className="pointer-events-none"><HitChips hits={item.hits} label={searching ? 'Mentions:' : 'Fits what you asked:'} /></div>
      <div className="pointer-events-none mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-muted">
        {isNew(item.updated_at) && <Chip tone="success" icon={Sparkles}>New</Chip>}
        {item.fits && <Chip tone="warning">Fits you</Chip>}
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${item.availability_status === 'open' ? 'bg-accent' : 'bg-muted'}`} aria-hidden />
          {availabilityLabel[item.availability_status]}
        </span>
        {item.city && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden /> {item.city}</span>}
        <VerificationBadge level={item.verification} />
        {item.is_demo && <Chip tone="neutral">Demo</Chip>}
      </div>
    </Shell>
  )
}

export function CardFor(props: { item: ExploreItem; index: number; saved: boolean; onToggleSave: () => void; onOpen: () => void; searching: boolean }) {
  return props.item.type === 'problem' ? (
    <ProblemCard item={props.item} index={props.index} saved={props.saved} onToggleSave={props.onToggleSave} onOpen={props.onOpen} />
  ) : (
    <HelperCard item={props.item} index={props.index} saved={props.saved} onToggleSave={props.onToggleSave} onOpen={props.onOpen} searching={props.searching} />
  )
}
