import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useMe } from '../../lib/auth'
import { errorMessage, loadCategories, unwrap, useData } from '../../lib/data'
import { budgetText, placeText, urgencyLabel, visibilityLabel } from '../../lib/format'
import { fetchPeople } from '../../lib/queries'
import type { Case, CaseSkill, Resolution } from '../../lib/types'
import { Button, Card, Chip, SkillChips } from '../../components/ui'
import { Input, Select, Textarea } from '../../components/forms'
import { Modal, ConfirmDialog } from '../../components/Modal'
import { IMPORTANCE, SkillPicker, type SkillSel } from '../../components/SkillPicker'
import { useToast } from '../../components/Toast'

export function Overview({
  c,
  skills,
  isOwner,
  isParticipant,
  onChanged,
}: {
  c: Case
  skills: CaseSkill[]
  isOwner: boolean
  isParticipant: boolean
  onChanged: () => void
}) {
  const toast = useToast()
  const [edit, setEdit] = useState(false)
  const [closing, setClosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const cats = useData(loadCategories, [])
  const catName = cats.data?.find((x) => x.id === c.category_id)?.name

  const active = ['open', 'in_progress', 'resolution_proposed'].includes(c.status)

  async function close() {
    setBusy(true)
    try {
      unwrap(await supabase.rpc('close_case', { p_case: c.id }))
      toast.success('Problem closed.')
      setClosing(false)
      onChanged()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <p className="whitespace-pre-wrap">{c.description}</p>
        <SkillChips names={skills.map((s) => s.skills?.name ?? '')} max={8} />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2 text-muted">
            <MapPin size={14} aria-hidden /> {placeText(c.city, c.state, c.remote_ok)}
          </div>
          {catName && <div className="text-muted">{catName}</div>}
          {c.urgency && <div className="text-muted">Urgency: {urgencyLabel[c.urgency]}</div>}
          {budgetText(c.budget_min, c.budget_max) && <div className="text-muted">Budget: {budgetText(c.budget_min, c.budget_max)}</div>}
          {isOwner && <div className="text-muted">Visible to: {visibilityLabel[c.visibility]}</div>}
        </dl>
        {isOwner && active && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setEdit(true)}>Edit</Button>
            <Button variant="ghost" onClick={() => setClosing(true)}>Close problem</Button>
          </div>
        )}
      </Card>

      {isParticipant && <ResolutionPanel c={c} isOwner={isOwner} onChanged={onChanged} />}
      {c.status === 'resolved' && isParticipant && <FeedbackPanel c={c} />}

      <EditModal open={edit} c={c} skills={skills} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); onChanged() }} />
      <ConfirmDialog open={closing} title="Close this problem?" confirmLabel="Close" loading={busy} onConfirm={close} onClose={() => setClosing(false)} />
    </div>
  )
}

/* ---------- Edit ---------- */

function EditModal({
  open,
  c,
  skills,
  onClose,
  onSaved,
}: {
  open: boolean
  c: Case
  skills: CaseSkill[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [title, setTitle] = useState(c.title)
  const [desc, setDesc] = useState(c.description)
  const [urgency, setUrgency] = useState(c.urgency ?? '')
  const [visibility, setVisibility] = useState(c.visibility)
  const [sel, setSel] = useState<SkillSel[]>(skills.map((s) => ({ id: s.skill_id, name: s.skills?.name ?? '', level: s.importance })))
  const [err, setErr] = useState<{ title?: string; skills?: string }>({})
  const [busy, setBusy] = useState(false)

  async function save() {
    const e: typeof err = {}
    if (title.trim().length < 3) e.title = 'Add a short title.'
    if (sel.length === 0) e.skills = 'Add at least one skill.'
    setErr(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      unwrap(
        await supabase
          .from('cases')
          .update({ title: title.trim(), description: desc.trim(), urgency: urgency || null, visibility })
          .eq('id', c.id),
      )
      unwrap(await supabase.from('case_skills').delete().eq('case_id', c.id))
      unwrap(await supabase.from('case_skills').insert(sel.map((s) => ({ case_id: c.id, skill_id: s.id, importance: s.level }))))
      toast.success('Saved.')
      onSaved()
    } catch (er) {
      toast.error(errorMessage(er))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title="Edit problem" onClose={onClose}>
      <div className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={err.title} />
        <Textarea label="Details" rows={5} value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div>
          <SkillPicker value={sel} onChange={setSel} levels={IMPORTANCE} label="Skills needed" />
          {err.skills && <p className="mt-1.5 text-sm text-danger">{err.skills}</p>}
        </div>
        <Select label="How soon?" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
          <option value="">No rush</option>
          <option value="urgent">Urgent</option>
          <option value="this_week">This week</option>
          <option value="this_month">This month</option>
          <option value="flexible">Flexible</option>
        </Select>
        <Select label="Who can see this?" value={visibility} onChange={(e) => setVisibility(e.target.value as Case['visibility'])}>
          <option value="private">Only me</option>
          <option value="matched_only">People matched to it</option>
          <option value="public_anonymised">Everyone, without my name</option>
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Resolution ---------- */

function ResolutionPanel({ c, isOwner, onChanged }: { c: Case; isOwner: boolean; onChanged: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const latest = useData(async () => {
    const rows = unwrap(
      await supabase.from('resolutions').select('*').eq('case_id', c.id).order('created_at', { ascending: false }).limit(1),
    ) as Resolution[]
    return rows[0] ?? null
  }, [c.id, c.status])

  async function call(fn: string, args: Record<string, unknown>, ok: string) {
    setBusy(true)
    try {
      unwrap(await supabase.rpc(fn, args))
      toast.success(ok)
      setOpen(false)
      setSummary('')
      onChanged()
      latest.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const reopenable = c.status === 'resolved' && c.resolved_at && Date.now() - new Date(c.resolved_at).getTime() < 7 * 864e5

  if (c.status === 'in_progress')
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">Is it solved?</p>
        <Button onClick={() => setOpen(true)}>Propose resolution</Button>
        <Modal open={open} title="Propose resolution" onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <Textarea label="What was done?" rows={4} value={summary} error={err} onChange={(e) => setSummary(e.target.value)} maxLength={1000} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                loading={busy}
                onClick={() => {
                  if (!summary.trim()) return setErr('Write a short summary.')
                  setErr('')
                  call('propose_resolution', { p_case: c.id, p_summary: summary.trim() }, 'Sent for confirmation.')
                }}
              >
                Send
              </Button>
            </div>
          </div>
        </Modal>
      </Card>
    )

  if (c.status === 'resolution_proposed')
    return (
      <Card className="space-y-3">
        <p className="font-semibold">Resolution proposed</p>
        {latest.data && <p className="text-sm text-muted">{latest.data.summary}</p>}
        {isOwner ? (
          <div className="flex gap-2">
            <Button loading={busy} onClick={() => call('respond_resolution', { p_case: c.id, p_accept: true }, 'Marked as resolved.')}>Confirm solved</Button>
            <Button variant="secondary" disabled={busy} onClick={() => call('respond_resolution', { p_case: c.id, p_accept: false }, 'Back in progress.')}>Not yet</Button>
          </div>
        ) : (
          <Chip tone="warning">Waiting for the owner to confirm</Chip>
        )}
      </Card>
    )

  if (c.status === 'resolved')
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">This problem is resolved.</p>
        {isOwner && reopenable && (
          <Button variant="secondary" loading={busy} onClick={() => call('reopen_case', { p_case: c.id }, 'Reopened.')}>Reopen</Button>
        )}
      </Card>
    )
  return null
}

/* ---------- Feedback ---------- */

function FeedbackPanel({ c }: { c: Case }) {
  const { id: uid } = useMe()
  const toast = useToast()
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null)
  const [outcome, setOutcome] = useState('resolved')
  const [rating, setRating] = useState('5')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const info = useData(async () => {
    const conns = unwrap(
      await supabase.from('connections').select('seeker_id,solver_id').eq('case_id', c.id).in('status', ['accepted', 'closed']),
    ) as { seeker_id: string; solver_id: string }[]
    const ids = new Set<string>([c.owner_id, ...conns.map((x) => x.solver_id)])
    ids.delete(uid)
    const given = unwrap(await supabase.from('feedback').select('to_user').eq('case_id', c.id).eq('from_user', uid)) as { to_user: string }[]
    const people = await fetchPeople([...ids])
    return [...ids].map((id) => ({ id, name: people.get(id)?.display_name ?? 'Someone', done: given.some((g) => g.to_user === id) }))
  }, [c.id, uid])

  async function send() {
    if (!target) return
    setBusy(true)
    try {
      unwrap(await supabase.rpc('submit_feedback', { p_case: c.id, p_to: target.id, p_outcome: outcome, p_rating: Number(rating), p_comment: comment }))
      toast.success('Thanks for the feedback.')
      setTarget(null)
      setComment('')
      info.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!info.data || info.data.length === 0) return null
  return (
    <Card className="space-y-3">
      <p className="font-semibold">Feedback</p>
      <ul className="space-y-2">
        {info.data.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3">
            <span>{p.name}</span>
            {p.done ? <Chip tone="success">Sent</Chip> : <Button variant="secondary" onClick={() => setTarget(p)}>Give feedback</Button>}
          </li>
        ))}
      </ul>
      <Modal open={!!target} title={`Feedback for ${target?.name}`} onClose={() => setTarget(null)}>
        <div className="space-y-4">
          <Select label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="resolved">Solved</option>
            <option value="partially">Partly solved</option>
            <option value="not_resolved">Not solved</option>
          </Select>
          <Select label="Rating" value={rating} onChange={(e) => setRating(e.target.value)}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{n} of 5</option>
            ))}
          </Select>
          <Textarea label="Comment (optional)" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
            <Button loading={busy} onClick={send}>Send</Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
