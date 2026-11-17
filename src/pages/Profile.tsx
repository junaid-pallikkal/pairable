import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { HandHeart, Handshake, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, useMe } from '../lib/auth'
import { errorMessage, unwrap, useData } from '../lib/data'
import type { Availability, Intent } from '../lib/types'
import { Button, Card, ListSkeleton, PageHeader, PageSpinner } from '../components/ui'
import { Checkbox, Input, Select, Textarea } from '../components/forms'
import type { SkillSel } from '../components/SkillPicker'
import { useToast } from '../components/Toast'
import { BlockedList, VerificationCard } from '../components/AccountSafety'
import { PhotoUploader } from '../components/MediaParts'
import Offer from './Offer'

interface UserSkillRow {
  skill_id: string
  proficiency: number
  years: number | null
  skills: { name: string } | null
}

function ProfileEditor({ initialIntent, onboarding }: { initialIntent?: Intent; onboarding?: boolean }) {
  const { id, profile } = useMe()
  const { refreshProfile } = useAuth()
  const toast = useToast()
  const nav = useNavigate()

  const [name, setName] = useState(profile.display_name)
  const [headline, setHeadline] = useState(profile.headline ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [city, setCity] = useState(profile.city ?? '')
  const [state, setState] = useState(profile.state ?? '')
  const [remote, setRemote] = useState(profile.remote_ok)
  const [avail, setAvail] = useState<Availability>(profile.availability_status)
  const [intent, setIntent] = useState<Intent>(initialIntent ?? profile.intent)
  const [discoverable, setDiscoverable] = useState(profile.discoverable)
  const [skills, setSkills] = useState<SkillSel[]>([])
  const [errors, setErrors] = useState<{ name?: string; skills?: string }>({})
  const [busy, setBusy] = useState(false)

  const existing = useData(async () => {
    const rows = unwrap(
      await supabase.from('user_skills').select('skill_id,proficiency,years,skills(name)').eq('user_id', id),
    ) as unknown as UserSkillRow[]
    return rows
  }, [id])

  useEffect(() => {
    if (existing.data)
      setSkills(
        existing.data.map((r) => ({ id: r.skill_id, name: r.skills?.name ?? '', level: r.proficiency, years: r.years })),
      )
  }, [existing.data])

  const helps = intent !== 'seeker'

  async function save(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Enter your name.'
    if (helps && onboarding && skills.length === 0) next.skills = 'Add at least one skill so people can find you.'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const upd = await supabase
        .from('profiles')
        .update({
          display_name: name.trim(),
          headline: headline.trim() || null,
          bio: bio.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          remote_ok: remote,
          availability_status: avail,
          intent,
          discoverable,
          onboarded_at: profile.onboarded_at ?? new Date().toISOString(),
        })
        .eq('id', id)
      if (upd.error) throw upd.error

      const keep = skills.map((s) => s.id)
      const del = supabase.from('user_skills').delete().eq('user_id', id)
      const r1 = keep.length ? await del.not('skill_id', 'in', `(${keep.join(',')})`) : await del
      if (r1.error) throw r1.error
      if (skills.length) {
        const r2 = await supabase.from('user_skills').upsert(
          skills.map((s) => ({ user_id: id, skill_id: s.id, proficiency: s.level, years: s.years ?? null })),
        )
        if (r2.error) throw r2.error
      }
      if (skills.length) {
        const merged = [...new Set([...(profile.offer_keywords ?? []), ...skills.map((s) => s.name.toLowerCase())])].slice(0, 20)
        await supabase.from('profiles').update({ offer_keywords: merged }).eq('id', id)
      }
      await refreshProfile()
      toast.success(onboarding ? 'You are all set.' : 'Saved.')
      if (onboarding) nav(intent === 'solver' ? '/app/explore' : '/app/new', { replace: true })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (existing.loading) return <ListSkeleton rows={3} />

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={60} />
      <Input label="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Chartered accountant" maxLength={120} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <Input label="State" value={state} onChange={(e) => setState(e.target.value)} />
      </div>
      <Checkbox label="I can help or be helped remotely" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
      {!onboarding && (
        <Select label="I want to" value={intent} onChange={(e) => setIntent(e.target.value as Intent)}>
          <option value="both">Get help and help others</option>
          <option value="seeker">Get help</option>
          <option value="solver">Help others</option>
        </Select>
      )}
      {helps && (
        <>
          <Textarea label="About you" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={1500} />
          <Select label="Availability" value={avail} onChange={(e) => setAvail(e.target.value as Availability)}>
            <option value="open">Available</option>
            <option value="limited">Limited</option>
            <option value="unavailable">Not available</option>
          </Select>
        </>
      )}
      <Checkbox label="Let people find me" checked={discoverable} onChange={(e) => setDiscoverable(e.target.checked)} />
      <Button type="submit" loading={busy}>{onboarding ? 'Finish' : 'Save'}</Button>
    </form>
  )
}

export function Onboarding() {
  const { id } = useMe()
  const { refreshProfile } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState<Intent | null>(null)
  const auto = useRef(false)
  const [known] = useState(() => {
    try {
      const s = localStorage.getItem('repair_intent')
      return s === 'seeker' || s === 'solver'
    } catch {
      return false
    }
  })

  async function choose(intent: Intent) {
    setBusy(intent)
    try {
      unwrap(await supabase.from('profiles').update({ intent, onboarded_at: new Date().toISOString() }).eq('id', id))
      try {
        localStorage.removeItem('repair_intent')
      } catch {
        /* ignore */
      }
      await refreshProfile()
      nav(intent === 'solver' ? '/app/settings' : intent === 'seeker' ? '/app/ask' : '/app', { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
      setBusy(null)
    }
  }

  // Arrived from a button on the landing page: skip the question
  useEffect(() => {
    if (auto.current) return
    auto.current = true
    let saved: string | null = null
    try {
      saved = localStorage.getItem('repair_intent')
    } catch {
      /* ignore */
    }
    if (saved === 'seeker' || saved === 'solver') choose(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (known) return <PageSpinner />

  const cards: { v: Intent; icon: typeof Search; title: string; text: string }[] = [
    { v: 'seeker', icon: Search, title: 'I need someone', text: 'Tell Pip what you need. Swipe through the people who can help.' },
    { v: 'solver', icon: HandHeart, title: 'I can help', text: 'Tell Pip what you offer. Get matched, or browse problems.' },
  ]
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-center text-3xl font-bold tracking-tight">How would you like to start?</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <button
            key={c.v}
            disabled={!!busy}
            onClick={() => choose(c.v)}
            className="group rounded-[2rem] bg-surface p-7 text-left shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-float disabled:opacity-60"
          >
            <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-black">
              <c.icon size={26} aria-hidden />
            </span>
            <span className="block text-xl font-bold">{c.title}</span>
            <span className="mt-1 block text-sm text-muted">{c.text}</span>
          </button>
        ))}
      </div>
      <p className="mt-6 text-center">
        <button disabled={!!busy} onClick={() => choose('both')} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline">
          <Handshake size={16} aria-hidden /> Both, I’ll decide later
        </button>
      </p>
    </div>
  )
}

export function Settings() {
  const { profile } = useMe()
  const [help, setHelp] = useState(false)
  const helper = profile.intent !== 'seeker' || help
  return (
    <div className="max-w-3xl">
      <PageHeader title="Profile" />
      <div className="space-y-10">
        {helper ? (
          <section aria-label="What I offer">
            <h2 className="mb-4 text-xl font-bold">What I offer</h2>
            <Offer embedded />
          </section>
        ) : (
          <Card className="space-y-5">
            <PhotoUploader />
            <div className="rounded-2xl bg-accent-soft p-4">
              <p className="font-semibold">Want to help other people too?</p>
              <p className="text-sm text-muted">Tell Pip what you can offer, and people who need it will find you.</p>
              <Button className="mt-3" onClick={() => setHelp(true)}>I can help too</Button>
            </div>
          </Card>
        )}
        <section>
          <h2 className="mb-4 text-xl font-bold">Your details</h2>
          <Card className="max-w-xl"><ProfileEditor /></Card>
        </section>
        <div className="max-w-xl space-y-6">
          <VerificationCard />
          <BlockedList />
        </div>
      </div>
    </div>
  )
}
