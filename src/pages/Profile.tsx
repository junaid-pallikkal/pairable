import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { HandHeart, Handshake, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, useMe } from '../lib/auth'
import { errorMessage, unwrap, useData } from '../lib/data'
import type { Availability, Intent } from '../lib/types'
import { Button, Card, ListSkeleton, PageHeader } from '../components/ui'
import { Checkbox, Input, Select, Textarea } from '../components/forms'
import { PROFICIENCY, SkillPicker, type SkillSel } from '../components/SkillPicker'
import { useToast } from '../components/Toast'
import { BlockedList, VerificationCard } from '../components/AccountSafety'

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
          <div>
            <SkillPicker value={skills} onChange={setSkills} levels={PROFICIENCY} withYears label="Your skills" />
            {errors.skills && <p className="mt-1.5 text-sm text-danger">{errors.skills}</p>}
          </div>
        </>
      )}
      <Checkbox label="Let people find me" checked={discoverable} onChange={(e) => setDiscoverable(e.target.checked)} />
      <Button type="submit" loading={busy}>{onboarding ? 'Finish' : 'Save'}</Button>
    </form>
  )
}

export function Onboarding() {
  const { profile } = useMe()
  const [intent, setIntent] = useState<Intent | null>(profile.onboarded_at ? profile.intent : null)

  if (!intent) {
    const opts: { v: Intent; icon: typeof Search; title: string }[] = [
      { v: 'seeker', icon: Search, title: 'I need help' },
      { v: 'solver', icon: HandHeart, title: 'I can help' },
      { v: 'both', icon: Handshake, title: 'Both' },
    ]
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-2xl font-bold">What brings you here?</h1>
        <div className="grid gap-3">
          {opts.map((o) => (
            <button
              key={o.v}
              onClick={() => setIntent(o.v)}
              className="flex min-h-16 items-center gap-4 rounded-2xl border border-line bg-surface px-5 text-left font-semibold hover:border-primary"
            >
              <o.icon className="text-primary" aria-hidden /> {o.title}
            </button>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Your profile</h1>
      <Card>
        <ProfileEditor initialIntent={intent} onboarding />
      </Card>
    </div>
  )
}

export function Settings() {
  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" />
      <Card>
        <ProfileEditor />
      </Card>
      <div className="mt-6 space-y-6">
        <VerificationCard />
        <BlockedList />
      </div>
    </div>
  )
}
