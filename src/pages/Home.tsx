import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, Handshake, Lightbulb, MessageSquareText, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { Button, ButtonLink } from '../components/ui'
import { useAuth } from '../lib/auth'
import { loadCategories, useData } from '../lib/data'
const MatchingScene = lazy(() => import('../components/MatchingScene').then((m) => ({ default: m.MatchingScene })))

export const DRAFT_KEY = 'solvia_draft'

function Composer() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [text, setText] = useState('')

  function go() {
    try {
      if (text.trim()) localStorage.setItem(DRAFT_KEY, text.trim())
    } catch {
      /* ignore */
    }
    nav(session ? '/app/new' : '/sign-up', { state: { from: '/app/new' } })
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-float">
      <label htmlFor="hero-problem" className="sr-only">
        Describe your problem
      </label>
      <textarea
        id="hero-problem"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={5000}
        placeholder="e.g. I need help registering my small business and filing GST."
        className="w-full resize-none rounded-xl bg-transparent p-2 text-base placeholder:text-muted focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <ButtonLink to={session ? '/app/explore' : '/sign-up'} variant="ghost">
          I can help
        </ButtonLink>
        <Button onClick={go}>
          Find my solver <ArrowRight size={16} aria-hidden />
        </Button>
      </div>
    </div>
  )
}

const STEPS = [
  { icon: MessageSquareText, title: 'Describe', text: 'Write your problem in your own words.' },
  { icon: Lightbulb, title: 'Understand', text: 'Check the skills it needs. Edit anything.' },
  { icon: Users, title: 'Match', text: 'See people ranked, with the reason for each.' },
  { icon: Handshake, title: 'Resolve', text: 'Connect, work together, confirm it is solved.' },
]

export default function Home() {
  const cats = useData(loadCategories, [])
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
        <div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">Problems meet solutions.</h1>
          <p className="mt-4 max-w-md text-lg text-muted">
            Describe what you need. SOLVIA helps you discover the right people, skills, and resources to move forward.
          </p>
          <div className="mt-8">
            <Composer />
          </div>
        </div>
        <div aria-hidden className="hidden md:block">
          <Suspense fallback={null}>
            <MatchingScene phase="ranked" skills={['Skills', 'Resources']} candidates={9} />
          </Suspense>
          <p className="mt-2 text-center text-xs text-muted">Illustration</p>
        </div>
      </section>

      <section className="border-y border-line bg-surface py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-8 text-2xl font-bold">How it works</h2>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="space-y-2">
                <s.icon className="text-primary" size={24} aria-hidden />
                <h3 className="font-semibold">
                  {i + 1}. {s.title}
                </h3>
                <p className="text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="mb-6 text-2xl font-bold">What you can solve</h2>
        <div className="flex flex-wrap gap-2">
          {(cats.data ?? []).map((c) => (
            <span key={c.id} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium">
              {c.name}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-14 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-xl font-bold">If you need help</h2>
          <p className="mt-2 text-muted">Share the problem once. Get a ranked list of people who can help, with reasons.</p>
          <ButtonLink to="/sign-up" className="mt-5">
            Describe a problem
          </ButtonLink>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-xl font-bold">If you can help</h2>
          <p className="mt-2 text-muted">List your skills and availability. Respond to people who fit what you do.</p>
          <ButtonLink to="/explore" variant="secondary" className="mt-5">
            Browse problems
          </ButtonLink>
        </div>
      </section>

      <section className="border-t border-line bg-surface py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-6 text-2xl font-bold">Trust and safety</h2>
          <ul className="grid gap-5 sm:grid-cols-2">
            {[
              [ShieldCheck, 'You decide who sees your problem. It is private by default.'],
              [Sparkles, 'Every match shows why. Missing information is shown as not provided.'],
              [Users, 'No fake ratings. Reliability appears only after real, confirmed cases.'],
              [Handshake, 'Nobody can message you until you accept the request.'],
            ].map(([Icon, text]) => {
              const I = Icon as typeof ShieldCheck
              return (
                <li key={text as string} className="flex gap-3">
                  <I className="mt-0.5 shrink-0 text-primary" size={20} aria-hidden />
                  <span>{text as string}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="text-3xl font-bold">Ready to move forward?</h2>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink to="/sign-up">Find my solver</ButtonLink>
          <ButtonLink to="/sign-up" variant="secondary">
            I can help
          </ButtonLink>
        </div>
      </section>
    </>
  )
}
