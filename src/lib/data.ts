import { useCallback, useEffect, useRef, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Category, Skill } from './types'

/** Turns a Supabase result into data or a friendly error. */
export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new Error(friendlyError(res.error.message))
  return res.data as T
}

/** Never show raw database text. Known short messages from our own functions pass through. */
const KNOWN = [
  'Add at least one skill',
  'Publish the problem first',
  'Too many open requests. Wait for replies.',
  'This person declined before',
  'This person is not available',
  'Turn on helping in your profile first',
  'Message limit reached until the request is accepted',
  'That action is not possible now',
  'This problem is not open',
  'This problem cannot be reopened',
  'Feedback opens after resolution',
  'You cannot invite yourself',
]
export function friendlyError(raw: string): string {
  const hit = KNOWN.find((k) => raw.includes(k))
  if (hit) return hit
  if (raw.includes('duplicate key')) return 'This already exists.'
  if (raw.toLowerCase().includes('network') || raw.includes('Failed to fetch'))
    return 'No connection. Check your internet and try again.'
  return "Couldn't complete that. Please try again."
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? friendlyError(e.message) : "Couldn't complete that. Please try again."
}

export function useData<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let alive = true
    setLoading(true)
    fnRef
      .current()
      .then((d) => {
        if (alive) {
          setData(d)
          setError(undefined)
        }
      })
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}

let skillCache: Skill[] | null = null
let categoryCache: Category[] | null = null

export async function loadSkills(force = false): Promise<Skill[]> {
  if (skillCache && !force) return skillCache
  skillCache = unwrap(await supabase.from('skills').select('id,name,category_id').order('name'))
  return skillCache
}
export async function loadCategories(): Promise<Category[]> {
  if (categoryCache) return categoryCache
  categoryCache = unwrap(await supabase.from('categories').select('id,name').order('sort'))
  return categoryCache
}
