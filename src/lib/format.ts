import type { CaseStatus, ConnectionStatus, Urgency, Availability } from './types'

export const caseStatusLabel: Record<CaseStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In progress',
  resolution_proposed: 'Awaiting confirmation',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const connectionStatusLabel: Record<ConnectionStatus, string> = {
  pending: 'Pending',
  clarification_requested: 'Question asked',
  accepted: 'Connected',
  declined: 'Declined',
  cancelled: 'Cancelled',
  expired: 'Expired',
  closed: 'Closed',
}

export const urgencyLabel: Record<Urgency, string> = {
  flexible: 'Flexible',
  this_month: 'This month',
  this_week: 'This week',
  urgent: 'Urgent',
}

export const availabilityLabel: Record<Availability, string> = {
  open: 'Available',
  limited: 'Limited',
  unavailable: 'Unavailable',
}

export const visibilityLabel = {
  private: 'Only me',
  matched_only: 'Matched people',
  public_anonymised: 'Public, no name',
} as const

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function budgetText(min: number | null, max: number | null): string | null {
  const f = (n: number) => '₹' + n.toLocaleString('en-IN')
  if (min != null && max != null) return `${f(min)} – ${f(max)}`
  if (max != null) return `Up to ${f(max)}`
  if (min != null) return `From ${f(min)}`
  return null
}

export function placeText(city: string | null, state: string | null, remote: boolean): string {
  const place = [city, state].filter(Boolean).join(', ')
  if (place && remote) return `${place} · Remote OK`
  if (place) return place
  return remote ? 'Remote' : 'Location not set'
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}
