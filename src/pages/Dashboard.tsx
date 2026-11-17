import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { FolderOpen, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMe } from '../lib/auth'
import { errorMessage, unwrap, useData } from '../lib/data'
import { fetchConnections, recipientOf } from '../lib/queries'
import { timeAgo } from '../lib/format'
import type { Case } from '../lib/types'
import { ButtonLink, Card, EmptyState, ErrorState, IconButton, ListSkeleton, PageHeader, Tabs } from '../components/ui'
import { CaseStatusChip } from '../components/StatusChip'
import { ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/Toast'

export function Dashboard() {
  const { id, profile } = useMe()
  const toast = useToast()
  const [tab, setTab] = useState<'seeking' | 'helping'>(profile.intent === 'solver' ? 'helping' : 'seeking')
  const [del, setDel] = useState<Case | null>(null)

  const cases = useData(
    async () =>
      unwrap(await supabase.from('cases').select('*').eq('owner_id', id).order('created_at', { ascending: false })) as Case[],
    [id],
  )
  const conns = useData(() => fetchConnections(id), [id])

  async function remove() {
    if (!del) return
    try {
      unwrap(await supabase.from('cases').delete().eq('id', del.id))
      toast.success('Deleted.')
      setDel(null)
      cases.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const showTabs = profile.intent === 'both'
  const view = profile.intent === 'seeker' ? 'seeking' : profile.intent === 'solver' ? 'helping' : tab

  const incoming = (conns.data ?? []).filter((c) => c.status === 'pending' && recipientOf(c) === id)
  const active = (conns.data ?? []).filter((c) => c.status === 'accepted')

  return (
    <div>
      <PageHeader
        title={`Hi, ${profile.display_name.split(' ')[0]}`}
        actions={
          <ButtonLink to="/app/new"><Plus size={16} aria-hidden /> New problem</ButtonLink>
        }
      />
      {showTabs && (
        <Tabs
          tabs={[
            { id: 'seeking', label: 'Seeking' },
            { id: 'helping', label: 'Helping' },
          ]}
          value={tab}
          onChange={setTab}
        />
      )}

      {view === 'seeking' ? (
        cases.loading ? (
          <ListSkeleton />
        ) : cases.error ? (
          <ErrorState message={cases.error} onRetry={cases.reload} />
        ) : cases.data!.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No problems yet" action={<ButtonLink to="/app/new">Describe a problem</ButtonLink>} />
        ) : (
          <ul className="space-y-3">
            {cases.data!.map((c) => (
              <li key={c.id}>
                <Card className="flex items-center justify-between gap-3">
                  <Link to={`/app/cases/${c.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.title}</p>
                    <p className="text-xs text-muted">{timeAgo(c.created_at)}</p>
                  </Link>
                  <CaseStatusChip status={c.status} />
                  {c.status === 'draft' && <IconButton icon={Trash2} label="Delete" onClick={() => setDel(c)} />}
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : conns.loading ? (
        <ListSkeleton />
      ) : conns.error ? (
        <ErrorState message={conns.error} onRetry={conns.reload} />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-bold">Requests for you</h2>
            {incoming.length === 0 ? (
              <EmptyState title="No new requests" action={<ButtonLink to="/app/explore" variant="secondary">Browse problems</ButtonLink>} />
            ) : (
              <ul className="space-y-3">
                {incoming.map((c) => (
                  <li key={c.id}>
                    <Card className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{c.case?.title}</p>
                        <p className="text-xs text-muted">From {c.other?.display_name ?? 'someone'}</p>
                      </div>
                      <ButtonLink to="/app/connections" variant="secondary">Review</ButtonLink>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="mb-3 font-bold">Active work</h2>
            {active.length === 0 ? (
              <EmptyState title="Nothing in progress" />
            ) : (
              <ul className="space-y-3">
                {active.map((c) => (
                  <li key={c.id}>
                    <Card className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{c.case?.title}</p>
                        <p className="text-xs text-muted">With {c.other?.display_name ?? 'someone'}</p>
                      </div>
                      <ButtonLink to={`/app/cases/${c.case_id}`} variant="secondary">Open</ButtonLink>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <ConfirmDialog open={!!del} title={`Delete “${del?.title}”?`} onConfirm={remove} onClose={() => setDel(null)} />
    </div>
  )
}

export function Find() {
  const { id } = useMe()
  const q = useData(async () => {
    const rows = unwrap(
      await supabase
        .from('cases')
        .select('id')
        .eq('owner_id', id)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1),
    ) as { id: string }[]
    return rows[0]?.id ?? null
  }, [id])
  if (q.loading) return <ListSkeleton rows={1} />
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  return <Navigate to={q.data ? `/app/cases/${q.data}?tab=matches` : '/app/new'} replace />
}
