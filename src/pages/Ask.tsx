import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, BellRing, Loader2, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { errorMessage, unwrap } from '../lib/data'
import { understand } from '../lib/ai'
import { fetchTextMatches } from '../lib/textmatch'
import { Button, ButtonLink, Card } from '../components/ui'
import { Checkbox } from '../components/forms'
import { Mascot } from '../components/Mascot'
import { MicButton } from '../components/MicButton'
import { MatchingScene } from '../components/MatchingScene'
import { MatchDeck, type DeckItem } from '../components/MatchDeck'
import { PendingFiles } from '../components/MediaParts'
import { addMedia } from '../lib/media'
import { useAuth } from '../lib/auth'
import { MatchList } from '../components/MatchList'
import { useToast } from '../components/Toast'

const EXAMPLES = [
  'I want a grandmother to tell bedtime stories to my kids',
  'My father needs someone patient to teach him video calls',
  'Looking for someone to fix my old ceiling fan',
]

type Phase = 'compose' | 'thinking' | 'found' | 'deck' | 'waiting'

/** The seeker talks to Pip in plain words. No forms, no categories. */
export default function Ask() {
  const toast = useToast()
  const { session } = useAuth()
  const [files, setFiles] = useState<File[]>([])
  const [text, setText] = useState('')
  const [isPublic, setPublic] = useState(true)
  const [phase, setPhase] = useState<Phase>('compose')
  const [sent, setSent] = useState('')
  const [err, setErr] = useState('')
  const [caseId, setCaseId] = useState('')
  const [count, setCount] = useState(0)
  const [words, setWords] = useState<string[]>([])
  const [items, setItems] = useState<DeckItem[]>([])
  const [chosen, setChosen] = useState<string[]>([])

  async function submit(override?: string) {
    const t = (override ?? text).trim()
    if (t.length < 8) return setErr('Tell me a little more.')
    setErr('')
    setSent(t)
    setPhase('thinking')
    try {
      const u = await understand('problem', t)
      const res = unwrap(
        await supabase.rpc('submit_problem', { p_text: t, p_title: u.title, p_summary: u.summary, p_keywords: u.keywords, p_public: isPublic }),
      ) as { case_id: string; matches: number }
      setCaseId(res.case_id)
      // photos, videos or documents the person added to explain the problem
      if (files.length && session) {
        let failed = 0
        for (const f of files) {
          try {
            await addMedia(session.user.id, res.case_id, f)
          } catch {
            failed++
          }
        }
        setFiles([])
        if (failed) toast.error(failed === files.length ? "Your files couldn't be added." : 'Some files could not be added.')
      }
      setCount(res.matches)
      if (res.matches > 0) {
        const { items: found } = await fetchTextMatches(res.case_id)
        setItems(found)
        setWords([...new Set(found.flatMap((i) => i.hits))].slice(0, 6))
        // let the real result show for a moment, then the cards
        setPhase('found')
        setTimeout(() => setPhase(found.length ? 'deck' : 'waiting'), 2200)
      } else {
        setPhase('waiting')
      }
    } catch (e) {
      toast.error(errorMessage(e))
      setPhase('compose')
    }
  }

  // Arrived from the landing page with words already said: go straight to the result
  const auto = useRef(false)
  useEffect(() => {
    if (auto.current) return
    auto.current = true
    let d: string | null = null
    try {
      d = localStorage.getItem('repair_draft')
      if (d) localStorage.removeItem('repair_draft')
    } catch {
      /* ignore */
    }
    if (d) {
      setText(d)
      submit(d)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Nobody yet: keep looking, and show the cards the moment someone matches
  useEffect(() => {
    if (phase !== 'waiting' || !caseId) return
    let alive = true
    const t = setInterval(async () => {
      try {
        const { items: found } = await fetchTextMatches(caseId)
        if (!alive || found.length === 0) return
        setItems(found)
        setCount(found.length)
        setWords([...new Set(found.flatMap((i) => i.hits))].slice(0, 6))
        setPhase('deck')
        toast.success('A match just arrived!')
      } catch {
        /* keep waiting */
      }
    }, 8000)
    return () => {
      alive = false
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, caseId])

  async function decide(item: DeckItem, choose: boolean): Promise<boolean> {
    try {
      unwrap(await supabase.rpc('decide_match', { p_match: item.matchId, p_choose: choose, p_message: choose ? sent.slice(0, 480) : null }))
      if (choose) {
        setChosen((c) => [...c, item.person.display_name])
        toast.success(`Request sent to ${item.person.display_name}.`)
      }
      setItems((list) => list.filter((i) => i.matchId !== item.matchId))
      return true
    } catch (e) {
      toast.error(errorMessage(e))
      return false
    }
  }

  const reset = () => {
    setText('')
    setPhase('compose')
    setItems([])
    setChosen([])
  }

  return (
    <div className="mx-auto max-w-2xl">
      {phase === 'compose' && (
        <>
          <div className="flex items-end gap-4">
            <Mascot className="h-36 w-auto shrink-0" />
            <div className="mb-6 rounded-3xl rounded-bl-md bg-surface p-5 shadow-card">
              <p className="text-lg font-bold">Hi! What do you need?</p>
              <p className="text-sm text-muted">Say it in your own words. I’ll look for the right person.</p>
            </div>
          </div>

          <Card className="mt-4 space-y-4 !p-4">
            <label htmlFor="ask-text" className="sr-only">Tell Pip what you need</label>
            <div className="relative">
              <textarea
                id="ask-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                maxLength={2000}
                autoFocus
                placeholder="For example: I want a grandmother to tell bedtime stories to my kids."
                className="w-full resize-none rounded-2xl bg-surface-2 p-4 pr-14 text-base placeholder:text-muted focus:outline-none"
              />
              <div className="absolute right-2 top-2">
                <MicButton onText={(t) => setText((v) => (v.trim() ? v.trim() + ' ' + t : t))} />
              </div>
            </div>
            {err && <p className="text-sm font-semibold">{err}</p>}
            <PendingFiles files={files} onChange={setFiles} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Checkbox label="Let helpers see this (without my name)" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} />
              <Button onClick={() => submit()} className="!min-h-12 !px-6">
                Find my match <Send size={16} aria-hidden />
              </Button>
            </div>
          </Card>

          <div className="mt-5 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => setText(ex)} className="rounded-full border border-line bg-surface px-4 py-2 text-left text-xs font-semibold shadow-card transition hover:-translate-y-0.5">
                {ex}
              </button>
            ))}
          </div>
        </>
      )}

      {phase !== 'compose' && (
        <div className="mb-8 flex justify-end">
          <p className="max-w-[85%] rounded-3xl rounded-br-md bg-fg px-5 py-3 text-sm text-bg">{sent}</p>
        </div>
      )}

      {phase === 'thinking' && (
        <div className="py-4">
          <MatchingScene phase="analyzing" skills={[]} candidates={0} />
          <p className="mt-2 text-center text-sm text-muted">Pip is reading your words and looking for people…</p>
        </div>
      )}

      {phase === 'found' && (
        <div className="py-4">
          <MatchingScene phase="ranked" skills={words} candidates={count} />
        </div>
      )}

      {phase === 'deck' && (
        <div>
          <div className="mb-6 flex items-end gap-3">
            <Mascot className="h-24 w-auto shrink-0" />
            <p className="mb-3 rounded-3xl rounded-bl-md bg-surface p-4 text-sm font-semibold shadow-card">
              I found {count} {count === 1 ? 'person' : 'people'} who could help. Choose the one you like.
            </p>
          </div>
          <MatchDeck
            items={items}
            needText={sent}
            onDecide={decide}
            empty={
              <Card className="space-y-4 text-center">
                <p className="text-lg font-bold">{chosen.length ? `Request sent to ${chosen.join(' and ')}.` : 'That was everyone for now.'}</p>
                <p className="text-sm text-muted">
                  {chosen.length
                    ? 'You will get a notification when they reply. Then you can chat.'
                    : 'If someone new matches later, I will notify you.'}
                </p>
                <div className="flex justify-center gap-2">
                  <ButtonLink to="/app/connections">See my requests</ButtonLink>
                  <Button variant="secondary" onClick={reset}>Ask something else</Button>
                </div>
              </Card>
            }
          />
          <MatchList items={items} needText={sent} onChoose={(i) => decide(i, true)} />
        </div>
      )}

      {phase === 'waiting' && (
        <Card className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent text-black">
            <BellRing size={30} aria-hidden />
          </div>
          <h2 className="text-2xl font-bold">I’ve saved your problem.</h2>
          <p className="mx-auto max-w-sm text-muted">
            Nobody fits yet. The moment someone with the right help joins, I’ll send you a notification with the match.
          </p>
          <p role="status" className="flex items-center justify-center gap-2 text-sm font-semibold">
            <Loader2 size={16} className="animate-spin" aria-hidden /> Still looking. I check again every few seconds.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink to="/app">Go to my dashboard</ButtonLink>
            <Button variant="secondary" onClick={reset}>Ask something else</Button>
          </div>
          {isPublic && <p className="text-xs text-muted">Helpers can also see it (without your name) and offer to help.</p>}
          <Link to={`/app/cases/${caseId}`} className="inline-flex items-center gap-1 text-sm font-semibold underline">
            View this problem <ArrowRight size={14} aria-hidden />
          </Link>
        </Card>
      )}
    </div>
  )
}
