import { useState, type FormEvent } from 'react'
import { ArrowRight, Heart, MessageCircle, Search, HandHeart, ShieldCheck, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Mascot, BotHead } from '../components/Mascot'
import { MicButton } from '../components/MicButton'
import { StoryScene } from '../components/StoryScene'
import { continueAsGuest } from '../lib/guest'
import { useAuth } from '../lib/auth'

type Path = 'seeker' | 'solver'

/**
 * One step from the landing page to the result: what the person says or types is saved,
 * a guest account is opened if guests are allowed, and the next page runs it immediately.
 * If guests are off, they sign up first and the words are kept.
 */
function useStart() {
  const { session } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState<Path | null>(null)
  const start = async (path: Path, text?: string) => {
    const t = (text ?? '').trim()
    try {
      localStorage.setItem('repair_intent', path)
      if (t) localStorage.setItem(path === 'seeker' ? 'repair_draft' : 'repair_offer_draft', t)
    } catch {
      /* ignore */
    }
    const target = path === 'seeker' ? '/app/ask' : '/app/settings'
    if (session) return nav(target)
    let off = false
    try {
      off = sessionStorage.getItem('repair_guest_off') === '1'
    } catch {
      /* ignore */
    }
    if (!off) {
      setBusy(path)
      const r = await continueAsGuest()
      setBusy(null)
      if (r === 'ok') return nav(target)
      try {
        sessionStorage.setItem('repair_guest_off', '1')
      } catch {
        /* ignore */
      }
    }
    nav('/sign-up', { state: { from: target } })
  }
  return { start, busy }
}

/** A card you can talk or type to. Say it, and it goes. */
function TalkCard({ path, start, busy }: { path: Path; start: (p: Path, text?: string) => void; busy: Path | null }) {
  const [text, setText] = useState('')
  const seeker = path === 'seeker'
  const id = 'talk-' + path
  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    start(path, text)
  }
  return (
    <form onSubmit={submit} className={`flex flex-1 flex-col rounded-[1.75rem] p-6 shadow-card ${seeker ? 'bg-fg text-bg' : 'bg-accent text-black'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-12 w-12 items-center justify-center rounded-full ${seeker ? 'bg-accent text-black' : 'bg-fg text-accent'}`}>
          {seeker ? <Search size={22} aria-hidden /> : <HandHeart size={22} aria-hidden />}
        </span>
        <h2 className="text-2xl font-bold">{seeker ? 'I need someone' : 'I can help'}</h2>
      </div>
      <label htmlFor={id} className="sr-only">{seeker ? 'Say or type what you need' : 'Say or type what you can offer'}</label>
      <div className={`mt-5 flex items-center gap-1.5 rounded-2xl p-1.5 pl-4 ${seeker ? 'bg-white/10' : 'bg-black/10'}`}>
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          autoComplete="off"
          placeholder={seeker ? 'Say or type what you need…' : 'Say or type what you can offer…'}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:opacity-60"
        />
        <MicButton
          className={seeker ? '!text-white hover:!bg-white/10' : '!text-black hover:!bg-black/10'}
          onText={(t) => {
            const v = text.trim() ? text.trim() + ' ' + t : t
            setText(v)
            setTimeout(() => start(path, v), 450) // a moment to see the words, then straight on
          }}
        />
        <button
          type="submit"
          disabled={busy === path}
          aria-label={seeker ? 'Find my match' : 'Create my profile'}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition hover:scale-105 disabled:opacity-60 ${seeker ? 'bg-accent text-black' : 'bg-fg text-accent'}`}
        >
          <ArrowRight size={20} aria-hidden />
        </button>
      </div>
      <p className={`mt-3 text-xs ${seeker ? 'text-white/60' : 'text-black/60'}`}>
        {seeker ? 'For example: a grandmother to tell my kids bedtime stories.' : 'For example: I am a grandmother who tells bedtime stories.'}
      </p>
    </form>
  )
}

function PathButton({ path, start }: { path: Path; start: (p: Path) => void }) {
  const seeker = path === 'seeker'
  return (
    <button
      onClick={() => start(path)}
      className={`inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl px-7 text-base font-bold transition hover:-translate-y-1 ${seeker ? 'bg-accent text-black' : 'border border-white/30 text-white hover:bg-white/10'}`}
    >
      {seeker ? 'I need someone' : 'I can help'} <ArrowRight size={18} aria-hidden />
    </button>
  )
}

const LANES: { title: string; dark: boolean; steps: string[] }[] = [
  { title: 'If you need someone', dark: true, steps: ['Tell Pip what you need, in your own words.', 'Swipe through the people who fit. Choose one.', 'They accept. You chat and get it done.'] },
  { title: 'If you can help', dark: false, steps: ['Tell Pip what you can offer, in your own words.', 'Get matched with people who need it, or browse problems.', 'Accept a request and help.'] },
]

export default function Home() {
  const { start, busy } = useStart()
  const { session } = useAuth()
  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-4 px-4 pb-12 pt-4 md:grid-cols-[1.05fr_1fr] md:gap-8 md:pb-20 md:pt-16">
          <div className="relative z-10">
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
              Someone out there needs{' '}
              <span className="relative inline-block">
                what you offer.
                <svg viewBox="0 0 300 16" className="absolute -bottom-2 left-0 w-full text-accent" aria-hidden preserveAspectRatio="none">
                  <path d="M3 11 Q 40 2 80 10 T 160 10 T 240 9 T 297 7" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mt-7 max-w-md text-lg text-muted">
              No forms. Say it or type it, and Pip finds the match.
            </p>
            <div className="mt-9 flex max-w-xl flex-col gap-4">
              <TalkCard path="seeker" start={start} busy={busy} />
              <TalkCard path="solver" start={start} busy={busy} />
            </div>
          </div>
          <div className="relative order-first md:order-none">
            <StoryScene className="mx-auto h-auto w-full max-w-[22rem] md:max-w-xl" />
          </div>
        </div>
      </section>

      {/* how it works: two equal lanes */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-10 text-3xl font-bold tracking-tight">How it works</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {LANES.map((l) => (
            <div key={l.title} className={`relative overflow-hidden rounded-[2rem] p-8 ${l.dark ? 'bg-fg text-bg' : 'bg-accent text-black'}`}>
              <div className={`absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl ${l.dark ? 'bg-accent/30' : 'bg-white/50'}`} aria-hidden />
              <h3 className="relative text-2xl font-bold">{l.title}</h3>
              <ol className="relative mt-6 space-y-4">
                {l.steps.map((s, i) => (
                  <li key={s} className="flex items-start gap-4">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${l.dark ? 'bg-accent text-black' : 'bg-fg text-accent'}`}>{i + 1}</span>
                    <span className="pt-1">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* example story */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid items-center gap-10 rounded-[2.5rem] bg-surface-2 p-8 md:grid-cols-2 md:p-12">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-fg px-3 py-1 text-xs font-bold text-bg">Example story</p>
            <h2 className="text-3xl font-bold tracking-tight">A grandmother with stories, and a parent who wants them.</h2>
            <p className="mt-4 text-muted">
              Leela’s grandchildren live abroad, so her bedtime stories have no audience. Neha wants a grandmother to tell stories to her kids.
              They have never met. Pip puts them together.
            </p>
            <p className="mt-3 text-xs text-muted">An example to show how it works, not real people.</p>
          </div>
          <div className="space-y-3">
            <div className="ml-auto max-w-[85%] rounded-3xl rounded-br-md bg-fg px-5 py-3 text-sm text-bg">I want a grandmother to tell bedtime stories to my kids</div>
            <div className="flex items-end gap-3">
              <Mascot className="h-20 w-auto shrink-0" />
              <div className="rounded-3xl rounded-bl-md bg-surface px-5 py-3 text-sm font-semibold shadow-card">I found 3 people who could help. Choose the one you like.</div>
            </div>
            <div className="rounded-3xl bg-surface p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent font-bold text-black">LA</span>
                <div>
                  <p className="font-bold">Leela Amma</p>
                  <p className="text-xs text-muted">Grandmother who loves telling bedtime stories</p>
                </div>
                <Heart className="ml-auto text-accent" fill="currentColor" aria-hidden />
              </div>
              <p className="mt-3 text-xs font-semibold text-muted">You both mention</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {['grandmother', 'stories', 'bedtime', 'children'].map((w) => (
                  <span key={w} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-black">{w}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* why trust it */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <ul className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Sparkles, text: 'Every match shows why. No hidden scores.' },
            { icon: ShieldCheck, text: 'Your name stays hidden until you choose someone.' },
            { icon: MessageCircle, text: 'Nobody can message you until you accept.' },
          ].map(({ icon: I, text }) => (
            <li key={text} className="flex items-start gap-4 rounded-3xl bg-surface p-6 shadow-card">
              <I className="mt-0.5 shrink-0" size={24} aria-hidden />
              <span className="font-medium">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* closing call to action */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-fg px-8 py-16 text-center text-bg">
          <div className="absolute left-1/2 top-0 h-48 w-[28rem] -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" aria-hidden />
          <BotHead size={64} className="relative mx-auto mb-4" />
          <h2 className="relative text-3xl font-bold md:text-4xl">What will you say to Pip?</h2>
          <div className="relative mx-auto mt-8 flex max-w-md flex-col gap-4 sm:flex-row">
            <PathButton path="seeker" start={start} />
            <PathButton path="solver" start={start} />
          </div>
          {session && <p className="relative mt-6 text-sm text-white/60">You are signed in. Both buttons take you straight to Pip.</p>}
        </div>
      </section>
    </>
  )
}
