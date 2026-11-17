import { Link } from 'react-router'
import { MapPin } from 'lucide-react'
import type { Match, PersonLite } from '../lib/types'
import type { ConnectionView } from '../lib/queries'
import { availabilityLabel } from '../lib/format'
import { Avatar, Button, Card, Chip, SkillChips } from './ui'
import { ConnectionStatusChip } from './StatusChip'
import { LifecycleScene } from './MatchingScene'
import { BlockButton, ReportButton, VerificationBadge } from './Safety'

export interface SolverSkill {
  name: string
  proficiency: number
  years: number | null
}

const LEVEL = ['', 'Basic', 'Good', 'Strong', 'Expert']

export function SolverCard({
  match,
  person,
  skills,
  connection,
  declined,
  onConnect,
  onBlocked,
}: {
  match: Match
  person: PersonLite
  skills: SolverSkill[]
  connection: ConnectionView | null
  declined: boolean
  onConnect: () => void
  onBlocked?: () => void
}) {
  const b = match.breakdown
  const rel = b.reliability
  const matched = new Set(b.matched_skills)
  const ordered = [...skills].sort((a, z) => Number(matched.has(z.name)) - Number(matched.has(a.name)))

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <Avatar name={person.display_name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{person.display_name}</h3>
            <span className="text-xs text-muted">#{match.rank}</span>
            <VerificationBadge level={person.verification} />
            {person.is_demo && <Chip tone="neutral">Demo</Chip>}
          </div>
          {person.headline && <p className="text-sm text-muted">{person.headline}</p>}
        </div>
        {connection ? (
          <div className="flex flex-col items-end gap-1">
            <LifecycleScene state={connection.status === 'accepted' ? 'accepted' : 'pending'} />
            <ConnectionStatusChip status={connection.status} />
          </div>
        ) : declined ? (
          <Chip tone="danger">Declined</Chip>
        ) : (
          <Button onClick={onConnect}>Connect</Button>
        )}
      </div>

      <SkillChips names={ordered.map((s) => `${s.name} · ${LEVEL[s.proficiency]}`)} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>{availabilityLabel[person.availability_status]}</span>
        {person.city && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} aria-hidden /> {person.city}
          </span>
        )}
        <span>
          {rel.included ? `Completed ${rel.confirmed} of ${rel.accepted} cases` : 'No history yet'}
        </span>
      </div>

      <p className="text-sm">{match.explanation}</p>

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-primary">Why this match</summary>
        <ul className="mt-2 space-y-1 text-muted">
          <li>
            Skills: {b.matched_skills.length} of {b.needed_skills} needed ({b.matched_skills.join(', ')})
          </li>
          <li>
            Experience: {b.experience.included ? `${Math.round((b.experience.value ?? 0) * 100)}% of 5 years` : 'Not provided'}
          </li>
          <li>Availability: {availabilityLabel[person.availability_status]}</li>
          <li>Reliability: {rel.included ? `${rel.confirmed} of ${rel.accepted} confirmed` : 'No history yet'}</li>
        </ul>
      </details>

      <div className="flex flex-wrap items-center gap-1 border-t border-line pt-2">
        <ReportButton type="user" id={person.id} />
        <BlockButton userId={person.id} name={person.display_name} onDone={onBlocked} />
      </div>

      {connection?.status === 'accepted' && (
        <Link to={`/app/messages/${connection.id}`} className="text-sm font-semibold text-primary">
          Open chat
        </Link>
      )}
    </Card>
  )
}
