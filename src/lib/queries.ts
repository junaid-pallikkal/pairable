import { supabase } from './supabase'
import { unwrap } from './data'
import type { Case, CaseSkill, Connection, PersonLite } from './types'

export async function fetchPeople(ids: string[]): Promise<Map<string, PersonLite>> {
  const uniq = [...new Set(ids)].filter(Boolean)
  const map = new Map<string, PersonLite>()
  if (!uniq.length) return map
  const rows = unwrap(
    await supabase.from('profiles').select('*').in('id', uniq),
  ) as PersonLite[]
  rows.forEach((r) => map.set(r.id, r))
  return map
}

export interface ConnectionView extends Connection {
  case: { id: string; title: string; status: Case['status'] } | null
  other: PersonLite | null
  resource: { id: string; title: string } | null
}

export async function fetchConnections(uid: string): Promise<ConnectionView[]> {
  const rows = unwrap(
    await supabase
      .from('connections')
      .select('*, case:cases(id,title,status), resource:resources(id,title)')
      .or(`seeker_id.eq.${uid},solver_id.eq.${uid}`)
      .order('updated_at', { ascending: false }),
  ) as (Connection & { case: ConnectionView['case']; resource: ConnectionView['resource'] })[]
  const people = await fetchPeople(rows.map((r) => (r.seeker_id === uid ? r.solver_id : r.seeker_id)))
  return rows.map((r) => ({ ...r, other: people.get(r.seeker_id === uid ? r.solver_id : r.seeker_id) ?? null }))
}

export function recipientOf(c: Connection): string {
  return c.initiated_by === c.seeker_id ? c.solver_id : c.seeker_id
}

export async function fetchCase(id: string): Promise<{ c: Case; skills: CaseSkill[] }> {
  const c = unwrap(await supabase.from('cases').select('*').eq('id', id).maybeSingle()) as Case | null
  if (!c) throw new Error('not found')
  const skills = unwrap(
    await supabase.from('case_skills').select('skill_id,importance,skills(name)').eq('case_id', id),
  ) as unknown as CaseSkill[]
  return { c, skills }
}
