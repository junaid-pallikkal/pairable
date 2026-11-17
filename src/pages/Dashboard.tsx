import { useState } from 'react'
import { Link } from 'react-router'
import { BellRing, Check, Heart, MessageCircleQuestion, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMe } from '../lib/auth'
import { errorMessage, unwrap, useData } from '../lib/data'
import { fetchConnections, recipientOf, type ConnectionView } from '../lib/queries'
import { timeAgo } from '../lib/format'
import type { Case } from '../lib/types'
import { Button, ButtonLink, Card, Chip, EmptyState, ErrorState, IconButton, ListSkeleton, Tabs } from '../components/ui'
import { CaseStatusChip } from '../components/StatusChip'
import { ConfirmDialog } from '../components/Modal'
import { Mascot } from '../components/Mascot'
import { PersonCard } from '../components/MatchDeck'
import { useToast } from '../components/Toast'
import type { ProblemRow } from '../lib/explore'

function Banner({ hello, line, cta, to }: { hello: string; line: string; cta: string; to: string }) {
  return (
    <div className="relative mb-8 overflow-hidden rounded-[2rem] bg-fg p-7 text-bg md:p-9">
      <div className="absolute -left-10 -top-12 h-48 w-48 rounded-full bg-accent/30 blur-3xl" aria-hidden />
      <div className="absolute -bottom-16 right-24 h-48 w-48 rounded-full bg-accent/20 blur-3xl" aria-hidden />
      <div className="relative max-w-md">
        <p className="text-sm text-white/70">Hello,</p>
        <h1 className="text-4xl font-bold tracking-tight">{hello}</h1>
        <p className="mt-2 text-sm text-white/70">{line}</p>
        <ButtonLink to={to} className="mt-6 !bg-accent !text-black">
          <Plus size={16} aria-hidden /> {cta}
        </ButtonLink>
      </div>
      <Mascot className="pointer-events-none absolute -bottom-8 right-4 hidden h-56 w-auto sm:block" />
    </div>
  )
}

/** What the seeker should do next, for one problem. */
function caseState(c: Case, undecided: number, conns: ConnectionView[]): { chip: React.ReactNode; action?: { to: string; label: string } } {
  const mine = conns.filter((x) => x.case_id === c.id)
  const accepted = mine.find((x) => x.status === 'accepted')
  const pending = mine.find((x) => ['pending', 'clarification_requested'].includes(x.status))
  if (c.status === 'resolved' || c.status === 'closed') return { chip: <CaseStatusChip status={c.status} /> }
  if (c.status === 'resolution_proposed') return { chip: <CaseStatusChip status={c.status} />, action: { to: `/app/cases/${c.id}`, label: 'Confirm' } }
  if (accepted) return { chip: <Chip tone="success" icon={Check}>In progress with {accepted.other?.display_name ?? 'someone'}</Chip>, action: { to: `/app/cases/${c.id}?tab=work`, label: 'Open' } }
  if (pending) return { chip: <Chip tone="warning" icon={MessageCircleQuestion}>Waiting for {pending.other?.display_name ?? 'a reply'}</Chip> }
  if (undecided > 0) return { chip: <Chip tone="info" icon={Heart}>{undecided} {undecided === 1 ? 'match' : 'matches'} ready</Chip>, action: { to: `/app/cases/${c.id}?tab=matches`, label: 'See matches' } }
  if (c.status === 'open') return { chip: <Chip tone="neutral" icon={BellRing}>Waiting for a match. I’ll notify you.</Chip> }
  return { chip: <CaseStatusChip status={c.status} /> }
}

function SeekerView() {
  const { id } = useMe()
  const toast = useToast()
  const [del, setDel] = useState<Case | null>(null)
  const cases = useData(
    async () => unwrap(await supabase.from('cases').select('*').eq('owner_id', id).order('created_at', { ascending: false })) as (Case & { kind?: string })[],
    [id],
  )
  const decisions = useData(
    async () => unwrap(await supabase.from('matches').select('case_id,decision')) as { case_id: string; decision: string | null }[],
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

  const loading = cases.loading || decisions.loading || conns.loading
  const err = cases.error || decisions.error || conns.error
  const undecidedFor = (cid: string) => (decisions.data ?? []).filter((d) => d.case_id === cid && !d.decision).length

  if (loading) return <ListSkeleton />
  if (err) return <ErrorState message={err} onRetry={() => { cases.reload(); decisions.reload(); conns.reload() }} />
  if (cases.data!.length === 0)
    return (
      <EmptyState
        icon={Sparkles}
        title="Tell Pip what you need and I’ll find the right person."
        action={<ButtonLink to="/app/ask">Tell Pip</ButtonLink>}
      />
    )

  const ready = cases.data!.reduce((n, c) => n + (c.status === 'open' ? undecidedFor(c.id) : 0), 0)
  return (
    <div className="space-y-6">
      {ready > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 !bg-accent">
          <p className="font-bold text-black">{ready} possible {ready === 1 ? 'match is' : 'matches are'} waiting for you.</p>
        </Card>
      )}
      <ul className="space-y-3">
        {cases.data!.map((c) => {
          const s = caseState(c, undecidedFor(c.id), conns.data ?? [])
          return (
            <li key={c.id}>
              <Card className="flex flex-wrap items-center gap-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-float">
                <Link to={`/app/cases/${c.id}`} className="min-w-0 flex-1 basis-48">
                  <p className="line-clamp-2 font-semibold">{c.title}</p>
                  <p className="text-xs text-muted">{timeAgo(c.created_at)}</p>
                </Link>
                {s.chip}
                {s.action && <ButtonLink to={s.action.to} className="!min-h-10">{s.action.label}</ButtonLink>}
                {c.status === 'draft' && <IconButton icon={Trash2} label="Delete" onClick={() => setDel(c)} />}
              </Card>
            </li>
          )
        })}
      </ul>
      <ConfirmDialog open={!!del} title={`Delete “${del?.title}”?`} onConfirm={remove} onClose={() => setDel(null)} />
    </div>
  )
}

function HelperView() {
  const { id, profile } = useMe()
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const conns = useData(() => fetchConnections(id), [id])
  const fits = useData(async () => {
    const { data, error } = await supabase.rpc('problems_for_helper', { p_query: '' })
    return error ? ([] as ProblemRow[]) : ((data ?? []) as ProblemRow[]).slice(0, 3)
  }, [id])

  async function act(c: ConnectionView, action: string, ok: string) {
    setBusyId(c.id)
    try {
      unwrap(await supabase.rpc('transition_connection', { p_id: c.id, p_action: action }))
      toast.success(ok)
      conns.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const incoming = (conns.data ?? []).filter((c) => c.status === 'pending' && recipientOf(c) === id)
  const active = (conns.data ?? []).filter((c) => c.status === 'accepted')

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-bold">Requests for you {incoming.length > 0 && <span className="text-muted">({incoming.length})</span>}</h2>
          {conns.loading ? (
            <ListSkeleton rows={1} />
          ) : conns.error ? (
            <ErrorState message={conns.error} onRetry={conns.reload} />
          ) : incoming.length === 0 ? (
            <EmptyState icon={BellRing} title="No requests yet. I’ll notify you when someone needs you." />
          ) : (
            <ul className="space-y-3">
              {incoming.map((c) => (
                <li key={c.id}>
                  <Card className="space-y-3">
                    <div>
                      <p className="font-semibold">{c.case?.title}</p>
                      <p className="text-xs text-muted">From {c.other?.display_name ?? 'someone'} · {timeAgo(c.created_at)}</p>
                    </div>
                    {c.message && <p className="rounded-2xl bg-surface-2 p-3 text-sm">{c.message}</p>}
                    <div className="flex flex-wrap gap-2">
                      <Button loading={busyId === c.id} onClick={() => act(c, 'accept', 'Accepted. You can chat now.')}>
                        <Check size={16} aria-hidden /> Accept
                      </Button>
                      <Button variant="secondary" disabled={busyId === c.id} onClick={() => act(c, 'ask', 'Question sent.')}>Ask a question</Button>
                      <Button variant="ghost" disabled={busyId === c.id} onClick={() => act(c, 'decline', 'Declined.')}>
                        <X size={16} aria-hidden /> Decline
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">Problems that fit you</h2>
          {fits.loading ? (
            <ListSkeleton rows={1} />
          ) : (fits.data ?? []).length === 0 ? (
            <EmptyState title={profile.offer_text ? 'Nothing fits yet. I’ll notify you.' : 'Tell Pip what you offer to see problems that fit you.'} />
          ) : (
            <ul className="space-y-3">
              {fits.data!.map((p) => (
                <li key={p.id}>
                  <Card className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="line-clamp-2 font-semibold">{p.title}</p>
                      {p.hits.length > 0 && <p className="text-xs text-muted">Fits: {p.hits.join(', ')}</p>}
                    </div>
                    {p.waiting && <Chip tone="info" icon={BellRing}>Waiting</Chip>}
                  </Card>
                </li>
              ))}
              <li><ButtonLink to="/app/explore" variant="secondary">See all problems</ButtonLink></li>
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">Active work</h2>
          {active.length === 0 ? (
            <EmptyState title="Nothing in progress." />
          ) : (
            <ul className="space-y-3">
              {active.map((c) => (
                <li key={c.id}>
                  <Card className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="line-clamp-2 font-semibold">{c.case?.title}</p>
                      <p className="text-xs text-muted">With {c.other?.display_name ?? 'someone'}</p>
                    </div>
                    <ButtonLink to={`/app/messages/${c.id}`} variant="secondary" className="!min-h-10">Chat</ButtonLink>
                    <ButtonLink to={`/app/cases/${c.case_id}?tab=work`} className="!min-h-10">Open</ButtonLink>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside>
        <h2 className="mb-3 text-lg font-bold">Your profile</h2>
        {profile.offer_text ? (
          <>
            <PersonCard person={profile} />
            <Link to="/app/offer" className="mt-4 inline-block text-sm font-semibold underline">Change what I offer</Link>
          </>
        ) : (
          <Card className="space-y-3 !bg-accent-soft">
            <p className="font-semibold">You don’t have a profile yet.</p>
            <p className="text-sm text-muted">Tell Pip what you can offer. It takes one message.</p>
            <ButtonLink to="/app/offer">Tell Pip about me</ButtonLink>
          </Card>
        )}
      </aside>
    </div>
  )
}

export function Dashboard() {
  const { profile } = useMe()
  const [tab, setTab] = useState<'need' | 'help'>(profile.intent === 'solver' ? 'help' : 'need')
  const first = profile.display_name.split(' ')[0]
  const view = profile.intent === 'seeker' ? 'need' : profile.intent === 'solver' ? 'help' : tab

  return (
    <div>
      {view === 'need' ? (
        <Banner hello={first} line="Tell Pip what you need. I’ll find the right person." cta="Tell Pip a problem" to="/app/ask" />
      ) : (
        <Banner
          hello={first}
          line={profile.offer_text ? 'Your profile is live. Here is what needs you.' : 'Tell Pip what you can offer and people will find you.'}
          cta={profile.offer_text ? 'Find problems to help with' : 'Create my profile'}
          to={profile.offer_text ? '/app/explore' : '/app/offer'}
        />
      )}
      {profile.intent === 'both' && (
        <Tabs
          tabs={[
            { id: 'need', label: 'I need help' },
            { id: 'help', label: 'I can help' },
          ]}
          value={tab}
          onChange={setTab}
        />
      )}
      {view === 'need' ? <SeekerView /> : <HelperView />}
    </div>
  )
}

