import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { BellRing, Pencil, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, useMe } from '../lib/auth'
import { errorMessage, unwrap } from '../lib/data'
import { understand } from '../lib/ai'
import { Button, ButtonLink, Card } from '../components/ui'
import { Input } from '../components/forms'
import { Mascot } from '../components/Mascot'
import { MicButton } from '../components/MicButton'
import { PersonCard } from '../components/MatchDeck'
import { useToast } from '../components/Toast'

const EXAMPLES = [
  'I am a grandmother who loves telling bedtime stories and folk tales to children',
  'I help older people learn to use smartphones and video calls',
  'Retired electrician. I can fix fans, wiring and small appliances',
]

/** The helper writes what they can offer in plain words. Pip makes the profile and tells waiting seekers. */
export default function Offer() {
  const { profile } = useMe()
  const { refreshProfile } = useAuth()
  const toast = useToast()
  const has = !!profile.offer_text
  const [editing, setEditing] = useState(!has)
  const [text, setText] = useState(profile.offer_text ?? '')
  const [city, setCity] = useState(profile.city ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [matched, setMatched] = useState<number | null>(null)

  useEffect(() => {
    setText(profile.offer_text ?? '')
    setCity(profile.city ?? '')
  }, [profile.offer_text, profile.city])

  async function save(override?: string) {
    const t = (override ?? text).trim()
    if (t.length < 8) return setErr('Tell me a little more.')
    setErr('')
    setBusy(true)
    try {
      const u = await understand('offer', t)
      const res = unwrap(
        await supabase.rpc('save_offer', { p_text: t, p_headline: u.title, p_summary: u.summary, p_keywords: u.keywords, p_city: city.trim() || null }),
      ) as { matched_problems: number }
      setMatched(res.matched_problems)
      await refreshProfile()
      setEditing(false)
      toast.success('Your profile is live.')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const auto = useRef(false)
  useEffect(() => {
    if (auto.current) return
    auto.current = true
    let d: string | null = null
    try {
      d = localStorage.getItem('repair_offer_draft')
      if (d) localStorage.removeItem('repair_offer_draft')
    } catch {
      /* ignore */
    }
    if (d) {
      setText(d)
      save(d)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!editing) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-end gap-4">
          <Mascot className="h-28 w-auto shrink-0" />
          <p className="mb-4 rounded-3xl rounded-bl-md bg-surface p-4 text-sm font-semibold shadow-card">
            {matched ? `Great! ${matched} ${matched === 1 ? 'person was' : 'people were'} waiting for someone like you. I told them.` : 'Your profile is live. I’ll notify you when someone needs what you offer.'}
          </p>
        </div>
        <h1 className="mb-4 text-2xl font-bold">This is how people see you</h1>
        <PersonCard person={{ ...profile, availability_status: profile.availability_status }} className="mx-auto max-w-sm" />
        {matched === 0 && (
          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-muted">
            <BellRing size={16} aria-hidden /> No one is waiting for this yet. You’ll get a notification when someone is.
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <ButtonLink to="/app/explore">See problems that fit me</ButtonLink>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil size={15} aria-hidden /> Change what I wrote
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-end gap-4">
        <Mascot className="h-36 w-auto shrink-0" />
        <div className="mb-6 rounded-3xl rounded-bl-md bg-surface p-5 shadow-card">
          <p className="text-lg font-bold">Tell me about you.</p>
          <p className="text-sm text-muted">What can you offer? Skills, time, stories, tools, anything.</p>
        </div>
      </div>

      <Card className="mt-4 space-y-4 !p-4">
        <label htmlFor="offer-text" className="sr-only">What you can offer</label>
        <div className="relative">
          <textarea
            id="offer-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={2000}
            autoFocus
            placeholder="For example: I am a grandmother who loves telling bedtime stories. My grandchildren live far away now."
            className="w-full resize-none rounded-2xl bg-surface-2 p-4 pr-14 text-base placeholder:text-muted focus:outline-none"
          />
          <div className="absolute right-2 top-2">
            <MicButton onText={(t) => setText((v) => (v.trim() ? v.trim() + ' ' + t : t))} />
          </div>
        </div>
        {err && <p className="text-sm font-semibold">{err}</p>}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-full sm:w-56">
            <Input label="Where are you? (optional)" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
          </div>
          <Button loading={busy} onClick={() => save()} className="!min-h-12 !px-6">
            Create my profile <Send size={16} aria-hidden />
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
      {has && (
        <p className="mt-6 text-center text-sm">
          <Link to="/app" className="font-semibold underline">Cancel</Link>
        </p>
      )}
    </div>
  )
}
