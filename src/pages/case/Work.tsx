import { useState } from 'react'
import { CheckCircle2, Circle, ListChecks, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useMe } from '../../lib/auth'
import { errorMessage, unwrap, useData } from '../../lib/data'
import { fetchPeople } from '../../lib/queries'
import { timeAgo } from '../../lib/format'
import type { Case, Milestone, ProgressUpdate, Task } from '../../lib/types'
import { Button, Card, EmptyState, ErrorState, IconButton, ListSkeleton } from '../../components/ui'
import { Input, Select, Textarea } from '../../components/forms'
import { ConfirmDialog, Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'

export function Work({ c }: { c: Case }) {
  const { id: uid } = useMe()
  const toast = useToast()
  const isOwner = c.owner_id === uid
  const editable = ['open', 'in_progress', 'resolution_proposed'].includes(c.status)

  const q = useData(async () => {
    const [ms, ts, ps, conns] = await Promise.all([
      supabase.from('milestones').select('*').eq('case_id', c.id).order('position').order('created_at'),
      supabase.from('tasks').select('*').eq('case_id', c.id).order('created_at'),
      supabase.from('progress_updates').select('*').eq('case_id', c.id).order('created_at', { ascending: false }),
      supabase.from('connections').select('seeker_id,solver_id').eq('case_id', c.id).in('status', ['accepted', 'closed']),
    ])
    const milestones = unwrap(ms) as Milestone[]
    const tasks = unwrap(ts) as Task[]
    const updates = unwrap(ps) as ProgressUpdate[]
    const cs = unwrap(conns) as { seeker_id: string; solver_id: string }[]
    const memberIds = [...new Set([c.owner_id, ...cs.map((x) => x.solver_id), uid])]
    const people = await fetchPeople([...memberIds, ...tasks.map((t) => t.assignee_id ?? ''), ...updates.map((u) => u.author_id)])
    return { milestones, tasks, updates, memberIds, people }
  }, [c.id])

  const [msModal, setMsModal] = useState(false)
  const [msTitle, setMsTitle] = useState('')
  const [taskModal, setTaskModal] = useState(false)
  const [tTitle, setTTitle] = useState('')
  const [tAssignee, setTAssignee] = useState('')
  const [tDue, setTDue] = useState('')
  const [tMs, setTMs] = useState('')
  const [upd, setUpd] = useState('')
  const [del, setDel] = useState<{ kind: 'milestones' | 'tasks'; id: string; title: string } | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => PromiseLike<{ error: unknown }>, ok?: string) {
    setBusy(true)
    try {
      const res = await fn()
      if (res.error) throw new Error('db')
      if (ok) toast.success(ok)
      q.reload()
      return true
    } catch (e) {
      toast.error(errorMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  if (q.loading) return <ListSkeleton />
  if (q.error || !q.data) return <ErrorState message={q.error ?? "Couldn't load."} onRetry={q.reload} />
  const { milestones, tasks, updates, memberIds, people } = q.data
  const doneCount = milestones.filter((m) => m.status === 'done').length
  const pct = milestones.length ? Math.round((doneCount / milestones.length) * 100) : 0

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-bold">Milestones</h2>
          {editable && (
            <Button variant="secondary" onClick={() => { setMsTitle(''); setErr(''); setMsModal(true) }}>
              <Plus size={16} aria-hidden /> Add
            </Button>
          )}
        </div>
        {milestones.length > 0 && (
          <div className="mb-3">
            <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">{doneCount} of {milestones.length} done</p>
          </div>
        )}
        {milestones.length === 0 ? (
          <EmptyState icon={ListChecks} title="No milestones yet" />
        ) : (
          <ul className="space-y-2">
            {milestones.map((m) => (
              <li key={m.id}>
                <Card className="flex items-center gap-3 !p-3">
                  <button
                    aria-label={m.status === 'done' ? 'Mark as not done' : 'Mark as done'}
                    disabled={!editable || busy}
                    onClick={() => run(() => supabase.from('milestones').update({ status: m.status === 'done' ? 'pending' : 'done' }).eq('id', m.id))}
                    className="flex h-11 w-11 items-center justify-center"
                  >
                    {m.status === 'done' ? <CheckCircle2 className="text-success" aria-hidden /> : <Circle className="text-muted" aria-hidden />}
                  </button>
                  <span className={`flex-1 ${m.status === 'done' ? 'text-muted line-through' : ''}`}>{m.title}</span>
                  {isOwner && editable && <IconButton icon={Trash2} label="Delete" onClick={() => setDel({ kind: 'milestones', id: m.id, title: m.title })} />}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-bold">Tasks</h2>
          {editable && (
            <Button variant="secondary" onClick={() => { setTTitle(''); setTAssignee(''); setTDue(''); setTMs(''); setErr(''); setTaskModal(true) }}>
              <Plus size={16} aria-hidden /> Add
            </Button>
          )}
        </div>
        {tasks.length === 0 ? (
          <EmptyState icon={ListChecks} title="No tasks yet" />
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li key={t.id}>
                <Card className="flex flex-wrap items-center gap-3 !p-3">
                  <div className="min-w-0 flex-1">
                    <p className={t.status === 'done' ? 'text-muted line-through' : 'font-medium'}>{t.title}</p>
                    <p className="text-xs text-muted">
                      {t.assignee_id ? people.get(t.assignee_id)?.display_name ?? 'Someone' : 'Unassigned'}
                      {t.due_date ? ` · due ${new Date(t.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                    </p>
                  </div>
                  <select
                    aria-label={`Status of ${t.title}`}
                    value={t.status}
                    disabled={!editable || busy}
                    onChange={(e) => run(() => supabase.from('tasks').update({ status: e.target.value }).eq('id', t.id))}
                    className="min-h-11 rounded-xl border border-line bg-surface px-2 text-sm"
                  >
                    <option value="todo">To do</option>
                    <option value="doing">Doing</option>
                    <option value="done">Done</option>
                  </select>
                  {isOwner && editable && <IconButton icon={Trash2} label="Delete" onClick={() => setDel({ kind: 'tasks', id: t.id, title: t.title })} />}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-bold">Updates</h2>
        {editable && (
          <form
            className="mb-4 space-y-2"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!upd.trim()) return
              const ok = await run(() => supabase.from('progress_updates').insert({ case_id: c.id, author_id: uid, body: upd.trim() }), 'Update posted.')
              if (ok) setUpd('')
            }}
          >
            <Textarea label="Share an update" rows={2} maxLength={2000} value={upd} onChange={(e) => setUpd(e.target.value)} />
            <Button type="submit" loading={busy} disabled={!upd.trim()}>Post</Button>
          </form>
        )}
        {updates.length === 0 ? (
          <p className="text-sm text-muted">No updates yet.</p>
        ) : (
          <ul className="space-y-3">
            {updates.map((u) => (
              <li key={u.id} className="rounded-lg border border-line bg-surface p-3 text-sm">
                <p className="mb-1 text-xs text-muted">
                  {people.get(u.author_id)?.display_name ?? 'Someone'} · {timeAgo(u.created_at)}
                </p>
                <p className="whitespace-pre-wrap">{u.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={msModal} title="Add milestone" onClose={() => setMsModal(false)}>
        <div className="space-y-4">
          <Input label="Title" value={msTitle} error={err} onChange={(e) => setMsTitle(e.target.value)} maxLength={140} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMsModal(false)}>Cancel</Button>
            <Button
              loading={busy}
              onClick={async () => {
                if (!msTitle.trim()) return setErr('Enter a title.')
                const ok = await run(
                  () => supabase.from('milestones').insert({ case_id: c.id, title: msTitle.trim(), position: milestones.length, created_by: uid }),
                  'Milestone added.',
                )
                if (ok) setMsModal(false)
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={taskModal} title="Add task" onClose={() => setTaskModal(false)}>
        <div className="space-y-4">
          <Input label="Title" value={tTitle} error={err} onChange={(e) => setTTitle(e.target.value)} maxLength={200} />
          <Select label="Assign to" value={tAssignee} onChange={(e) => setTAssignee(e.target.value)}>
            <option value="">No one yet</option>
            {memberIds.map((id) => (
              <option key={id} value={id}>{id === uid ? 'Me' : people.get(id)?.display_name ?? 'Someone'}</option>
            ))}
          </Select>
          <Select label="Milestone" value={tMs} onChange={(e) => setTMs(e.target.value)}>
            <option value="">None</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </Select>
          <Input label="Due date" type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTaskModal(false)}>Cancel</Button>
            <Button
              loading={busy}
              onClick={async () => {
                if (!tTitle.trim()) return setErr('Enter a title.')
                const ok = await run(
                  () =>
                    supabase.from('tasks').insert({
                      case_id: c.id,
                      title: tTitle.trim(),
                      assignee_id: tAssignee || null,
                      milestone_id: tMs || null,
                      due_date: tDue || null,
                      created_by: uid,
                    }),
                  'Task added.',
                )
                if (ok) setTaskModal(false)
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!del}
        title={`Delete “${del?.title}”?`}
        loading={busy}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          if (!del) return
          const ok = await run(() => supabase.from(del.kind).delete().eq('id', del.id), 'Deleted.')
          if (ok) setDel(null)
        }}
      />
    </div>
  )
}
