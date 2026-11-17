import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Check, MapPin, Search, Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { AiLimit, AiUnavailable, askAssistant, understand, type ChatMsg } from '../lib/ai'
import { errorMessage, unwrap } from '../lib/data'
import { availabilityLabel } from '../lib/format'
import { loadHelpers, type HelperItem } from '../lib/explore'
import { continueAsGuest, GUEST_MESSAGE } from '../lib/guest'
import { answerLocal, looksLikeNeed } from '../lib/knowledge'
import { BotHead } from './Mascot'
import { Facts } from './Facts'
import { MicButton } from './MicButton'
import { Avatar, Button } from './ui'

const BUBBLE_KEY = 'solvia_bubble_seen'

type Chip = { label: string; text?: string; action?: 'save' | 'guest' }
type Msg =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'bot'; text: string; chips?: Chip[]; helpers?: { need: string; items: HelperItem[] } }

let nextId = 1
const STARTERS: Chip[] = [
  { label: 'How does RePair work?', text: 'How does RePair work?' },
  { label: 'How do I find someone?', text: 'How do I find someone?' },
  { label: 'I can help. How do I start?', text: 'I can help others. How do I start?' },
  { label: 'Is my information private?', text: 'Is my information private?' },
]

/** A list of real helpers inside the chat: search them, filter, and pick one. Nothing here leaves the chat. */
function HelperPick({ need, items, onSent }: { need: string; items: HelperItem[]; onSent: (name: string, ok: boolean, note?: string) => void }) {
  const [term, setTerm] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [sort, setSort] = useState<'best' | 'open' | 'az'>('best')
  const [armed, setArmed] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())

  const shown = useMemo(() => {
    const t = term.trim().toLowerCase()
    let list = items.filter((h) => (!onlyOpen || h.availability_status === 'open') && (!t || (h.display_name + ' ' + (h.headline ?? '') + ' ' + h.about).toLowerCase().includes(t)))
    if (sort === 'az') list = [...list].sort((a, b) => a.display_name.localeCompare(b.display_name))
    if (sort === 'open') list = [...list].sort((a, b) => Number(b.availability_status === 'open') - Number(a.availability_status === 'open'))
    return list
  }, [items, term, onlyOpen, sort])

  async function send(h: HelperItem) {
    if (armed !== h.id) {
      setArmed(h.id)
      setTimeout(() => setArmed((a) => (a === h.id ? null : a)), 4000)
      return
    }
    setBusy(h.id)
    try {
      unwrap(await supabase.rpc('contact_helper', { p_helper: h.id, p_message: need.slice(0, 480) }))
      setDone((d) => new Set(d).add(h.id))
      onSent(h.display_name, true)
    } catch (e) {
      const m = errorMessage(e)
      onSent(h.display_name, false, m === 'This already exists.' ? 'You already messaged them about this.' : m)
    } finally {
      setBusy(null)
      setArmed(null)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3">
        <Search size={14} className="text-muted" aria-hidden />
        <label htmlFor="pick-search" className="sr-only">Search these people</label>
        <input id="pick-search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search these people…" className="min-h-9 min-w-0 flex-1 bg-transparent text-xs outline-none" />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sort and filter">
        {([['best', 'Best match'], ['open', 'Available first'], ['az', 'A to Z']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setSort(id)} aria-pressed={sort === id} className={`rounded-full px-3 py-1 text-xs font-semibold ${sort === id ? 'bg-fg text-bg' : 'bg-surface-2'}`}>{label}</button>
        ))}
        <button onClick={() => setOnlyOpen((o) => !o)} aria-pressed={onlyOpen} className={`rounded-full px-3 py-1 text-xs font-semibold ${onlyOpen ? 'bg-accent text-black' : 'bg-surface-2'}`}>Available now</button>
      </div>
      {shown.length === 0 && <p className="text-xs text-muted">No one matches that filter.</p>}
      <ul className="space-y-2">
        {shown.map((h) => (
          <li key={h.id} className="rounded-2xl border border-line bg-surface p-3">
            <div className="flex items-start gap-2.5">
              <Avatar name={h.display_name} src={h.avatar_url} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{h.display_name}</p>
                {h.headline && <p className="line-clamp-2 text-xs text-muted">{h.headline}</p>}
              </div>
            </div>
            <div className="mt-2"><Facts text={h.about} need={need} /></div>
            {h.hits.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="text-[11px] font-semibold text-muted">Matches:</span>
                {h.hits.slice(0, 4).map((w) => <span key={w} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-black">{w}</span>)}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${h.availability_status === 'open' ? 'bg-accent' : 'bg-muted'}`} aria-hidden />{availabilityLabel[h.availability_status]}</span>
              {h.city && <span className="inline-flex items-center gap-1"><MapPin size={10} aria-hidden />{h.city}</span>}
              <span className="ml-auto">
                {done.has(h.id) ? (
                  <span className="inline-flex items-center gap-1 font-bold text-fg"><Check size={12} aria-hidden /> Sent</span>
                ) : (
                  <button onClick={() => send(h)} disabled={busy === h.id} className={`min-h-8 rounded-xl px-3 text-xs font-bold ${armed === h.id ? 'bg-accent text-black' : 'bg-fg text-bg'}`}>
                    {busy === h.id ? 'Sending…' : armed === h.id ? 'Tap again to send' : 'Message'}
                  </button>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Floating helper at the bottom right. It always answers, and everything happens inside the chat. */
export function Assistant({ raised = false }: { raised?: boolean }) {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [bubble, setBubble] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: nextId++, role: 'bot', text: 'Hi, I’m Pip! Tell me what you need and I’ll list people who can help. Or ask me anything about RePair.', chips: STARTERS },
  ])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  const lastNeed = useRef('')

  useEffect(() => {
    const openIt = () => {
      setBubble(false)
      setOpen(true)
    }
    window.addEventListener('repair:open-assistant', openIt)
    return () => window.removeEventListener('repair:open-assistant', openIt)
  }, [])

  useEffect(() => {
    let seen = false
    try {
      seen = sessionStorage.getItem(BUBBLE_KEY) === '1'
    } catch {
      /* ignore */
    }
    if (seen) return
    const t = setTimeout(() => setBubble(true), 3500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs.length, busy])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  function dismissBubble() {
    setBubble(false)
    try {
      sessionStorage.setItem(BUBBLE_KEY, '1')
    } catch {
      /* ignore */
    }
  }
  function close() {
    setOpen(false)
    launcher.current?.focus()
  }
  const addBot = (m: Omit<Extract<Msg, { role: 'bot' }>, 'id' | 'role'>) => setMsgs((l) => [...l, { id: nextId++, role: 'bot', ...m }])

  /** Look for real people for what was said, and list them in the chat. */
  async function findPeople(need: string) {
    lastNeed.current = need
    try {
      const items = (await loadHelpers(need, 'new')).slice(0, 8)
      if (items.length > 0) {
        addBot({
          text: `I found ${items.length} ${items.length === 1 ? 'person' : 'people'} who could help. Search them, filter, then tap Message on the one you like.`,
          helpers: { need, items },
          chips: [{ label: 'Nobody looks right. Save my problem', action: 'save' }],
        })
      } else {
        addBot({
          text: 'Nobody fits yet. I can save this as a problem, and I’ll notify you the moment someone matches.',
          chips: [{ label: 'Save it and notify me', action: 'save' }],
        })
      }
    } catch {
      addBot({ text: 'I couldn’t search just now. Open Explore in the menu and try the Solvers tab, or ask me again in a moment.' })
    }
  }

  async function saveProblem() {
    const need = lastNeed.current
    if (!need) return addBot({ text: 'Tell me what you need first, and I’ll save it.' })
    try {
      const u = await understand('problem', need)
      const res = unwrap(await supabase.rpc('submit_problem', { p_text: need, p_title: u.title, p_summary: u.summary, p_keywords: u.keywords, p_public: true })) as { matches: number }
      addBot({ text: res.matches > 0 ? `Saved. ${res.matches} possible ${res.matches === 1 ? 'match is' : 'matches are'} waiting in Ask Pip.` : 'Saved. I’ll notify you when someone matches.' })
    } catch (e) {
      addBot({ text: errorMessage(e) })
    }
  }

  async function ask(raw: string) {
    const q = raw.trim()
    if (!q || busy) return
    setMsgs((l) => [...l, { id: nextId++, role: 'user', text: q.slice(0, 1000) }])
    setText('')
    setBusy(true)
    try {
      if (looksLikeNeed(q)) {
        if (!session) {
          lastNeed.current = q
          addBot({ text: 'I can list people for that. Sign in first, or try RePair as a guest, and I’ll search right away.', chips: [{ label: 'Continue as guest', action: 'guest' }] })
          return
        }
        await findPeople(q)
        return
      }
      const local = answerLocal(q)
      if (local) {
        addBot({ text: local.text, chips: local.next.map((n) => ({ label: n, text: n })) })
        return
      }
      // not about RePair itself: try the AI, and never leave the person without an answer
      if (session) {
        try {
          const history: ChatMsg[] = [...msgs.filter((m) => m.role === 'user' || m.text).slice(-8).map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: m.text.slice(0, 900) })), { role: 'user', content: q }]
          addBot({ text: await askAssistant(history) })
          return
        } catch (e) {
          if (e instanceof AiLimit) return addBot({ text: 'You have asked a lot just now. Please try again in a little while.' })
          if (!(e instanceof AiUnavailable)) throw e
        }
      }
      addBot({
        text: 'I’m not sure about that one. I can tell you how RePair works, or if you tell me what you need (like “I need someone to fix my fan”), I’ll list people who can help.',
        chips: STARTERS.slice(0, 3),
      })
    } catch {
      addBot({ text: 'Something went wrong on my side. Please ask again.' })
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  async function runChip(c: Chip) {
    if (c.action === 'save') {
      setBusy(true)
      await saveProblem()
      setBusy(false)
    } else if (c.action === 'guest') {
      setBusy(true)
      const r = await continueAsGuest()
      if (r === 'ok') {
        addBot({ text: 'You are in as a guest. Searching…' })
        await findPeople(lastNeed.current)
      } else addBot({ text: GUEST_MESSAGE[r] })
      setBusy(false)
    } else if (c.text) {
      void ask(c.text)
    }
  }

  function submit(e?: FormEvent) {
    e?.preventDefault()
    void ask(text)
  }

  return (
    <div className={`fixed right-4 z-40 md:bottom-6 md:right-6 ${raised ? 'bottom-24' : 'bottom-4'}`}>
      {open && (
        <section
          aria-label="Pip, the RePair assistant"
          className="absolute bottom-20 right-0 flex max-h-[78vh] w-[min(25rem,calc(100vw-2rem))] animate-[pop-in_0.18s_ease-out] flex-col overflow-hidden rounded-3xl bg-surface shadow-float"
        >
          <header className="flex items-center gap-3 bg-fg p-4 text-bg">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white"><BotHead size={30} /></span>
            <div className="flex-1">
              <p className="text-sm font-bold">Pip, your RePair helper</p>
              <p className="text-xs opacity-70">Ask anything, or say what you need</p>
            </div>
            <button aria-label="Close assistant" onClick={close} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10">
              <X size={18} aria-hidden />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {msgs.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-fg px-3.5 py-2.5 text-sm text-bg">{m.text}</p>
                </div>
              ) : (
                <div key={m.id} className="space-y-2">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-sm">
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.helpers && (
                      <HelperPick
                        need={m.helpers.need}
                        items={m.helpers.items}
                        onSent={(name, ok, note) =>
                          addBot({ text: ok ? `Sent to ${name}. I’ll notify you when they reply. You can ask me anything else.` : note || 'Couldn’t send that. Please try again.' })
                        }
                      />
                    )}
                  </div>
                  {m.chips && m.chips.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {m.chips.map((c) => (
                        <button key={c.label} onClick={() => runChip(c)} disabled={busy} className="min-h-9 rounded-full border border-line px-3.5 text-left text-xs font-semibold hover:bg-accent-soft disabled:opacity-50">
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {busy && <p className="text-xs text-muted">Pip is thinking…</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={submit} className="flex items-center gap-1.5 border-t border-line p-3">
            <label htmlFor="assistant-input" className="sr-only">Ask Pip</label>
            <input
              id="assistant-input"
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              autoComplete="off"
              placeholder="Ask, or say what you need…"
              className="min-h-11 min-w-0 flex-1 rounded-2xl bg-surface-2 px-4 text-sm placeholder:text-muted"
            />
            <MicButton onText={(t) => setText((v) => (v.trim() ? v.trim() + ' ' + t : t))} />
            <Button type="submit" disabled={!text.trim() || busy} aria-label="Send" className="!px-3.5">
              <Send size={16} aria-hidden />
            </Button>
          </form>
        </section>
      )}

      {bubble && !open && (
        <div className="absolute bottom-20 right-0 w-56 animate-[pop-in_0.25s_ease-out] rounded-3xl rounded-br-md bg-surface p-4 pr-9 text-sm shadow-float">
          <button onClick={() => { dismissBubble(); setOpen(true) }} className="text-left font-semibold">
            Need help or have a question?
          </button>
          <button aria-label="Dismiss" onClick={dismissBubble} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-2">
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      <button
        ref={launcher}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        aria-expanded={open}
        onClick={() => (open ? close() : (dismissBubble(), setOpen(true)))}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-fg shadow-float transition-transform hover:scale-105"
      >
        {open ? <X size={22} className="text-bg" aria-hidden /> : <BotHead size={44} />}
      </button>
    </div>
  )
}
