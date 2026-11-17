import { useState, type ReactNode } from 'react'
import { motion, useAnimationControls, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { Heart, MapPin, X } from 'lucide-react'
import type { PersonLite } from '../lib/types'
import { availabilityLabel, initials } from '../lib/format'
import { Chip } from './ui'
import { VerificationBadge } from './Safety'
import { Facts } from './Facts'
import { MediaGallery } from './MediaParts'
import type { MediaItem } from '../lib/media'

export interface DeckItem {
  matchId: string
  person: PersonLite
  hits: string[]
  explanation: string
  media?: MediaItem[]
}

/** The face of one person, as a seeker sees it. Also used to preview a helper's own profile. */
export function PersonCard({ person, hits, className = '', needText, media }: { person: PersonLite; hits?: string[]; className?: string; needText?: string; media?: MediaItem[] }) {
  const about = (person.offer_summary || person.offer_text || '').trim()
  return (
    <div className={`overflow-hidden rounded-[2rem] bg-surface shadow-float ${className}`}>
      {person.avatar_url ? (
        <div className="relative h-80 bg-fg">
          <img src={person.avatar_url} alt={`Photo of ${person.display_name}`} draggable={false} className="h-full w-full select-none object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-16 text-white">
            <h3 className="text-2xl font-bold leading-tight">{person.display_name}</h3>
            {person.headline && <p className="mt-0.5 line-clamp-2 text-sm text-white/80">{person.headline}</p>}
          </div>
        </div>
      ) : (
        <div className="relative flex h-44 items-end bg-fg p-5 text-bg">
          <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-accent/40 blur-3xl" aria-hidden />
          <div className="absolute left-5 top-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-bold text-black ring-4 ring-white/20" aria-hidden>
            {initials(person.display_name)}
          </div>
          <div className="relative ml-auto text-right">
            <h3 className="text-2xl font-bold leading-tight">{person.display_name}</h3>
            {person.headline && <p className="mt-0.5 max-w-[16rem] text-sm text-white/70">{person.headline}</p>}
          </div>
        </div>
      )}
      <div className="space-y-4 p-5">
        {about && <p className="line-clamp-4 text-sm leading-relaxed">{about}</p>}
        <Facts text={person.offer_text || person.offer_summary} need={needText} />
        {media && media.length > 0 && <MediaGallery items={media.slice(0, 4)} size="sm" />}
        {hits && hits.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">You both mention</p>
            <div className="flex flex-wrap gap-1.5">
              {hits.map((h) => (
                <span key={h} className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-black">
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{availabilityLabel[person.availability_status]}</span>
          {person.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} aria-hidden /> {person.city}
            </span>
          )}
          <VerificationBadge level={person.verification} />
          {person.is_demo && <Chip tone="neutral">Demo</Chip>}
        </div>
      </div>
    </div>
  )
}

/** Swipe cards. Drag right (or press the heart) to choose, drag left (or press the cross) to pass. */
export function MatchDeck({
  items,
  onDecide,
  empty,
  needText,
}: {
  items: DeckItem[]
  onDecide: (item: DeckItem, choose: boolean) => Promise<boolean>
  empty: ReactNode
  needText?: string
}) {
  const reduced = useReducedMotion()
  const controls = useAnimationControls()
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-220, 220], [-12, 12])
  const chooseOpacity = useTransform(x, [30, 140], [0, 1])
  const passOpacity = useTransform(x, [-140, -30], [1, 0])
  const [busy, setBusy] = useState(false)

  const top = items[0]
  const next = items[1]
  if (!top) return <>{empty}</>

  async function decide(choose: boolean) {
    if (busy) return
    setBusy(true)
    if (!reduced) await controls.start({ x: (choose ? 1 : -1) * 560, opacity: 0, transition: { duration: 0.25 } })
    const ok = await onDecide(top, choose)
    if (!ok) await controls.start({ x: 0, opacity: 1, transition: { duration: 0.2 } })
    x.set(0)
    controls.set({ x: 0, opacity: 1 })
    setBusy(false)
  }

  return (
    <div
      className="mx-auto w-full max-w-sm outline-none"
      tabIndex={0}
      role="group"
      aria-label={`${items.length} possible ${items.length === 1 ? 'match' : 'matches'}. Use the arrow keys: right to choose, left to pass.`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') decide(true)
        if (e.key === 'ArrowLeft') decide(false)
      }}
    >
      <div className="relative">
        {next && <PersonCard person={next.person} hits={next.hits} needText={needText} className="absolute inset-x-3 top-3 scale-[0.96] opacity-70" />}
        <motion.div
          key={top.matchId}
          drag={busy ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.8}
          style={{ x, rotate: reduced ? 0 : rotate }}
          animate={controls}
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 110 || Math.abs(info.velocity.x) > 600) decide(info.offset.x > 0)
          }}
          className="relative cursor-grab touch-pan-y active:cursor-grabbing"
        >
          <PersonCard person={top.person} hits={top.hits} needText={needText} media={top.media} />
          <motion.span style={{ opacity: chooseOpacity }} className="pointer-events-none absolute left-5 top-5 -rotate-12 rounded-xl border-4 border-accent bg-fg/80 px-3 py-1 text-xl font-bold text-accent" aria-hidden>
            CHOOSE
          </motion.span>
          <motion.span style={{ opacity: passOpacity }} className="pointer-events-none absolute right-5 top-5 rotate-12 rounded-xl border-4 border-white bg-fg/80 px-3 py-1 text-xl font-bold text-white" aria-hidden>
            PASS
          </motion.span>
        </motion.div>
      </div>

      <div className="mt-7 flex items-center justify-center gap-6">
        <button
          onClick={() => decide(false)}
          disabled={busy}
          aria-label={`Pass on ${top.person.display_name}`}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface shadow-card transition hover:scale-105 disabled:opacity-50"
        >
          <X size={28} aria-hidden />
        </button>
        <button
          onClick={() => decide(true)}
          disabled={busy}
          aria-label={`Choose ${top.person.display_name}`}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-fg text-accent shadow-float transition hover:scale-105 disabled:opacity-50"
        >
          <Heart size={32} fill="currentColor" aria-hidden />
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-muted" aria-live="polite">
        {items.length} {items.length === 1 ? 'person' : 'people'} to look at
      </p>
    </div>
  )
}
