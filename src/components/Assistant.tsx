import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Send, Sparkles, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { AiLimit, AiUnavailable, askAssistant, type ChatMsg } from '../lib/ai'
import { MicButton } from './MicButton'
import { Button } from './ui'

const BUBBLE_KEY = 'solvia_bubble_seen'

/** Floating helper at the bottom right. Shortcuts always work; free-text answers need the AI service. */
export function Assistant() {
  const { session } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [bubble, setBubble] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [off, setOff] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)

  // Friendly nudge once per browser session
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
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [open, msgs.length, busy])

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
  function openPanel() {
    dismissBubble()
    setOpen(true)
  }
  function close() {
    setOpen(false)
    launcher.current?.focus()
  }

  const shortcuts = session
    ? [
        { label: 'Post a problem', to: '/app/new' },
        { label: 'Find solvers', to: '/app/find' },
        { label: 'My requests', to: '/app/connections' },
        { label: 'How it works', to: '/how-it-works' },
      ]
    : [
        { label: 'How it works', to: '/how-it-works' },
        { label: 'Browse problems', to: '/explore' },
        { label: 'Create account', to: '/sign-up' },
      ]

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const q = text.trim()
    if (!q || busy) return
    const next: ChatMsg[] = [...msgs, { role: 'user', content: q.slice(0, 1000) }]
    setMsgs(next)
    setText('')
    setBusy(true)
    try {
      const reply = await askAssistant(next)
      setMsgs([...next, { role: 'assistant', content: reply }])
    } catch (err) {
      if (err instanceof AiLimit) {
        setMsgs([...next, { role: 'assistant', content: 'You have asked a lot just now. Please try again in a while.' }])
      } else if (err instanceof AiUnavailable) {
        setOff(true)
        setMsgs([...next, { role: 'assistant', content: "I can't answer questions yet because the assistant isn't switched on. The shortcuts above still work." }])
      } else {
        setMsgs([...next, { role: 'assistant', content: "Couldn't get an answer. Please try again." }])
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-24 right-4 z-40 md:bottom-6 md:right-6">
      {open && (
        <section
          aria-label="SOLVIA assistant"
          className="absolute bottom-16 right-0 flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] animate-[pop-in_0.18s_ease-out] flex-col overflow-hidden rounded-3xl bg-surface shadow-float"
        >
          <header className="flex items-center gap-3 bg-fg p-4 text-bg">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-black">
              <Sparkles size={18} aria-hidden />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold">SOLVIA assistant</p>
              <p className="text-xs opacity-70">Ask how things work</p>
            </div>
            <button aria-label="Close assistant" onClick={close} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10">
              <X size={18} aria-hidden />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            <div className="max-w-[85%] rounded-2xl bg-surface-2 px-3.5 py-2.5 text-sm">
              Hi! Need help with something? Pick a shortcut or ask me.
            </div>
            <div className="flex flex-wrap gap-2">
              {shortcuts.map((s) => (
                <button
                  key={s.to}
                  onClick={() => {
                    nav(s.to)
                    close()
                  }}
                  className="min-h-9 rounded-full border border-line px-3.5 text-xs font-semibold hover:bg-accent-soft"
                >
                  {s.label}
                </button>
              ))}
            </div>
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'bg-fg text-bg' : 'bg-surface-2'}`}>
                  {m.content}
                </p>
              </div>
            ))}
            {busy && <p className="text-xs text-muted">Thinking…</p>}
            <div ref={endRef} />
          </div>

          {session ? (
            <form onSubmit={send} className="flex items-center gap-1.5 border-t border-line p-3">
              <label htmlFor="assistant-input" className="sr-only">Ask the assistant</label>
              <input
                id="assistant-input"
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                disabled={off}
                placeholder={off ? 'Assistant is off' : 'Ask a question'}
                className="min-h-11 min-w-0 flex-1 rounded-2xl bg-surface-2 px-4 text-sm placeholder:text-muted"
              />
              <MicButton onText={(t) => setText((v) => (v ? v + ' ' + t : t))} />
              <Button type="submit" loading={busy} disabled={!text.trim() || off} aria-label="Send" className="!px-3.5">
                <Send size={16} aria-hidden />
              </Button>
            </form>
          ) : (
            <p className="border-t border-line p-4 text-center text-sm">
              <Link to="/sign-in" className="font-semibold underline">Sign in</Link> to ask questions.
            </p>
          )}
        </section>
      )}

      {bubble && !open && (
        <div className="absolute bottom-16 right-0 w-56 animate-[pop-in_0.25s_ease-out] rounded-3xl rounded-br-md bg-surface p-4 pr-9 text-sm shadow-float">
          <button onClick={openPanel} className="text-left font-semibold">
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
        onClick={() => (open ? close() : openPanel())}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-fg text-accent shadow-float transition-transform hover:scale-105"
      >
        {open ? <X size={22} aria-hidden /> : <Sparkles size={24} aria-hidden />}
      </button>
    </div>
  )
}
