export type Intent = 'seeker' | 'solver' | 'both'
export type Availability = 'open' | 'limited' | 'unavailable'

export interface Profile {
  id: string
  display_name: string
  headline: string | null
  bio: string | null
  intent: Intent
  city: string | null
  state: string | null
  remote_ok: boolean
  availability_status: Availability
  help_types: string[]
  discoverable: boolean
  is_admin: boolean
  status: string
  onboarded_at: string | null
}

export interface Category {
  id: string
  name: string
}

export interface Skill {
  id: string
  name: string
  category_id: string | null
}

export type CaseStatus =
  | 'draft'
  | 'open'
  | 'in_progress'
  | 'resolution_proposed'
  | 'resolved'
  | 'closed'
export type Visibility = 'private' | 'matched_only' | 'public_anonymised'
export type Urgency = 'flexible' | 'this_month' | 'this_week' | 'urgent'

export interface Case {
  id: string
  owner_id: string
  title: string
  description: string
  category_id: string | null
  status: CaseStatus
  visibility: Visibility
  urgency: Urgency | null
  city: string | null
  state: string | null
  remote_ok: boolean
  budget_min: number | null
  budget_max: number | null
  resolved_at: string | null
  created_at: string
}

export interface CaseSkill {
  skill_id: string
  importance: number
  skills: { name: string } | null
}

export interface PublicCase {
  id: string
  title: string
  description: string
  urgency: Urgency | null
  city: string | null
  state: string | null
  remote_ok: boolean
  budget_min: number | null
  budget_max: number | null
  created_at: string
  category: string | null
  skills: string[]
  skill_ids: string[]
}

export interface FactorScore {
  value: number | null
  weight: number
  included: boolean
  accepted?: number
  confirmed?: number
}

export interface Breakdown {
  skill: FactorScore
  experience: FactorScore
  availability: FactorScore
  reliability: FactorScore
  matched_skills: string[]
  needed_skills: number
}

export interface Match {
  id: string
  case_id: string
  profile_id: string
  rank: number
  score: number
  breakdown: Breakdown
  explanation: string
  missing: string[]
}

export type ConnectionStatus =
  | 'pending'
  | 'clarification_requested'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'expired'
  | 'closed'

export interface Connection {
  id: string
  case_id: string
  seeker_id: string
  solver_id: string
  initiated_by: string
  resource_id?: string | null
  message: string | null
  status: ConnectionStatus
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  connection_id: string
  sender_id: string
  body: string
  created_at: string
}

export interface Notification {
  id: string
  kind: string
  title: string
  link: string | null
  read_at: string | null
  created_at: string
}

export interface Milestone {
  id: string
  case_id: string
  title: string
  position: number
  status: 'pending' | 'done'
}

export interface Task {
  id: string
  case_id: string
  milestone_id: string | null
  title: string
  assignee_id: string | null
  status: 'todo' | 'doing' | 'done'
  due_date: string | null
}

export interface ProgressUpdate {
  id: string
  case_id: string
  author_id: string
  body: string
  created_at: string
}

export interface Resolution {
  id: string
  case_id: string
  proposed_by: string
  summary: string
  status: 'proposed' | 'confirmed' | 'rejected'
  created_at: string
}

export interface PersonLite {
  id: string
  display_name: string
  headline: string | null
  city: string | null
  availability_status: Availability
  verification?: string
}
