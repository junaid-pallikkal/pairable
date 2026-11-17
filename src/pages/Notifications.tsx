import { useEffect } from 'react'
import { Link } from 'react-router'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMe } from '../lib/auth'
import { errorMessage, unwrap, useData } from '../lib/data'
import { timeAgo } from '../lib/format'
import type { Notification } from '../lib/types'
import { Button, EmptyState, ErrorState, ListSkeleton, PageHeader } from '../components/ui'
import { useToast } from '../components/Toast'

export default function Notifications() {
  const { id } = useMe()
  const toast = useToast()
  const q = useData(
    async () =>
      unwrap(
        await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
      ) as Notification[],
    [id],
  )

  useEffect(() => {
    const ch = supabase
      .channel('notif-page-' + id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${id}` }, () => q.reload())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function markAll() {
    try {
      unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null))
      q.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function markOne(n: Notification) {
    if (n.read_at) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
  }

  const hasUnread = (q.data ?? []).some((n) => !n.read_at)

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Notifications"
        actions={hasUnread ? <Button variant="secondary" onClick={markAll}>Mark all read</Button> : undefined}
      />
      {q.loading ? (
        <ListSkeleton />
      ) : q.error ? (
        <ErrorState message={q.error} onRetry={q.reload} />
      ) : q.data!.length === 0 ? (
        <EmptyState icon={Bell} title="Nothing new" />
      ) : (
        <ul className="space-y-2">
          {q.data!.map((n) => (
            <li key={n.id}>
              <Link
                to={n.link ?? '/app'}
                onClick={() => markOne(n)}
                className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line p-4 ${n.read_at ? 'bg-surface' : 'bg-accent-soft'}`}
              >
                <span className={n.read_at ? '' : 'font-semibold'}>{n.title}</span>
                <span className="shrink-0 text-xs text-muted">{timeAgo(n.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
