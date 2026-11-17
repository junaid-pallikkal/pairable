import { supabase } from './supabase'
import { unwrap } from './data'
import { fetchPeople } from './queries'
import { loadProfileMedia } from './media'
import type { Match } from './types'
import type { DeckItem } from '../components/MatchDeck'

export interface TextMatchRow extends Match {
  decision: 'liked' | 'passed' | null
  hits: string[]
}

/** Matches of a problem written in plain text, best first, with each helper's profile. */
export async function fetchTextMatches(caseId: string): Promise<{ rows: TextMatchRow[]; items: DeckItem[] }> {
  const rows = unwrap(await supabase.from('matches').select('*').eq('case_id', caseId).order('rank')) as TextMatchRow[]
  const people = await fetchPeople(rows.map((r) => r.profile_id))
  const media = await loadProfileMedia(rows.map((r) => r.profile_id))
  const items: DeckItem[] = rows
    .filter((r) => !r.decision && people.has(r.profile_id))
    .map((r) => ({
      matchId: r.id,
      person: people.get(r.profile_id)!,
      hits: (r.breakdown as unknown as { hits?: string[] }).hits ?? [],
      explanation: r.explanation,
      media: media.get(r.profile_id) ?? [],
    }))
  return { rows, items }
}
