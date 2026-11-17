import { useState } from 'react'
import { Link } from 'react-router'
import { BadgeCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMe } from '../lib/auth'
import { errorMessage, unwrap, useData } from '../lib/data'
import { Button, Card, Chip } from './ui'
import { Textarea } from './forms'
import { Modal } from './Modal'
import { VerificationBadge } from './Safety'
import { useToast } from './Toast'

export function VerificationCard() {
  const { id, profile } = useMe()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const req = useData(async () => {
    const rows = unwrap(
      await supabase.from('verification_requests').select('status,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(1),
    ) as { status: string }[]
    return rows[0] ?? null
  }, [id])

  const level = (profile as unknown as { verification?: string }).verification ?? 'none'

  async function send() {
    setBusy(true)
    try {
      unwrap(await supabase.from('verification_requests').insert({ user_id: id, note: note.trim() || null }))
      toast.success('Request sent.')
      setOpen(false)
      setNote('')
      req.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-bold">Verification</h2>
        {level !== 'none' ? <VerificationBadge level={level} /> : <Chip tone="neutral" icon={BadgeCheck}>Not verified</Chip>}
      </div>
      {req.data?.status === 'submitted' ? (
        <p className="text-sm text-muted">Your request is waiting for review.</p>
      ) : (
        level === 'none' && <Button variant="secondary" onClick={() => setOpen(true)}>Ask for verification</Button>
      )}
      <Modal open={open} title="Ask for verification" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Textarea label="Anything we should know?" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={busy} onClick={send}>Send</Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

export function BlockedList() {
  const { id } = useMe()
  const toast = useToast()
  const q = useData(async () => {
    const rows = unwrap(await supabase.from('blocks').select('blocked_id').eq('blocker_id', id)) as { blocked_id: string }[]
    if (!rows.length) return []
    const people = unwrap(
      await supabase.from('profiles').select('id,display_name').in('id', rows.map((r) => r.blocked_id)),
    ) as { id: string; display_name: string }[]
    return people
  }, [id])

  async function unblock(uid: string) {
    try {
      unwrap(await supabase.from('blocks').delete().eq('blocker_id', id).eq('blocked_id', uid))
      toast.success('Unblocked.')
      q.reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  if (!q.data || q.data.length === 0) return null
  return (
    <Card className="space-y-3">
      <h2 className="font-bold">Blocked people</h2>
      <ul className="space-y-2">
        {q.data.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3">
            <span>{p.display_name}</span>
            <Button variant="secondary" className="!min-h-9" onClick={() => unblock(p.id)}>Unblock</Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Questions? See the <Link to="/terms" className="underline">Terms</Link>.
      </p>
    </Card>
  )
}
