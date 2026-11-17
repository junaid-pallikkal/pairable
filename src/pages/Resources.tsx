import { useMemo, useState } from 'react'
import { MapPin, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMe } from '../lib/auth'
import { errorMessage, loadCategories, unwrap, useData } from '../lib/data'
import { placeText, timeAgo } from '../lib/format'
import type { Case } from '../lib/types'
import { Button, Card, Chip, EmptyState, ErrorState, ListSkeleton, PageHeader, Tabs } from '../components/ui'
import { Input, Select, Textarea } from '../components/forms'
import { ConfirmDialog, Modal } from '../components/Modal'
import { ReportButton } from '../components/Safety'
import { useToast } from '../components/Toast'

export interface ResourceRow {
  id: string
  owner_id: string
  direction: 'offer' | 'request'
  title: string
  description: string | null
  kind: 'physical' | 'digital' | 'space'
  category_id: string | null
  city: string | null
  state: string | null
  status: 'available' | 'reserved' | 'unavailable'
  hidden_by_admin: boolean
  created_at: string
  owner: { display_name: string } | null
}

const KIND = { physical: 'Equipment', digital: 'Digital', space: 'Space' } as const
const STATUS = { available: 'Available', reserved: 'Reserved', unavailable: 'Not available' } as const

/** Pick one of my open problems and send a request to the resource owner. */
export function AskResourceModal({
  resource,
  caseId,
  onClose,
  onSent,
}: {
  resource: { id: string; title: string } | null
  caseId?: string
  onClose: () => void
  onSent?: () => void
}) {
  const { id: uid } = useMe()
  const toast = useToast()
  const [chosen, setChosen] = useState(caseId ?? '')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const cases = useData(
    async () =>
      unwrap(
        await supabase.from('cases').select('id,title').eq('owner_id', uid).in('status', ['open', 'in_progress']),
      ) as Pick<Case, 'id' | 'title'>[],
    [uid],
  )

  async function send() {
    const cid = caseId ?? chosen
    if (!cid) return setErr('Choose a problem.')
    setBusy(true)
    try {
      unwrap(await supabase.rpc('request_resource', { p_case: cid, p_resource: resource!.id, p_message: msg }))
      toast.success('Request sent.')
      setMsg('')
      onSent?.()
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={!!resource} title={`Ask about “${resource?.title}”`} onClose={onClose}>
      <div className="space-y-4">
        {!caseId &&
          (cases.data && cases.data.length === 0 ? (
            <p className="text-sm text-muted">Post a problem first, then ask for this.</p>
          ) : (
            <Select label="For which problem?" value={chosen} error={err} onChange={(e) => setChosen(e.target.value)}>
              <option value="">Choose…</option>
              {(cases.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </Select>
          ))}
        <Textarea label="Message" rows={3} maxLength={500} value={msg} onChange={(e) => setMsg(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={send} disabled={!caseId && cases.data?.length === 0}>Send request</Button>
        </div>
      </div>
    </Modal>
  )
}

function ResourceForm({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean
  initial: ResourceRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const { id: uid, profile } = useMe()
  const toast = useToast()
  const cats = useData(loadCategories, [])
  const [title, setTitle] = useState(initial?.title ?? '')
  const [direction, setDirection] = useState(initial?.direction ?? 'offer')
  const [kind, setKind] = useState(initial?.kind ?? 'physical')
  const [category, setCategory] = useState(initial?.category_id ?? '')
  const [desc, setDesc] = useState(initial?.description ?? '')
  const [city, setCity] = useState(initial?.city ?? profile.city ?? '')
  const [state, setState] = useState(initial?.state ?? profile.state ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (title.trim().length < 3) return setErr('Add a short title.')
    setErr('')
    setBusy(true)
    try {
      const row = {
        title: title.trim(),
        direction,
        kind,
        category_id: category || null,
        description: desc.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
      }
      if (initial) unwrap(await supabase.from('resources').update(row).eq('id', initial.id))
      else unwrap(await supabase.from('resources').insert({ ...row, owner_id: uid }))
      toast.success('Saved.')
      onSaved()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title={initial ? 'Edit resource' : 'Add resource'} onClose={onClose}>
      <div className="space-y-4">
        <Input label="Title" value={title} error={err} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="I want to" value={direction} onChange={(e) => setDirection(e.target.value as 'offer' | 'request')}>
            <option value="offer">Offer this</option>
            <option value="request">Ask for this</option>
          </Select>
          <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value as ResourceRow['kind'])}>
            <option value="physical">Equipment</option>
            <option value="digital">Digital</option>
            <option value="space">Space</option>
          </Select>
        </div>
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">None</option>
          {(cats.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Textarea label="Details" rows={3} maxLength={1000} value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input label="State" value={state} onChange={(e) => setState(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}

export default function Resources() {
  const { id: uid } = useMe()
  const toast = useToast()
  const [tab, setTab] = useState<'offer' | 'request' | 'mine'>('offer')
  const [q, setQ] = useState('')
  const [form, setForm] = useState<{ open: boolean; item: ResourceRow | null }>({ open: false, item: null })
  const [del, setDel] = useState<ResourceRow | null>(null)
  const [ask, setAsk] = useState<ResourceRow | null>(null)

  const list = useData(
    async () =>
      unwrap(
        await supabase
          .from('resources')
          .select('*, owner:profiles!owner_id(display_name)')
          .order('created_at', { ascending: false })
          .limit(200),
      ) as ResourceRow[],
    [],
  )

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (list.data ?? []).filter((r) => {
      if (tab === 'mine' ? r.owner_id !== uid : r.owner_id === uid || r.direction !== tab) return false
      return !t || (r.title + ' ' + (r.description ?? '')).toLowerCase().includes(t)
    })
  }, [list.data, tab, q, uid])

  async function setStatus(r: ResourceRow, status: string) {
    try {
      unwrap(await supabase.from('resources').update({ status }).eq('id', r.id))
      list.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function remove() {
    if (!del) return
    try {
      unwrap(await supabase.from('resources').delete().eq('id', del.id))
      toast.success('Deleted.')
      setDel(null)
      list.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div>
      <PageHeader
        title="Resources"
        actions={
          <Button onClick={() => setForm({ open: true, item: null })}>
            <Plus size={16} aria-hidden /> Add resource
          </Button>
        }
      />
      <Tabs
        tabs={[
          { id: 'offer', label: 'Offered' },
          { id: 'request', label: 'Needed' },
          { id: 'mine', label: 'Mine' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <label htmlFor="res-q" className="sr-only">Search</label>
      <input
        id="res-q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search resources"
        className="mb-6 min-h-12 w-full max-w-sm rounded-2xl bg-surface-2 px-4 text-sm placeholder:text-muted"
      />

      {list.loading ? (
        <ListSkeleton />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Package}
          title={tab === 'mine' ? 'You have not added any resources' : 'Nothing here yet'}
          action={<Button variant="secondary" onClick={() => setForm({ open: true, item: null })}>Add resource</Button>}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((r) => {
            const mine = r.owner_id === uid
            return (
              <li key={r.id}>
                <Card className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{r.title}</h2>
                    <Chip tone="neutral" icon={Package}>{KIND[r.kind]}</Chip>
                  </div>
                  {r.description && <p className="line-clamp-3 text-sm text-muted">{r.description}</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden /> {placeText(r.city, r.state, false)}</span>
                    {!mine && <span>{r.owner?.display_name}</span>}
                    <span>{timeAgo(r.created_at)}</span>
                    {mine && r.hidden_by_admin && <Chip tone="danger">Hidden by admin</Chip>}
                  </div>
                  {mine ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`Availability of ${r.title}`}
                        value={r.status}
                        onChange={(e) => setStatus(r, e.target.value)}
                        className="min-h-10 rounded-xl bg-surface-2 px-3 text-sm"
                      >
                        {Object.entries(STATUS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                      <Button variant="ghost" onClick={() => setForm({ open: true, item: r })}><Pencil size={14} aria-hidden /> Edit</Button>
                      <Button variant="ghost" onClick={() => setDel(r)}><Trash2 size={14} aria-hidden /> Delete</Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {r.direction === 'offer' && r.status === 'available' && (
                        <Button variant="secondary" onClick={() => setAsk(r)}>Ask for this</Button>
                      )}
                      {r.status !== 'available' && <Chip tone="warning">{STATUS[r.status]}</Chip>}
                      <ReportButton type="resource" id={r.id} className="ml-auto" />
                    </div>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {form.open && (
        <ResourceForm
          key={form.item?.id ?? 'new'}
          open
          initial={form.item}
          onClose={() => setForm({ open: false, item: null })}
          onSaved={() => {
            setForm({ open: false, item: null })
            list.reload()
          }}
        />
      )}
      <AskResourceModal resource={ask} onClose={() => setAsk(null)} />
      <ConfirmDialog open={!!del} title={`Delete “${del?.title}”?`} onConfirm={remove} onClose={() => setDel(null)} />
    </div>
  )
}
