import { useCallback, useState } from 'react'
import { supabase } from './supabase'
import { unwrap } from './data'

/** One row of "problems that fit me" (dashboard) */
export interface ProblemRow {
  id: string
  title: string
  summary: string
  city: string | null
  remote_ok: boolean
  created_at: string
  hits: string[]
  waiting: boolean
  score: number
}

export interface ProblemItem {
  type: 'problem'
  key: string
  id: string
  title: string
  summary: string
  description: string
  city: string | null
  remote_ok: boolean
  created_at: string
  hits: string[]
  fits: boolean
  waiting: boolean
  offers: number
}

export interface HelperItem {
  type: 'helper'
  key: string
  id: string
  display_name: string
  headline: string | null
  about: string
  city: string | null
  availability_status: 'open' | 'limited' | 'unavailable'
  verification: string | null
  is_demo: boolean
  updated_at: string | null
  hits: string[]
  fits: boolean
}

export type ExploreItem = ProblemItem | HelperItem
export type Sort = 'new' | 'fit' | 'waiting'

interface PublicCaseRow {
  id: string
  title: string
  description: string
  summary: string | null
  city: string | null
  remote_ok: boolean
  created_at: string
}

function fromPublic(r: PublicCaseRow): ProblemItem {
  return {
    type: 'problem',
    key: 'p:' + r.id,
    id: r.id,
    title: r.title,
    summary: r.summary ?? r.description.slice(0, 280),
    description: r.description,
    city: r.city,
    remote_ok: r.remote_ok,
    created_at: r.created_at,
    hits: [],
    fits: false,
    waiting: false,
    offers: 0,
  }
}

/** Signed-in people get search and "best for me". Visitors get the plain public list. */
export async function loadProblems(signedIn: boolean, query: string, sort: Sort): Promise<ProblemItem[]> {
  if (signedIn) {
    const { data, error } = await supabase.rpc('explore_problems', { p_query: query, p_sort: sort, p_limit: 60 })
    if (!error) {
      return (data as Omit<ProblemItem, 'type' | 'key'>[]).map((r) => ({ ...r, type: 'problem' as const, key: 'p:' + r.id }))
    }
    // the new database functions are not installed yet: fall back to the public list
  }
  const rows = unwrap(
    await supabase.from('public_cases').select('*').order('created_at', { ascending: false }).limit(60),
  ) as PublicCaseRow[]
  const q = query.trim().toLowerCase()
  return rows.filter((r) => !q || (r.title + ' ' + r.description).toLowerCase().includes(q)).map(fromPublic)
}

export async function loadHelpers(query: string, sort: Sort): Promise<HelperItem[]> {
  const { data, error } = await supabase.rpc('explore_helpers', { p_query: query, p_sort: sort === 'waiting' ? 'new' : sort, p_limit: 60 })
  if (error) throw new Error('helpers')
  return (data as Omit<HelperItem, 'type' | 'key'>[]).map((r) => ({ ...r, type: 'helper' as const, key: 'h:' + r.id }))
}

const STOP = new Set(
  ('about above after again also because been before being between both could does doing down during each from have having here into just like more most much need needs only other over really same should some such than that their them then there these they this those through under until very want wants well were what when where which while will with would your help helps looking someone anyone person people please thank thanks know make good best able also can find using used use get got our out has had his her she him who why how too any all one two few new old own way ways lot lots many may might must now off once own per then both')
    .split(' '),
)

/** Popular words in what is on screen right now: real topics, not a made-up list. */
export function topicsFrom(items: ExploreItem[], max = 10): string[] {
  const count = new Map<string, number>()
  for (const it of items) {
    const text = it.type === 'problem' ? it.title + ' ' + it.summary : (it.headline ?? '') + ' ' + it.about
    const seen = new Set<string>()
    for (const w of text.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
      if (STOP.has(w) || seen.has(w)) continue
      seen.add(w)
      count.set(w, (count.get(w) ?? 0) + 1)
    }
  }
  return [...count.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w)
}

const SAVED_KEY = 'repair_saved'

/** Things you have saved to look at later. Stored only in this browser. */
export function useSaved() {
  const [saved, setSaved] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  const toggle = useCallback((key: string) => {
    setSaved((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])
  return { saved, toggle }
}
