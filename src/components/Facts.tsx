import { Award, IndianRupee, Timer, Users } from 'lucide-react'
import { estimateFor, parseFacts, rupees, type Fact } from '../lib/facts'

const ICON = { Price: IndianRupee, Speed: Timer, Team: Users, 'Known for': Award } as const

/**
 * Price, speed, team and style, read from the helper's own words, plus what the job would cost and take.
 * `compact` shows just price and speed (for small cards).
 */
export function Facts({ text, need, compact = false }: { text?: string | null; need?: string | null; compact?: boolean }) {
  const parsed = parseFacts(text)
  if (parsed.facts.length === 0) return null
  const est = compact ? null : estimateFor(parsed, need)
  const shown: Fact[] = compact ? parsed.facts.filter((f) => f.label === 'Price' || f.label === 'Speed') : parsed.facts
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-1.5">
        {shown.map((f) => {
          const I = ICON[f.label]
          return (
            <li key={f.label} className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 py-1 text-xs">
              <I size={12} aria-hidden />
              <span className="sr-only">{f.label}:</span>
              <span className="font-semibold">{f.value}</span>
            </li>
          )
        })}
      </ul>
      {est && (
        <p className="rounded-2xl bg-accent-soft px-3 py-2 text-xs font-semibold">
          For your {est.qty} trees: about {rupees(est.cost)}
          {est.days ? `, around ${est.days} ${est.days === 1 ? 'day' : 'days'}` : ''}
        </p>
      )}
    </div>
  )
}
