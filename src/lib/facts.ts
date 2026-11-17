/**
 * Reads the useful facts a helper wrote about themselves (price, speed, team, style) straight from their own words,
 * so matching cards can be compared. Nothing is invented: if they did not write it, it is not shown.
 */

export interface Fact {
  label: 'Price' | 'Speed' | 'Team' | 'Known for'
  value: string
}

export interface ParsedFacts {
  facts: Fact[]
  /** price per unit, for sorting and estimates */
  price: { amount: number; unit: string } | null
  /** how many units they do in a period, for sorting and estimates */
  speed: { amount: number; period: 'day' | 'hour' } | null
}

const num = (s: string) => Number(s.replace(/,/g, ''))

export function parseFacts(text: string | null | undefined): ParsedFacts {
  const out: ParsedFacts = { facts: [], price: null, speed: null }
  if (!text) return out
  const t = text.replace(/\s+/g, ' ')

  const price = t.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)\s*(?:\/|per|a|each)\s*([a-z]+)/i)
  if (price) {
    out.price = { amount: num(price[1]), unit: price[2].toLowerCase().replace(/s$/, '') }
    out.facts.push({ label: 'Price', value: `₹${price[1]} per ${out.price.unit}` })
  }

  const speed = t.match(/(\d{1,4})\s*(?:coconut\s+)?(trees?|palms?|houses?|jobs?|items?)?\s*(?:a|per|each|in a)\s+(day|hour)/i)
  if (speed) {
    out.speed = { amount: num(speed[1]), period: speed[3].toLowerCase() as 'day' | 'hour' }
    const unit = speed[2] ? speed[2].toLowerCase().replace(/s$/, '') + 's' : ''
    out.facts.push({ label: 'Speed', value: `About ${speed[1]} ${unit ? unit + ' ' : ''}a ${out.speed.period}`.replace(/\s+/g, ' ') })
  }

  const team = t.match(/team of (two|three|four|five|six|\d+)/i)
  if (team) out.facts.push({ label: 'Team', value: `Team of ${team[1].toLowerCase()}` })

  const tags: string[] = []
  const years = t.match(/(\d{1,2})\s*years/i)
  if (years) tags.push(`${years[1]} years`)
  if (/careful|gentle|no damage|without damage|don.t damage/i.test(t)) tags.push('Careful work')
  if (/clean(s|ing)?\b[^.]{0,20}(crown|up|dry)|stack/i.test(t)) tags.push('Cleans up')
  if (/fastest|very fast|quick|same day|one morning/i.test(t)) tags.push('Fast')
  if (/machine/i.test(t)) tags.push('Uses a machine')
  if (tags.length) out.facts.push({ label: 'Known for', value: tags.slice(0, 3).join(', ') })
  return out
}

/** "I have 127 coconut trees" -> 127 trees */
export function parseQuantity(need: string | null | undefined): { amount: number; unit: string } | null {
  if (!need) return null
  const m = need.match(/(\d[\d,]{0,5})\s*(?:[a-z]+\s+){0,2}?(trees?|palms?)\b/i)
  return m ? { amount: num(m[1]), unit: 'tree' } : null
}

/** What the job would cost and take with this helper, when both sides gave numbers in the same unit. */
export function estimateFor(parsed: ParsedFacts, need: string | null | undefined): { qty: number; cost: number; days: number | null } | null {
  const qty = parseQuantity(need)
  if (!qty || !parsed.price || parsed.price.unit !== qty.unit) return null
  const days = parsed.speed && parsed.speed.period === 'day' && parsed.speed.amount > 0 ? Math.max(1, Math.ceil(qty.amount / parsed.speed.amount)) : null
  return { qty: qty.amount, cost: Math.round(qty.amount * parsed.price.amount), days }
}

export const rupees = (n: number) => '₹' + n.toLocaleString('en-IN')
