import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useSearchParams } from 'react-router'
import { SearchX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { errorMessage, unwrap } from '../../lib/data'
import type { Case, CaseSkill, Match, PersonLite } from '../../lib/types'
import type { ConnectionView } from '../../lib/queries'
import { Button, EmptyState, ErrorState, ListSkeleton } from '../../components/ui'
import { Textarea } from '../../components/forms'
import { Modal } from '../../components/Modal'
import { MatchingScene, type ScenePhase } from '../../components/MatchingScene'
import { SolverCard, type SolverSkill } from '../../components/SolverCard'
import { useToast } from '../../components/Toast'
import { ResourcesForCase } from './ResourcesForCase'

interface Loaded {
  matches: Match[]
  people: Map<string, PersonLite>
  skills: Map<string, SolverSkill[]>
}

async function loadMatches(caseId: string): Promise<Loaded> {
  const matches = unwrap(
    await supabase.from('matches').select('*').eq('case_id', caseId).order('rank'),
  ) as Match[]
  const ids = matches.map((m) => m.profile_id)
  const people = new Map<string, PersonLite>()
  const skills = new Map<string, SolverSkill[]>()
  if (ids.length) {
    const profs = unwrap(
      await supabase.from('profiles').select('id,display_name,headline,city,availability_status,verification').in('id', ids),
    ) as PersonLite[]
    profs.forEach((p) => people.set(p.id, p))
    const us = unwrap(
      await supabase.from('user_skills').select('user_id,proficiency,years,skills(name)').in('user_id', ids),
    ) as unknown as { user_id: string; proficiency: number; years: number | null; skills: { name: string } | null }[]
    us.forEach((r) => {
      const list = skills.get(r.user_id) ?? []
      list.push({ name: r.skills?.name ?? '', proficiency: r.proficiency, years: r.years })
      skills.set(r.user_id, list)
    })
  }
  return { matches, people, skills }
}

export function Matches({
  c,
  skills,
  connections,
  onChanged,
  autoRun,
}: {
  c: Case
  skills: CaseSkill[]
  connections: ConnectionView[]
  onChanged: () => void
  autoRun: boolean
}) {
  const toast = useToast()
  const [, setParams] = useSearchParams()
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<ScenePhase | null>(null)
  const [count, setCount] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [target, setTarget] = useState<PersonLite | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const started = useRef(false)

  const refresh = useCallback(async () => {
    try {
      setLoaded(await loadMatches(c.id))
      setLoadErr(null)
    } catch (e) {
      setLoadErr(errorMessage(e))
    }
  }, [c.id])

  const run = useCallback(async () => {
    setPhase('analyzing')
    setLoaded(null)
    try {
      const n = unwrap(await supabase.rpc('run_matching', { p_case: c.id })) as number
      const data = await loadMatches(c.id)
      setCount(n)
      const wait = (ms: number) => new Promise((r) => setTimeout(r, reduced ? 0 : ms))
      setPhase('discovering')
      await wait(900)
      setPhase('connecting')
      await wait(900)
      setPhase('ranked')
      await wait(900)
      setLoaded(data)
      setPhase(null)
    } catch (e) {
      setPhase('error')
      toast.error(errorMessage(e))
    }
  }, [c.id, reduced, toast])

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (autoRun) {
      setParams({ tab: 'matches' }, { replace: true }) // so a reload does not run matching again
      run()
    } else refresh()
  }, [autoRun, run, refresh, setParams])

  async function send() {
    if (!target) return
    setBusy(true)
    try {
      unwrap(await supabase.rpc('send_request', { p_case: c.id, p_solver: target.id, p_message: msg }))
      toast.success('Request sent.')
      setTarget(null)
      setMsg('')
      onChanged()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const sceneSkills = skills.map((s) => s.skills?.name ?? '')

  if (phase) {
    return (
      <div className="space-y-4 py-4">
        <MatchingScene phase={phase} skills={sceneSkills} candidates={count} />
        {phase === 'error' && (
          <div className="flex justify-center">
            <Button variant="secondary" onClick={run}>Try again</Button>
          </div>
        )}
      </div>
    )
  }

  if (loadErr) return <ErrorState message={loadErr} onRetry={refresh} />
  if (!loaded) return <ListSkeleton />

  const canRun = c.status === 'open' || c.status === 'in_progress'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">{loaded.matches.length} {loaded.matches.length === 1 ? 'match' : 'matches'}</h2>
        {canRun && <Button variant="secondary" onClick={run}>Find again</Button>}
      </div>

      {loaded.matches.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={canRun ? 'No matches yet. Try fewer skills, or allow remote help.' : 'No matches'}
          action={canRun ? <Button onClick={run}>Find solvers</Button> : undefined}
        />
      ) : (
        <ul className="space-y-4">
          {loaded.matches.map((m) => {
            const person = loaded.people.get(m.profile_id)
            if (!person) return null
            const conn = connections.find(
              (x) => x.solver_id === m.profile_id && ['pending', 'clarification_requested', 'accepted'].includes(x.status),
            )
            const declined = connections.some((x) => x.solver_id === m.profile_id && x.status === 'declined')
            return (
              <li key={m.id}>
                <SolverCard
                  match={m}
                  person={person}
                  skills={loaded.skills.get(m.profile_id) ?? []}
                  connection={conn ?? null}
                  declined={declined}
                  onConnect={() => setTarget(person)}
                  onBlocked={refresh}
                />
              </li>
            )
          })}
        </ul>
      )}

      {canRun && <ResourcesForCase caseId={c.id} onSent={onChanged} />}

      <Modal open={!!target} title={`Ask ${target?.display_name} for help`} onClose={() => setTarget(null)}>
        <div className="space-y-4">
          <Textarea label="Message" rows={4} maxLength={500} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Say what you need from them." />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
            <Button loading={busy} onClick={send}>Send request</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
