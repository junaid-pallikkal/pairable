import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMe } from '../lib/auth'
import { errorMessage, unwrap, useData } from '../lib/data'
import { fetchConnections, recipientOf, type ConnectionView } from '../lib/queries'
import { timeAgo } from '../lib/format'
import { Avatar, Button, Card, EmptyState, ErrorState, ListSkeleton, PageHeader, Tabs } from '../components/ui'
import { ConnectionStatusChip } from '../components/StatusChip'
import { LifecycleScene, type LifecycleState } from '../components/MatchingScene'
import { ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/Toast'

function lifecycle(c: ConnectionView): LifecycleState {
  if (c.status === 'accepted') return c.case?.status === 'resolved' ? 'resolved' : 'accepted'
  if (c.status === 'declined') return 'declined'
  if (c.status === 'pending' || c.status === 'clarification_requested') return 'pending'
  return 'idle'
}

export default function Connections() {
  const { id } = useMe()
  const toast = useToast()
  const [tab, setTab] = useState<'received' | 'sent'>('received')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [cancel, setCancel] = useState<ConnectionView | null>(null)

  const q = useData(async () => {
    await supabase.rpc('expire_connections')
    return fetchConnections(id)
  }, [id])

  // live updates when the other side responds
  useEffect(() => {
    const ch = supabase
      .channel('conns-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, () => q.reload())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function act(c: ConnectionView, action: string, ok: string) {
    setBusyId(c.id)
    try {
      unwrap(await supabase.rpc('transition_connection', { p_id: c.id, p_action: action }))
      toast.success(ok)
      q.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusyId(null)
      setCancel(null)
    }
  }

  const all = q.data ?? []
  const received = all.filter((c) => recipientOf(c) === id)
  const sent = all.filter((c) => c.initiated_by === id)
  const list = tab === 'received' ? received : sent

  return (
    <div>
      <PageHeader title="Connections" />
      <Tabs
        tabs={[
          { id: 'received', label: `Received${received.filter((c) => c.status === 'pending').length ? ` (${received.filter((c) => c.status === 'pending').length})` : ''}` },
          { id: 'sent', label: 'Sent' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {q.loading ? (
        <ListSkeleton />
      ) : q.error ? (
        <ErrorState message={q.error} onRetry={q.reload} />
      ) : list.length === 0 ? (
        <EmptyState icon={Users} title={tab === 'received' ? 'No requests yet' : 'You have not sent any requests'} />
      ) : (
        <ul className="space-y-3">
          {list.map((c) => {
            const isRecipient = recipientOf(c) === id
            const busy = busyId === c.id
            return (
              <li key={c.id}>
                <Card className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.other?.display_name ?? '?'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.other?.display_name ?? 'Someone'}</p>
                      <Link to={`/app/cases/${c.case_id}`} className="block truncate text-sm font-semibold underline">
                        {c.case?.title ?? 'Problem'}
                      </Link>
                      {c.resource && <p className="truncate text-xs text-muted">About: {c.resource.title}</p>}
                    </div>
                    <LifecycleScene state={lifecycle(c)} />
                  </div>
                  {c.message && <p className="rounded-xl bg-surface-2 p-3 text-sm">{c.message}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <ConnectionStatusChip status={c.status} />
                    <span className="text-xs text-muted">{timeAgo(c.updated_at)}</span>
                    <div className="ml-auto flex flex-wrap gap-2">
                      {isRecipient && c.status === 'pending' && (
                        <>
                          <Button loading={busy} onClick={() => act(c, 'accept', 'Accepted. You can chat now.')}>Accept</Button>
                          <Button variant="secondary" disabled={busy} onClick={() => act(c, 'ask', 'Question sent.')}>Ask a question</Button>
                          <Button variant="ghost" disabled={busy} onClick={() => act(c, 'decline', 'Declined.')}>Decline</Button>
                        </>
                      )}
                      {isRecipient && c.status === 'clarification_requested' && (
                        <>
                          <Link to={`/app/messages/${c.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">Open chat</Link>
                          <Button variant="ghost" disabled={busy} onClick={() => act(c, 'decline', 'Declined.')}>Decline</Button>
                        </>
                      )}
                      {!isRecipient && c.status === 'clarification_requested' && (
                        <>
                          <Link to={`/app/messages/${c.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">Answer</Link>
                          <Button variant="secondary" disabled={busy} onClick={() => act(c, 'respond', 'Sent back for review.')}>Done answering</Button>
                        </>
                      )}
                      {!isRecipient && ['pending', 'clarification_requested'].includes(c.status) && (
                        <Button variant="ghost" disabled={busy} onClick={() => setCancel(c)}>Cancel request</Button>
                      )}
                      {c.status === 'accepted' && (
                        <>
                          <Link to={`/app/messages/${c.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">Chat</Link>
                          <Link to={`/app/cases/${c.case_id}?tab=work`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">Work</Link>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
      <ConfirmDialog
        open={!!cancel}
        title="Cancel this request?"
        confirmLabel="Cancel request"
        onClose={() => setCancel(null)}
        onConfirm={() => cancel && act(cancel, 'cancel', 'Request cancelled.')}
      />
    </div>
  )
}
