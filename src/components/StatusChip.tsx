import { Ban, CheckCircle2, Clock, HelpCircle, Lock, MessageCircleQuestion, XCircle } from 'lucide-react'
import { Chip } from './ui'
import { caseStatusLabel, connectionStatusLabel } from '../lib/format'
import type { CaseStatus, ConnectionStatus } from '../lib/types'

export function CaseStatusChip({ status }: { status: CaseStatus }) {
  const map = {
    draft: ['neutral', Lock],
    open: ['info', HelpCircle],
    in_progress: ['warning', Clock],
    resolution_proposed: ['warning', Clock],
    resolved: ['success', CheckCircle2],
    closed: ['neutral', Ban],
  } as const
  const [tone, icon] = map[status]
  return (
    <Chip tone={tone} icon={icon}>
      {caseStatusLabel[status]}
    </Chip>
  )
}

export function ConnectionStatusChip({ status }: { status: ConnectionStatus }) {
  const map = {
    pending: ['warning', Clock],
    clarification_requested: ['info', MessageCircleQuestion],
    accepted: ['success', CheckCircle2],
    declined: ['danger', XCircle],
    cancelled: ['neutral', Ban],
    expired: ['neutral', Clock],
    closed: ['neutral', Ban],
  } as const
  const [tone, icon] = map[status]
  return (
    <Chip tone={tone} icon={icon}>
      {connectionStatusLabel[status]}
    </Chip>
  )
}
