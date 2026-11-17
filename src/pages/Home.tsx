import { ArrowRight, Handshake, MessageSquareText, Search, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { ButtonLink } from '../components/ui'
import { Mascot, BotHead } from '../components/Mascot'
import { useAuth } from '../lib/auth'
import { loadCategories, loadSkills, useData } from '../lib/data'

/** Kept for the composer: a saved draft is picked up on the new-problem page. */
export const DRAFT_KEY = 'solvia_draft'

const STEPS = [
  { icon: MessageSquareText, title: 'Describe', text: 'Write your problem in your own words.' },
  { icon: Search, title: 'Understand', text: 'Check the skills it needs. Edit anything.' },
  { icon: Users, title: 'Match', text: 'See people ranked, with the reason for each.' },
  { icon: Handshake, title: 'Resolve', text: 'Connect, work together, confirm it is solved.' },
]

const TILT = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2', 'rotate-1', '-rotate-2']
const STICKER = ['bg-accent text-black', 'bg-fg text-bg', 'bg-surface text-fg border border-line', 'bg-accent-soft text-fg']

function openAssistant() {
  window.dispatchEvent(new Event('repair:open-assistant'))
}

function Hero() {
  const { session } = useAuth()
  const start = session ? '/app/new' : '/sign-up'
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 pb-10 pt-10 md:grid-cols-2 md:pb-16 md:pt-16">
        <div className="relative z-10">
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Problems meet{' '}
            <span className="relative inline-block">
              solutions.
              <svg viewBox="0 0 300 16" className="absolute -bottom-2 left-0 w-full text-accent" aria-hidden preserveAspectRatio="none">
                <path d="M3 11 Q 40 2 80 10 T 160 10 T 240 9 T 297 7" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mt-7 max-w-md text-lg text-muted">
            Describe what you need. RePair helps you discover the right people, skills, and resources to move forward.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink to={start} state={{ from: '/app/new' }} className="!min-h-14 !px-7 !text-base">
              Find my solver <ArrowRight size={18} aria-hidden />
            </ButtonLink>
            <ButtonLink to={session ? '/app/explore' : '/sign-up'} variant="secondary" className="!min-h-14 !px-7 !text-base">
              I can help
            </ButtonLink>
          </div>
        </div>

        {/* the bot */}
        <div className="relative mx-auto h-[26rem] w-full max-w-md md:h-[31rem]">
          <div className="drift absolute left-6 top-10 h-24 w-24 rounded-full bg-accent" aria-hidden />
          <div className="drift absolute bottom-16 right-2 h-12 w-28 rotate-12 rounded-full bg-fg" style={{ animationDelay: '-3s' }} aria-hidden />
          <div className="absolute inset-x-6 bottom-6 top-12 rounded-[3rem] bg-accent-soft" aria-hidden />
          <Mascot className="absolute inset-x-0 bottom-0 mx-auto h-[28rem] w-auto md:h-[34rem]" />

          <div className="absolute left-0 top-0 max-w-[13rem] rounded-3xl rounded-bl-md bg-surface p-4 shadow-float">
            <p className="text-sm font-bold">Hi, I’m Pip!</p>
            <p className="text-sm text-muted">What needs fixing today?</p>
            <button
              onClick={openAssistant}
              className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-fg px-3.5 text-xs font-semibold text-bg hover:opacity-85"
            >
              <Sparkles size={14} className="text-accent" aria-hidden /> Chat with me
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function SkillBand() {
  const skills = useData(loadSkills, [])
  const names = (skills.data ?? []).map((s) => s.name)
  if (names.length === 0) return null
  const row = [...names, ...names]
  return (
    <div className="marquee overflow-hidden bg-fg py-4 text-bg" aria-label="Skills people offer on RePair" role="region">
      <div className="marquee-track flex gap-8 whitespace-nowrap text-lg font-semibold" aria-hidden>
        {row.map((n, i) => (
          <span key={i} className="flex items-center gap-8">
            {n}
            <span className="text-accent">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const cats = useData(loadCategories, [])
  const { session } = useAuth()
  return (
    <>
      <Hero />
      <SkillBand />

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="mb-10 text-3xl font-bold tracking-tight">How it works</h2>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className={`relative rounded-3xl bg-surface p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:rotate-0 ${TILT[i]}`}
            >
              <span className="absolute -top-5 right-5 text-7xl font-bold text-accent" aria-hidden>
                {i + 1}
              </span>
              <s.icon className="mb-6" size={28} aria-hidden />
              <h3 className="text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {(cats.data ?? []).length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <h2 className="mb-8 text-3xl font-bold tracking-tight">What you can solve</h2>
          <ul className="flex flex-wrap gap-3">
            {(cats.data ?? []).map((c, i) => (
              <li
                key={c.id}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold shadow-card transition hover:rotate-0 hover:scale-105 ${STICKER[i % STICKER.length]} ${TILT[i % TILT.length]}`}
              >
                {c.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-20 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-[2rem] bg-fg p-8 text-bg">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-accent/30 blur-2xl" aria-hidden />
          <h2 className="relative text-2xl font-bold">If you need help</h2>
          <p className="relative mt-2 max-w-sm text-white/70">Share the problem once. Get a ranked list of people who can help, with reasons.</p>
          <ButtonLink to={session ? '/app/new' : '/sign-up'} className="relative mt-6 !bg-accent !text-black">
            Describe a problem
          </ButtonLink>
        </div>
        <div className="relative overflow-hidden rounded-[2rem] bg-accent p-8 text-black">
          <div className="absolute -bottom-12 -left-8 h-44 w-44 rounded-full bg-white/40 blur-2xl" aria-hidden />
          <h2 className="relative text-2xl font-bold">If you can help</h2>
          <p className="relative mt-2 max-w-sm text-black/70">List your skills and availability. Respond to people who fit what you do.</p>
          <ButtonLink to="/explore" className="relative mt-6">
            Browse problems
          </ButtonLink>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="mb-8 text-3xl font-bold tracking-tight">Trust and safety</h2>
        <ul className="grid gap-4 md:grid-cols-4">
          {[
            { icon: ShieldCheck, text: 'You decide who sees your problem. It is private by default.', cls: 'md:col-span-2 bg-accent text-black' },
            { icon: Sparkles, text: 'Every match shows why. Missing information is shown as not provided.', cls: 'bg-surface shadow-card' },
            { icon: Users, text: 'No fake ratings. Reliability appears only after real, confirmed cases.', cls: 'bg-surface shadow-card' },
            { icon: Handshake, text: 'Nobody can message you until you accept the request.', cls: 'md:col-span-4 bg-fg text-bg' },
          ].map(({ icon: I, text, cls }) => (
            <li key={text} className={`flex items-start gap-4 rounded-3xl p-6 ${cls}`}>
              <I className="mt-0.5 shrink-0" size={24} aria-hidden />
              <span className="text-base font-medium">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-fg px-8 py-16 text-center text-bg">
          <div className="absolute left-1/2 top-0 h-48 w-[28rem] -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" aria-hidden />
          <BotHead size={64} className="relative mx-auto mb-4" />
          <h2 className="relative text-3xl font-bold md:text-4xl">Ready to move forward?</h2>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink to={session ? '/app/new' : '/sign-up'} className="!min-h-14 !bg-accent !px-7 !text-black">
              Find my solver
            </ButtonLink>
            <ButtonLink to={session ? '/app/explore' : '/sign-up'} variant="secondary" className="!min-h-14 !border-white/30 !bg-transparent !px-7 !text-white hover:!bg-white/10">
              I can help
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  )
}
