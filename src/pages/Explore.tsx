import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Compass, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errorMessage, unwrap, useData } from '../lib/data'
import { budgetText, placeText, timeAgo, urgencyLabel } from '../lib/format'
import type { PublicCase } from '../lib/types'
import { Button, Card, Chip, EmptyState, ErrorState, ListSkeleton, PageHeader, SkillChips } from '../components/ui'
import { Checkbox, Textarea } from '../components/forms'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { useNavigate } from 'react-router'
import { ReportButton } from '../components/Safety'

export default function Explore() {
  const { session, profile } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [mine, setMine] = useState(true)
  const [target, setTarget] = useState<PublicCase | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const cases = useData(async () => {
    return unwrap(
      await supabase.from('public_cases').select('*').order('created_at', { ascending: false }).limit(100),
    ) as PublicCase[]
  }, [])

  const mySkills = useData(async () => {
    if (!session) return new Set<string>()
    const rows = unwrap(await supabase.from('user_skills').select('skill_id').eq('user_id', session.user.id)) as {
      skill_id: string
    }[]
    return new Set(rows.map((r) => r.skill_id))
  }, [session?.user.id])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (cases.data ?? []).filter((c) => {
      if (t && !(c.title + ' ' + c.description + ' ' + c.skills.join(' ')).toLowerCase().includes(t)) return false
      if (mine && session && mySkills.data && mySkills.data.size > 0)
        return c.skill_ids.some((s) => mySkills.data!.has(s))
      return true
    })
  }, [cases.data, q, mine, session, mySkills.data])

  async function offer() {
    if (!target) return
    setBusy(true)
    try {
      unwrap(await supabase.rpc('send_request', { p_case: target.id, p_solver: session!.user.id, p_message: msg }))
      toast.success('Request sent.')
      setTarget(null)
      setMsg('')
      nav('/app/connections')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const canHelp = !!session && !!profile && profile.intent !== 'seeker'

  return (
    <div className={session ? '' : 'mx-auto max-w-5xl px-4 py-10'}>
      <PageHeader title="Explore problems" />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label className="sr-only" htmlFor="explore-q">Search</label>
        <input
          id="explore-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search problems or skills"
          className="min-h-11 w-full max-w-sm rounded-xl border border-line bg-surface px-3 text-sm placeholder:text-muted focus:border-primary"
        />
        {session && (mySkills.data?.size ?? 0) > 0 && (
          <Checkbox label="Only my skills" checked={mine} onChange={(e) => setMine(e.target.checked)} />
        )}
      </div>

      {cases.loading ? (
        <ListSkeleton />
      ) : cases.error ? (
        <ErrorState message={cases.error} onRetry={cases.reload} />
      ) : list.length === 0 ? (
        <EmptyState icon={Compass} title="No public problems yet" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.map((c) => (
            <li key={c.id}>
              <Card className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{c.title}</h2>
                  {c.urgency && <Chip tone={c.urgency === 'urgent' ? 'danger' : 'neutral'}>{urgencyLabel[c.urgency]}</Chip>}
                </div>
                <p className="line-clamp-3 text-sm text-muted">{c.description}</p>
                <SkillChips names={c.skills} />
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} aria-hidden /> {placeText(c.city, c.state, c.remote_ok)}
                  </span>
                  <span>{[budgetText(c.budget_min, c.budget_max), timeAgo(c.created_at)].filter(Boolean).join(' · ')}</span>
                </div>
                {!session ? (
                  <Link to="/sign-in" state={{ from: '/app/explore' }} className="text-sm font-semibold text-primary">
                    Sign in to help
                  </Link>
                ) : canHelp ? (
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => setTarget(c)}>I can help</Button>
                    <ReportButton type="case" id={c.id} className="ml-auto" />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!target} title="Offer to help" onClose={() => setTarget(null)}>
        <div className="space-y-4">
          <Textarea label="Message" value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} maxLength={500} placeholder="How can you help?" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
            <Button loading={busy} onClick={offer}>Send</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
