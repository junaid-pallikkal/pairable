import { useSearchParams, useParams, Link } from 'react-router'
import { ArrowLeft, FileQuestion } from 'lucide-react'
import { useMe } from '../../lib/auth'
import { fetchCase, fetchConnections } from '../../lib/queries'
import { useData } from '../../lib/data'
import { Blocked, EmptyState, ErrorState, ListSkeleton, Tabs } from '../../components/ui'
import { CaseStatusChip } from '../../components/StatusChip'
import { Overview } from './Overview'
import { Matches } from './Matches'
import { Work } from './Work'
import { People } from './People'

type TabId = 'overview' | 'matches' | 'work' | 'people'

export default function CaseDetail() {
  const { id: caseId = '' } = useParams()
  const { id: uid } = useMe()
  const [params, setParams] = useSearchParams()

  const data = useData(() => fetchCase(caseId), [caseId])
  const conns = useData(async () => (await fetchConnections(uid)).filter((c) => c.case_id === caseId), [uid, caseId])

  if (data.loading) return <ListSkeleton rows={2} />
  if (data.error || !data.data)
    return data.error && !data.error.includes('not found') ? (
      <ErrorState message={data.error} onRetry={data.reload} />
    ) : (
      <EmptyState icon={FileQuestion} title="Problem not found" action={<Link to="/app" className="font-semibold text-primary">Back to dashboard</Link>} />
    )

  const { c, skills } = data.data
  const isOwner = c.owner_id === uid
  const myConn = (conns.data ?? []).find((x) => x.solver_id === uid && ['accepted', 'closed'].includes(x.status))
  const isParticipant = isOwner || !!myConn

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(isOwner ? [{ id: 'matches' as const, label: 'Matches' }] : []),
    { id: 'work', label: 'Work' },
    { id: 'people', label: 'People' },
  ]
  const raw = (params.get('tab') as TabId) ?? 'overview'
  const tab = tabs.some((t) => t.id === raw) ? raw : 'overview'

  return (
    <div>
      <Link to="/app" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft size={16} aria-hidden /> Back
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{c.title}</h1>
        <CaseStatusChip status={c.status} />
      </div>
      <Tabs tabs={tabs} value={tab} onChange={(t) => setParams({ tab: t })} />

      {tab === 'overview' && (
        <Overview c={c} skills={skills} isOwner={isOwner} isParticipant={isParticipant} onChanged={data.reload} />
      )}
      {tab === 'matches' && isOwner && <Matches c={c} skills={skills} connections={conns.data ?? []} onChanged={() => { conns.reload(); data.reload() }} autoRun={params.get('run') === '1'} />}
      {tab === 'work' &&
        (isParticipant ? (
          <Work c={c} />
        ) : (
          <Blocked title="Work opens after your request is accepted" />
        ))}
      {tab === 'people' && <People connections={conns.data ?? []} loading={conns.loading} error={conns.error} reload={conns.reload} />}
    </div>
  )
}
