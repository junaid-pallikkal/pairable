import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { useMe } from '../lib/auth'
import { errorMessage, loadCategories, loadSkills, unwrap, useData } from '../lib/data'
import { Button, Card, PageHeader } from '../components/ui'
import { Checkbox, Input, Select, Textarea } from '../components/forms'
import { IMPORTANCE, SkillPicker, type SkillSel } from '../components/SkillPicker'
import { useToast } from '../components/Toast'
import { DRAFT_KEY } from './Home'
import { MicButton } from '../components/MicButton'
import { interpretProblem } from '../lib/ai'

function readDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}

function titleFrom(text: string): string {
  const first = text.trim().split(/[.\n!?]/)[0].trim()
  return first.length > 90 ? first.slice(0, 87) + '…' : first
}

export default function NewCase() {
  const { id: uid, profile } = useMe()
  const nav = useNavigate()
  const toast = useToast()

  const [step, setStep] = useState<1 | 2>(1)
  const [text, setText] = useState(readDraft)
  const [title, setTitle] = useState('')
  const [skills, setSkills] = useState<SkillSel[]>([])
  const [category, setCategory] = useState('')
  const [urgency, setUrgency] = useState('')
  const [city, setCity] = useState(profile.city ?? '')
  const [state, setState] = useState(profile.state ?? '')
  const [remote, setRemote] = useState(true)
  const [bmin, setBmin] = useState('')
  const [bmax, setBmax] = useState('')
  const [visibility, setVisibility] = useState('private')
  const [errors, setErrors] = useState<{ text?: string; title?: string; skills?: string; budget?: string }>({})
  const [busy, setBusy] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [aiNote, setAiNote] = useState(false)

  const cats = useData(loadCategories, [])
  const allSkills = useData(loadSkills, [])

  // autosave the draft text
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, text)
    } catch {
      /* ignore */
    }
  }, [text])

  const suggested = useMemo(() => {
    const t = ' ' + text.toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ') + ' '
    return (allSkills.data ?? []).filter((s) => t.includes(' ' + s.name.toLowerCase() + ' '))
  }, [text, allSkills.data])

  async function next() {
    if (text.trim().length < 10) return setErrors({ text: 'Tell us a bit more (at least 10 characters).' })
    setErrors({})
    // Start with simple keyword suggestions (always works)
    let nextTitle = title || titleFrom(text)
    let nextSkills: SkillSel[] =
      skills.length === 0 && suggested.length ? suggested.slice(0, 5).map((s) => ({ id: s.id, name: s.name, level: 2 })) : skills
    // Then try the AI for better ones. If it is off or fails, keep the keyword ones.
    setThinking(true)
    try {
      const all = allSkills.data ?? []
      const r = await interpretProblem(text.trim(), all.map((s) => s.name), (cats.data ?? []).map((c) => c.name))
      if (!title && r.title) nextTitle = r.title
      const picked = r.skills
        .map((n) => all.find((s) => s.name === n))
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map((s) => ({ id: s.id, name: s.name, level: 2 }))
      if (skills.length === 0 && picked.length) nextSkills = picked
      const cat = (cats.data ?? []).find((c) => c.name === r.category)
      if (cat && !category) setCategory(cat.id)
      setAiNote(true)
    } catch {
      setAiNote(false)
    } finally {
      setThinking(false)
    }
    setTitle(nextTitle)
    setSkills(nextSkills)
    setStep(2)
  }

  async function submit() {
    const e: typeof errors = {}
    if (title.trim().length < 3) e.title = 'Add a short title.'
    if (skills.length === 0) e.skills = 'Add at least one skill.'
    if (bmin && bmax && Number(bmin) > Number(bmax)) e.budget = 'Minimum is higher than maximum.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      const row = unwrap(
        await supabase
          .from('cases')
          .insert({
            owner_id: uid,
            title: title.trim(),
            description: text.trim(),
            category_id: category || null,
            urgency: urgency || null,
            city: city.trim() || null,
            state: state.trim() || null,
            remote_ok: remote,
            budget_min: bmin ? Number(bmin) : null,
            budget_max: bmax ? Number(bmax) : null,
            visibility,
          })
          .select('id')
          .single(),
      ) as { id: string }
      unwrap(
        await supabase
          .from('case_skills')
          .insert(skills.map((s) => ({ case_id: row.id, skill_id: s.id, importance: s.level }))),
      )
      unwrap(await supabase.rpc('publish_case', { p_case: row.id }))
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
      nav(`/app/cases/${row.id}?tab=matches&run=1`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (step === 1) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="What do you need help with?" />
        <Card className="space-y-4">
          <div className="relative">
          <Textarea
            label="Your problem"
            rows={8}
            maxLength={5000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={errors.text}
            placeholder="Write in your own words. Include what you tried and what result you want."
          />
          <div className="absolute right-2 top-8">
            <MicButton onText={(t) => setText((v) => (v.trim() ? v.trim() + ' ' + t : t))} />
          </div>
          </div>
          <div className="flex justify-end">
            <Button loading={thinking} onClick={next}>Continue</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Check details" />
      <Card className="space-y-5">
        {aiNote && <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm font-semibold">Suggested with AI. Please check and change anything.</p>}
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} maxLength={140} />
        <div>
          <SkillPicker value={skills} onChange={setSkills} levels={IMPORTANCE} label="Skills needed" />
          {errors.skills && <p className="mt-1.5 text-sm text-danger">{errors.skills}</p>}
          {suggested.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {suggested
                .filter((s) => !skills.some((k) => k.id === s.id))
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSkills([...skills, { id: s.id, name: s.name, level: 2 }])}
                    className="rounded-full border border-dashed border-primary px-3 py-1 text-xs font-semibold text-primary"
                  >
                    + {s.name}
                  </button>
                ))}
            </div>
          )}
        </div>
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Not sure</option>
          {(cats.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select label="How soon?" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
          <option value="">No rush</option>
          <option value="urgent">Urgent</option>
          <option value="this_week">This week</option>
          <option value="this_month">This month</option>
          <option value="flexible">Flexible</option>
        </Select>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input label="State" value={state} onChange={(e) => setState(e.target.value)} />
        </div>
        <Checkbox label="Remote help is fine" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Budget from (₹)" type="number" min={0} value={bmin} onChange={(e) => setBmin(e.target.value)} />
          <Input label="Budget to (₹)" type="number" min={0} value={bmax} onChange={(e) => setBmax(e.target.value)} error={errors.budget} />
        </div>
        <Select label="Who can see this?" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="private">Only me</option>
          <option value="matched_only">People matched to it</option>
          <option value="public_anonymised">Everyone, without my name</option>
        </Select>
        <div className="flex justify-between gap-2">
          <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
          <Button loading={busy} onClick={submit}>Find solvers</Button>
        </div>
      </Card>
    </div>
  )
}
