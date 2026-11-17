import { useState } from 'react'
import { Ban, BadgeCheck, Flag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, useMe } from '../lib/auth'
import { errorMessage, unwrap } from '../lib/data'
import { Button, Chip } from './ui'
import { Select, Textarea } from './forms'
import { ConfirmDialog, Modal } from './Modal'
import { useToast } from './Toast'

export function VerificationBadge({ level }: { level?: string | null }) {
  if (!level || level === 'none') return null
  const label = level === 'id' ? 'ID checked' : level === 'phone' ? 'Phone checked' : 'Email checked'
  return (
    <Chip tone="info" icon={BadgeCheck}>
      {label}
    </Chip>
  )
}

export type ReportTarget = 'user' | 'case' | 'message' | 'resource'

export function ReportButton({ type, id, className = '' }: { type: ReportTarget; id: string; className?: string }) {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  if (!session) return null // reporting needs an account
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-fg ${className}`}
      >
        <Flag size={14} aria-hidden /> Report
      </button>
      <ReportDialog open={open} type={type} id={id} onClose={() => setOpen(false)} />
    </>
  )
}

export function ReportDialog({
  open,
  type,
  id,
  onClose,
}: {
  open: boolean
  type: ReportTarget
  id: string
  onClose: () => void
}) {
  const { id: uid } = useMe()
  const toast = useToast()
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  async function send() {
    setBusy(true)
    try {
      unwrap(
        await supabase.from('reports').insert({
          reporter_id: uid,
          target_type: type,
          target_id: id,
          reason,
          details: details.trim() || null,
        }),
      )
      toast.success('Thanks. We will review it.')
      setDetails('')
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title="Report" onClose={onClose}>
      <div className="space-y-4">
        <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="spam">Spam</option>
          <option value="abuse">Abuse or harassment</option>
          <option value="fake">Fake or misleading</option>
          <option value="unsafe">Unsafe</option>
          <option value="other">Something else</option>
        </Select>
        <Textarea label="Details (optional)" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={send}>Send report</Button>
        </div>
      </div>
    </Modal>
  )
}

export function BlockButton({ userId, name, onDone }: { userId: string; name: string; onDone?: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function block() {
    setBusy(true)
    try {
      unwrap(await supabase.rpc('block_user', { p_user: userId }))
      toast.success(`${name} is blocked.`)
      setOpen(false)
      onDone?.()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-fg"
      >
        <Ban size={14} aria-hidden /> Block
      </button>
      <ConfirmDialog
        open={open}
        title={`Block ${name}? They won't be able to find or message you.`}
        confirmLabel="Block"
        loading={busy}
        onConfirm={block}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
