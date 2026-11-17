import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { BellRing, Bookmark, CheckCheck, ChevronLeft, ChevronRight, MapPin, Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errorMessage, unwrap } from '../lib/data'
import { availabilityLabel, initials, timeAgo } from '../lib/format'
import type { ExploreItem } from '../lib/explore'
import { BotHead } from './Mascot'
import { MicButton } from './MicButton'
import { Button, ButtonLink, Chip } from './ui'
import { ReportButton, VerificationBadge } from './Safety'
import { continueAsGuest, GUEST_MESSAGE } from '../lib/guest'

const QUICK: Record<ExploreItem['type'], string[]> = {
  problem: ['I think I can help with this.', 'I have done something like this before.', 'Can you tell me a bit more?'],
  helper: ['Hi! Are you free this week?', 'I need help with something. Can I tell you more?', 'Your profile sounds perfect for what I need.'],
}

/** The "chat" for one thing on Explore. Sending it opens a request; once accepted, you chat freely. */
function ChatPanel({ item }: { item: ExploreItem }) {
  const { session, profile } = useAuth()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<{ text: string } | null>(null)
  const [note, setNote] = useState('')
  const [guestBusy, setGuestBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const name = item.type === 'helper' ? item.display_name.split(' ')[0] : 'them'
  const switchesOn = item.type === 'problem' && profile?.intent === 'seeker'

  // a new item, a new conversation
  useEffect(() => {
    setText('')
    setSent(null)
    setNote('')
  }, [item.key])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [sent, note])

  async function send() {
    const t = text.trim()
    if (t.length < 3) return setNote('Write a short message first.')
    setBusy(true)
    setNote('')
    try {
      if (item.type === 'problem') unwrap(await supabase.rpc('offer_help', { p_case: item.id, p_message: t }))
      else unwrap(await supabase.rpc('contact_helper', { p_helper: item.id, p_message: t }))
      setSent({ text: t })
      setText('')
    } catch (e) {
      const m = errorMessage(e)
      setNote(m === 'This already exists.' ? 'You already sent a message here. Check My requests.' : m)
    } finally {
      setBusy(false)
    }
  }

  if (!session) {
    return (
      <div className="border-t border-line bg-surface-2 p-5 text-center">
        <p className="mb-3 text-sm font-semibold">{item.type === 'problem' ? 'Sign in to offer your help.' : 'Sign in to say hello.'}</p>
        <div className="flex justify-center gap-2">
          <ButtonLink to="/sign-in" state={{ from: '/app/explore' }}>Sign in</ButtonLink>
          <ButtonLink to="/sign-up" state={{ from: '/app/explore' }} variant="secondary">Create account</ButtonLink>
        </div>
        <button
          disabled={guestBusy}
          onClick={async () => {
            setGuestBusy(true)
            const r = await continueAsGuest()
            setGuestBusy(false)
            if (r !== 'ok') setNote(GUEST_MESSAGE[r])
          }}
          className="mt-3 text-sm font-semibold underline"
        >
          {guestBusy ? 'One moment…' : 'Or continue as a guest'}
        </button>
        {note && <p className="mt-2 text-xs font-semibold">{note}</p>}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col border-t border-line bg-surface-2">
      <div className="max-h-64 space-y-3 overflow-y-auto p-4" aria-live="polite">
        <div className="flex items-end gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white"><BotHead size={24} /></span>
          <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-4 py-2.5 text-sm shadow-card">
            {item.type === 'problem'
              ? 'Think you can help? Say hello. I’ll send it as your offer.'
              : `Say hello to ${name}. Tell ${name} what you need.`}
          </p>
        </div>
        {sent && (
          <>
            <div className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-fg px-4 py-2.5 text-sm text-bg">{sent.text}</p></div>
            <div className="flex items-end gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white"><BotHead size={24} /></span>
              <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-md bg-surface px-4 py-2.5 text-sm shadow-card">
                <p className="flex items-center gap-1.5 font-semibold"><CheckCheck size={16} aria-hidden /> Sent{item.type === 'helper' ? ` to ${name}` : ''}.</p>
                <p className="text-muted">
                  {item.type === 'problem' ? 'They will see your offer.' : `${name} will see your message.`} When they accept, you can chat freely. I’ll notify you.
                </p>
                <Link to="/app/connections" className="inline-block font-semibold underline">See my requests</Link>
              </div>
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>

      {!sent && (
        <div className="space-y-3 border-t border-line bg-surface p-4">
          <div className="flex flex-wrap gap-2">
            {QUICK[item.type].map((q) => (
              <button key={q} onClick={() => setText(q)} className="rounded-full border border-line px-3 py-1.5 text-left text-xs font-semibold transition hover:bg-accent-soft">
                {q}
              </button>
            ))}
          </div>
          {switchesOn && (
            <p className="rounded-2xl bg-accent-soft px-3 py-2 text-xs">Offering help switches on helping for you. You can change it any time in Settings.</p>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="sheet-msg" className="sr-only">Your message</label>
            <textarea
              id="sheet-msg"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={2}
              maxLength={500}
              placeholder="Type your message…"
              className="min-h-12 flex-1 resize-none rounded-2xl bg-surface-2 px-4 py-3 text-sm placeholder:text-muted focus:outline-none"
            />
            <MicButton onText={(t) => setText((v) => (v.trim() ? v.trim() + ' ' + t : t))} />
            <Button loading={busy} onClick={send} aria-label="Send" className="!px-4"><Send size={16} aria-hidden /></Button>
          </div>
          {note && <p className="text-sm font-semibold">{note}</p>}
        </div>
      )}
    </div>
  )
}

export function ExploreSheet({
  items,
  index,
  onIndex,
  onClose,
  saved,
  onToggleSave,
}: {
  items: ExploreItem[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  saved: Set<string>
  onToggleSave: (key: string) => void
}) {
  const reduced = useReducedMotion()
  const item = items[index]
  const closeRef = useRef<HTMLButtonElement>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  useEffect(() => setTick((t) => t + 1), [item?.key])
  if (!item) return null
  const isSaved = saved.has(item.key)

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={item.type === 'problem' ? item.title : item.display_name}
        initial={reduced ? false : { x: '100%' }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-float sm:w-[30rem] sm:rounded-l-[2rem]"
      >
        {/* top bar: flip through */}
        <header className="flex items-center gap-1 border-b border-line px-3 py-2">
          <button onClick={() => onIndex(index - 1)} disabled={index === 0} aria-label="Previous" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30"><ChevronLeft aria-hidden /></button>
          <button onClick={() => onIndex(index + 1)} disabled={index >= items.length - 1} aria-label="Next" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30"><ChevronRight aria-hidden /></button>
          <p className="ml-1 text-xs font-semibold text-muted" aria-live="polite">{index + 1} of {items.length}</p>
          <button onClick={() => onToggleSave(item.key)} aria-pressed={isSaved} aria-label={isSaved ? 'Remove from saved' : 'Save'} className="ml-auto flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2">
            <Bookmark size={19} fill={isSaved ? 'currentColor' : 'none'} aria-hidden />
          </button>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2"><X aria-hidden /></button>
        </header>

        {/* details */}
        <motion.div key={tick} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="min-h-0 flex-1 overflow-y-auto p-6">
          {item.type === 'problem' ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {item.waiting ? <Chip tone="info" icon={BellRing}>Waiting for a helper</Chip> : <Chip tone="neutral">{item.offers} offered so far</Chip>}
                {item.fits && <Chip tone="warning">Fits you</Chip>}
              </div>
              <h2 className="text-2xl font-bold leading-snug">{item.title}</h2>
              <p className="mt-2 flex items-center gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden /> {item.city ?? (item.remote_ok ? 'Remote OK' : 'Location not set')}</span>
                <span>{timeAgo(item.created_at)}</span>
              </p>
              {item.hits.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted">{item.fits ? 'Why it fits you:' : 'Mentions:'}</span>
                  {item.hits.map((h) => <span key={h} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-black">{h}</span>)}
                </div>
              )}
              <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed">{item.description}</p>
              <p className="mt-5 rounded-2xl bg-surface-2 p-3 text-xs text-muted">The person’s name stays hidden until they accept your offer.</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-bold text-black" aria-hidden>{initials(item.display_name)}</span>
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold leading-tight">{item.display_name}</h2>
                  {item.headline && <p className="text-sm text-muted">{item.headline}</p>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${item.availability_status === 'open' ? 'bg-accent' : 'bg-muted'}`} aria-hidden />{availabilityLabel[item.availability_status]}</span>
                {item.city && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden /> {item.city}</span>}
                <VerificationBadge level={item.verification} />
                {item.is_demo && <Chip tone="neutral">Demo</Chip>}
                {item.fits && <Chip tone="warning">Fits you</Chip>}
              </div>
              {item.hits.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted">You both mention:</span>
                  {item.hits.map((h) => <span key={h} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-black">{h}</span>)}
                </div>
              )}
              <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed">{item.about}</p>
            </>
          )}
          <div className="mt-6"><ReportButton type={item.type === 'problem' ? 'case' : 'user'} id={item.id} /></div>
        </motion.div>

        <ChatPanel item={item} />
      </motion.aside>
    </div>
  )
}
