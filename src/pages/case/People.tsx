import { Link } from 'react-router'
import { Users } from 'lucide-react'
import type { ConnectionView } from '../../lib/queries'
import { Avatar, Card, EmptyState, ErrorState, ListSkeleton } from '../../components/ui'
import { ConnectionStatusChip } from '../../components/StatusChip'

export function People({
  connections,
  loading,
  error,
  reload,
}: {
  connections: ConnectionView[]
  loading: boolean
  error?: string
  reload: () => void
}) {
  if (loading) return <ListSkeleton rows={2} />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (connections.length === 0) return <EmptyState icon={Users} title="No one connected yet" />
  return (
    <ul className="space-y-3">
      {connections.map((c) => (
        <li key={c.id}>
          <Card className="flex items-center gap-3">
            <Avatar name={c.other?.display_name ?? '?'} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.other?.display_name ?? 'Someone'}</p>
              {c.other?.headline && <p className="truncate text-xs text-muted">{c.other.headline}</p>}
            </div>
            <ConnectionStatusChip status={c.status} />
            {['accepted', 'clarification_requested'].includes(c.status) && (
              <Link to={`/app/messages/${c.id}`} className="text-sm font-semibold text-primary">
                Chat
              </Link>
            )}
          </Card>
        </li>
      ))}
    </ul>
  )
}
