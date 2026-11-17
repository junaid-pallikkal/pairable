import { useState } from 'react'
import { Navigate } from 'react-router'
import { Check, Plus, Shield, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errorMessage, unwrap, useData } from '../lib/data'
import { timeAgo } from '../lib/format'
import type { Category, Skill } from '../lib/types'
import { Button, Card, Chip, EmptyState, ErrorState, ListSkeleton, PageHeader, Tabs } from '../components/ui'
import { Input, Select, Textarea } from '../components/forms'
import { ConfirmDialog, Modal } from '../components/Modal'
import { useToast } from '../components/Toast'

type Tab = 'overview' | 'waiting' | 'users' | 'problems' | 'reports' | 'verification' | 'categories' | 'log'

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  return unwrap(await supabase.rpc(fn, args)) as T
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-3xl bg-surface shadow-card">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:px-4 [&_td]:py-3 [&_tr]:border-b [&_tr]:border-line [&_tr:last-child]:border-0">{children}</tbody>
      </table>
    </div>
  )
}

/* ---------- Overview ---------- */
function Overview({ onGo }: { onGo: (t: Tab) => void }) {
  const q = useData(() => rpc<Record<string, number>>('admin_overview'), [])
  if (q.loading) return <ListSkeleton rows={2} />
  if (q.error || !q.data) return <ErrorState message={q.error ?? "Couldn't load."} onRetry={q.reload} />
  const d = q.data
  const attention: { label: string; n: number; tab: Tab }[] = [
    { label: 'Reports to review', n: d.reports_open, tab: 'reports' },
    { label: 'Verifications waiting', n: d.verifications_pending, tab: 'verification' },
    { label: 'Problems with no match yet', n: d.waiting_problems, tab: 'waiting' },
  ]
  const stats: [string, number][] = [
    ['People', d.users],
    ['Helpers with a profile', d.helpers],
    ['Active problems', d.cases_open],
    ['Resolved problems', d.cases_resolved],
    ['Connections made', d.connections_accepted],
    ['Resources listed', d.resources],
    ['Suspended or banned', d.suspended],
  ]
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-bold">Needs your attention</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {attention.map((a) => (
            <li key={a.label}>
              <button
                onClick={() => onGo(a.tab)}
                className={`flex h-full w-full flex-col rounded-3xl p-6 text-left shadow-card transition hover:-translate-y-1 hover:shadow-float ${a.n > 0 ? 'bg-accent text-black' : 'bg-surface'}`}
              >
                <span className="text-5xl font-bold tabular-nums">{a.n}</span>
                <span className="mt-1 text-sm font-semibold">{a.label}</span>
                <span className="mt-3 text-xs font-semibold underline">{a.n > 0 ? 'Open' : 'All clear'}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">The numbers</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([label, n]) => (
            <li key={label}>
              <Card>
                <p className="text-3xl font-bold tabular-nums">{n}</p>
                <p className="mt-1 text-sm text-muted">{label}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/* ---------- Problems nobody matches yet ---------- */
function Waiting() {
  const q = useData(
    () => rpc<{ id: string; title: string; owner_name: string; created_at: string; visibility: string }[]>('admin_waiting'),
    [],
  )
  if (q.loading) return <ListSkeleton />
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  if (q.data!.length === 0) return <EmptyState icon={Check} title="Every problem has at least one match." />
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">These people are waiting. Helpers with the right skills would make a difference.</p>
      <Table head={['Problem', 'Owner', 'Posted', 'Visible to helpers']}>
        {q.data!.map((p) => (
          <tr key={p.id}>
            <td className="max-w-md font-semibold">{p.title}</td>
            <td>{p.owner_name}</td>
            <td className="text-xs text-muted">{timeAgo(p.created_at)}</td>
            <td className="text-xs text-muted">{p.visibility === 'public_anonymised' ? 'Yes' : 'No'}</td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

/* ---------- Users ---------- */
interface UserRow {
  id: string
  display_name: string
  email: string
  intent: string
  status: string
  verification: string
  is_admin: boolean
  created_at: string
}

function Users() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [target, setTarget] = useState<{ u: UserRow; status: string } | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useData(() => rpc<UserRow[]>('admin_users', { p_q: term }), [term])

  async function setStatus() {
    if (!target) return
    setBusy(true)
    try {
      await rpc('admin_set_user_status', { p_user: target.u.id, p_status: target.status, p_reason: reason })
      toast.success('Updated.')
      setTarget(null)
      setReason('')
      list.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  async function setVerification(u: UserRow, level: string) {
    try {
      await rpc('admin_set_verification', { p_user: u.id, p_level: level })
      toast.success('Updated.')
      list.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setTerm(q.trim())
        }}
        className="flex max-w-md gap-2"
      >
        <label htmlFor="adm-q" className="sr-only">Search people</label>
        <input id="adm-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" className="min-h-12 flex-1 rounded-2xl bg-surface-2 px-4 text-sm placeholder:text-muted" />
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      {list.loading ? (
        <ListSkeleton />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <Table head={['Person', 'Role', 'Status', 'Verified', 'Joined', 'Actions']}>
          {list.data!.map((u) => (
            <tr key={u.id}>
              <td>
                <p className="font-semibold">{u.display_name}</p>
                <p className="text-xs text-muted">{u.email}</p>
              </td>
              <td className="capitalize">{u.intent}{u.is_admin ? ' · admin' : ''}</td>
              <td><Chip tone={u.status === 'active' ? 'success' : 'danger'}>{u.status}</Chip></td>
              <td>
                <select
                  aria-label={`Verification for ${u.display_name}`}
                  value={u.verification}
                  onChange={(e) => setVerification(u, e.target.value)}
                  className="min-h-9 rounded-xl bg-surface-2 px-2 text-xs"
                >
                  <option value="none">None</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="id">ID</option>
                </select>
              </td>
              <td className="text-xs text-muted">{timeAgo(u.created_at)}</td>
              <td>
                {u.is_admin ? (
                  <span className="text-xs text-muted">Admin</span>
                ) : u.status === 'active' ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" className="!min-h-9 !px-3" onClick={() => setTarget({ u, status: 'suspended' })}>Suspend</Button>
                    <Button variant="ghost" className="!min-h-9 !px-3" onClick={() => setTarget({ u, status: 'banned' })}>Ban</Button>
                  </div>
                ) : (
                  <Button variant="secondary" className="!min-h-9 !px-3" onClick={() => setTarget({ u, status: 'active' })}>Restore</Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={!!target} title={`${target?.status === 'active' ? 'Restore' : target?.status === 'banned' ? 'Ban' : 'Suspend'} ${target?.u.display_name}?`} onClose={() => setTarget(null)}>
        <div className="space-y-4">
          <Textarea label="Reason (saved in the log)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
            <Button loading={busy} onClick={setStatus}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ---------- Problems ---------- */
function Problems() {
  const toast = useToast()
  const [status, setStatus] = useState('')
  const [target, setTarget] = useState<{ id: string; title: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const list = useData(
    () => rpc<{ id: string; title: string; owner_name: string; status: string; visibility: string; created_at: string }[]>('admin_cases', { p_status: status }),
    [status],
  )
  async function close() {
    if (!target) return
    setBusy(true)
    try {
      await rpc('admin_close_case', { p_case: target.id, p_reason: 'Closed by admin' })
      toast.success('Closed.')
      setTarget(null)
      list.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          {['draft', 'open', 'in_progress', 'resolution_proposed', 'resolved', 'closed'].map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </Select>
      </div>
      {list.loading ? (
        <ListSkeleton />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : list.data!.length === 0 ? (
        <EmptyState title="No problems" />
      ) : (
        <Table head={['Problem', 'Owner', 'Status', 'Visible to', 'Posted', '']}>
          {list.data!.map((c) => (
            <tr key={c.id}>
              <td className="max-w-xs truncate font-semibold">{c.title}</td>
              <td>{c.owner_name}</td>
              <td className="capitalize">{c.status.replace('_', ' ')}</td>
              <td className="text-xs text-muted">{c.visibility.replace('_', ' ')}</td>
              <td className="text-xs text-muted">{timeAgo(c.created_at)}</td>
              <td>
                {!['resolved', 'closed'].includes(c.status) && (
                  <Button variant="ghost" className="!min-h-9 !px-3" onClick={() => setTarget({ id: c.id, title: c.title })}>Close</Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <ConfirmDialog open={!!target} title={`Close “${target?.title}”?`} confirmLabel="Close" loading={busy} onConfirm={close} onClose={() => setTarget(null)} />
    </div>
  )
}

/* ---------- Reports ---------- */
interface ReportRow {
  id: string
  reporter_name: string
  target_type: string
  target_id: string
  target_label: string | null
  reason: string
  details: string | null
  status: string
  admin_note: string | null
  created_at: string
}

function Reports() {
  const toast = useToast()
  const [status, setStatus] = useState('open')
  const [target, setTarget] = useState<ReportRow | null>(null)
  const [action, setAction] = useState('actioned')
  const [effect, setEffect] = useState('none')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useData(() => rpc<ReportRow[]>('admin_reports', { p_status: status }), [status])

  async function resolve() {
    if (!target) return
    setBusy(true)
    try {
      await rpc('admin_resolve_report', { p_report: target.id, p_action: action, p_effect: action === 'dismissed' ? 'none' : effect, p_note: note })
      toast.success('Done.')
      setTarget(null)
      setNote('')
      setEffect('none')
      list.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select label="Show" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">To review</option>
          <option value="actioned">Action taken</option>
          <option value="dismissed">Dismissed</option>
          <option value="">All</option>
        </Select>
      </div>
      {list.loading ? (
        <ListSkeleton />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : list.data!.length === 0 ? (
        <EmptyState icon={Shield} title="No reports here" />
      ) : (
        <ul className="space-y-3">
          {list.data!.map((r) => (
            <li key={r.id}>
              <Card className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="neutral">{r.target_type}</Chip>
                  <Chip tone="warning">{r.reason}</Chip>
                  <Chip tone={r.status === 'open' ? 'info' : 'neutral'}>{r.status}</Chip>
                  <span className="ml-auto text-xs text-muted">{timeAgo(r.created_at)}</span>
                </div>
                <p className="font-semibold">{r.target_label ?? '(removed)'}</p>
                {r.details && <p className="text-sm text-muted">“{r.details}”</p>}
                <p className="text-xs text-muted">Reported by {r.reporter_name}</p>
                {r.admin_note && <p className="text-xs">Note: {r.admin_note}</p>}
                {r.status === 'open' && (
                  <div className="pt-1">
                    <Button variant="secondary" onClick={() => setTarget(r)}>Review</Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!target} title="Review report" onClose={() => setTarget(null)}>
        <div className="space-y-4">
          <p className="text-sm">{target?.target_label}</p>
          <Select label="Decision" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="actioned">Take action</option>
            <option value="dismissed">Dismiss</option>
          </Select>
          {action === 'actioned' && (
            <Select label="Action" value={effect} onChange={(e) => setEffect(e.target.value)}>
              <option value="none">Warn only</option>
              <option value="hide_content">Hide the content</option>
              <option value="suspend_user">Suspend the person</option>
            </Select>
          )}
          <Textarea label="Note (saved in the log)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
            <Button loading={busy} onClick={resolve}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ---------- Verification ---------- */
function Verification() {
  const toast = useToast()
  const [level, setLevel] = useState('id')
  const list = useData(
    () => rpc<{ id: string; user_id: string; display_name: string; note: string | null; created_at: string }[]>('admin_verification_requests'),
    [],
  )
  async function review(id: string, approve: boolean) {
    try {
      await rpc('admin_review_verification', { p_request: id, p_approve: approve, p_level: level })
      toast.success(approve ? 'Verified.' : 'Rejected.')
      list.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  if (list.loading) return <ListSkeleton />
  if (list.error) return <ErrorState message={list.error} onRetry={list.reload} />
  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select label="Level to give on approval" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="id">ID checked</option>
          <option value="phone">Phone checked</option>
          <option value="email">Email checked</option>
        </Select>
      </div>
      {list.data!.length === 0 ? (
        <EmptyState icon={Check} title="Nothing waiting" />
      ) : (
        <ul className="space-y-3">
          {list.data!.map((v) => (
            <li key={v.id}>
              <Card className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{v.display_name}</p>
                  {v.note && <p className="text-sm text-muted">{v.note}</p>}
                  <p className="text-xs text-muted">{timeAgo(v.created_at)}</p>
                </div>
                <Button onClick={() => review(v.id, true)}><Check size={16} aria-hidden /> Approve</Button>
                <Button variant="secondary" onClick={() => review(v.id, false)}><X size={16} aria-hidden /> Reject</Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------- Categories and skills ---------- */
function Categories() {
  const toast = useToast()
  const [name, setName] = useState('')
  const [del, setDel] = useState<Category | null>(null)
  const cats = useData(async () => unwrap(await supabase.from('categories').select('id,name').order('sort')) as Category[], [])
  const pending = useData(
    async () => unwrap(await supabase.from('skills').select('id,name,category_id').eq('is_approved', false).order('name')) as Skill[],
    [],
  )

  async function add() {
    if (name.trim().length < 2) return
    try {
      unwrap(await supabase.from('categories').insert({ name: name.trim(), sort: (cats.data?.length ?? 0) + 1 }))
      setName('')
      toast.success('Added.')
      cats.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  async function remove() {
    if (!del) return
    try {
      unwrap(await supabase.from('categories').delete().eq('id', del.id))
      toast.success('Deleted.')
      setDel(null)
      cats.reload()
    } catch {
      toast.error("Couldn't delete. It may be in use.")
      setDel(null)
    }
  }
  async function skill(s: Skill, approve: boolean) {
    try {
      if (approve) unwrap(await supabase.from('skills').update({ is_approved: true }).eq('id', s.id))
      else unwrap(await supabase.from('skills').delete().eq('id', s.id))
      pending.reload()
    } catch {
      toast.error("Couldn't update. The skill may be in use.")
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section>
        <h2 className="mb-3 font-bold">Categories</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
          className="mb-4 flex gap-2"
        >
          <div className="flex-1">
            <Input label="New category" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <Button type="submit" className="mt-6"><Plus size={16} aria-hidden /> Add</Button>
        </form>
        {cats.loading ? (
          <ListSkeleton rows={2} />
        ) : (
          <ul className="space-y-2">
            {(cats.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-2xl bg-surface px-4 py-2 shadow-card">
                <span>{c.name}</span>
                <button aria-label={`Delete ${c.name}`} onClick={() => setDel(c)} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-surface-2">
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 font-bold">New skills to approve</h2>
        {pending.loading ? (
          <ListSkeleton rows={2} />
        ) : (pending.data ?? []).length === 0 ? (
          <EmptyState title="No new skills" />
        ) : (
          <ul className="space-y-2">
            {pending.data!.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-2xl bg-surface px-4 py-2 shadow-card">
                <span>{s.name}</span>
                <span className="flex gap-1">
                  <Button variant="secondary" className="!min-h-9 !px-3" onClick={() => skill(s, true)}>Approve</Button>
                  <Button variant="ghost" className="!min-h-9 !px-3" onClick={() => skill(s, false)}>Remove</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ConfirmDialog open={!!del} title={`Delete “${del?.name}”?`} onConfirm={remove} onClose={() => setDel(null)} />
    </div>
  )
}

/* ---------- Log ---------- */
function Log() {
  const q = useData(
    () => rpc<{ id: number; actor_name: string | null; action: string; entity: string; details: Record<string, unknown>; created_at: string }[]>('admin_audit'),
    [],
  )
  if (q.loading) return <ListSkeleton />
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  if (q.data!.length === 0) return <EmptyState title="Nothing logged yet" />
  return (
    <Table head={['When', 'Who', 'What', 'Details']}>
      {q.data!.map((a) => (
        <tr key={a.id}>
          <td className="whitespace-nowrap text-xs text-muted">{timeAgo(a.created_at)}</td>
          <td>{a.actor_name ?? '—'}</td>
          <td>{a.action.replace(/_/g, ' ')}</td>
          <td className="max-w-xs truncate text-xs text-muted">{JSON.stringify(a.details)}</td>
        </tr>
      ))}
    </Table>
  )
}

export default function Admin() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  if (!profile?.is_admin) return <Navigate to="/app" replace />
  return (
    <div>
      <PageHeader title="Admin" />
      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'waiting', label: 'Waiting' },
          { id: 'users', label: 'People' },
          { id: 'problems', label: 'Problems' },
          { id: 'reports', label: 'Reports' },
          { id: 'verification', label: 'Verification' },
          { id: 'categories', label: 'Categories' },
          { id: 'log', label: 'Log' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'overview' && <Overview onGo={setTab} />}
      {tab === 'waiting' && <Waiting />}
      {tab === 'users' && <Users />}
      {tab === 'problems' && <Problems />}
      {tab === 'reports' && <Reports />}
      {tab === 'verification' && <Verification />}
      {tab === 'categories' && <Categories />}
      {tab === 'log' && <Log />}
    </div>
  )
}
