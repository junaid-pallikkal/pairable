import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { loadSkills, unwrap, errorMessage } from '../lib/data'
import type { Skill } from '../lib/types'
import { useToast } from './Toast'

export interface SkillSel {
  id: string
  name: string
  level: number
  years?: number | null
}

export function SkillPicker({
  value,
  onChange,
  levels,
  withYears,
  label = 'Add a skill',
}: {
  value: SkillSel[]
  onChange: (v: SkillSel[]) => void
  levels: { value: number; label: string }[]
  withYears?: boolean
  label?: string
}) {
  const toast = useToast()
  const [all, setAll] = useState<Skill[]>([])
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadSkills().then(setAll).catch(() => toast.error("Couldn't load skills."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chosen = useMemo(() => new Set(value.map((v) => v.id)), [value])
  const term = q.trim().toLowerCase()
  const options = useMemo(
    () => (term ? all.filter((s) => !chosen.has(s.id) && s.name.toLowerCase().includes(term)).slice(0, 6) : []),
    [all, chosen, term],
  )
  const exact = all.some((s) => s.name.toLowerCase() === term)
  const defaultLevel = levels[Math.min(1, levels.length - 1)].value

  function add(s: Skill) {
    onChange([...value, { id: s.id, name: s.name, level: defaultLevel, years: null }])
    setQ('')
  }

  async function create() {
    setAdding(true)
    try {
      const row = unwrap(
        await supabase
          .from('skills')
          .insert({ name: q.trim(), is_approved: false })
          .select('id,name,category_id')
          .single(),
      ) as Skill
      const fresh = await loadSkills(true)
      setAll(fresh)
      add(row)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <label htmlFor="skill-search" className="mb-1.5 block text-sm font-semibold">
          {label}
        </label>
        <input
          id="skill-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search, e.g. Python"
          autoComplete="off"
          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm placeholder:text-muted focus:border-primary"
        />
        {term && (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-float">
            {options.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => add(s)}
                  className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-surface-2"
                >
                  <Plus size={14} aria-hidden /> {s.name}
                </button>
              </li>
            ))}
            {!exact && term.length >= 2 && (
              <li>
                <button
                  type="button"
                  disabled={adding}
                  onClick={create}
                  className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-semibold text-primary hover:bg-surface-2"
                >
                  <Plus size={14} aria-hidden /> Add “{q.trim()}”
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
              <select
                aria-label={`Level for ${s.name}`}
                value={s.level}
                onChange={(e) =>
                  onChange(value.map((v) => (v.id === s.id ? { ...v, level: Number(e.target.value) } : v)))
                }
                className="min-h-9 rounded-xl border border-line bg-surface px-2 text-sm"
              >
                {levels.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              {withYears && (
                <input
                  aria-label={`Years of ${s.name}`}
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  placeholder="Years"
                  value={s.years ?? ''}
                  onChange={(e) =>
                    onChange(
                      value.map((v) =>
                        v.id === s.id ? { ...v, years: e.target.value === '' ? null : Number(e.target.value) } : v,
                      ),
                    )
                  }
                  className="min-h-9 w-20 rounded-xl border border-line bg-surface px-2 text-sm"
                />
              )}
              <button
                type="button"
                aria-label={`Remove ${s.name}`}
                onClick={() => onChange(value.filter((v) => v.id !== s.id))}
                className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-surface-2"
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const PROFICIENCY = [
  { value: 1, label: 'Basic' },
  { value: 2, label: 'Good' },
  { value: 3, label: 'Strong' },
  { value: 4, label: 'Expert' },
]
export const IMPORTANCE = [
  { value: 1, label: 'Nice to have' },
  { value: 2, label: 'Important' },
  { value: 3, label: 'Must have' },
]
