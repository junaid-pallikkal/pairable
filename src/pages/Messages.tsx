import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, MessageSquare, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMe } from '../lib/auth'
import { errorMessage, unwrap, useData } from '../lib/data'
import { fetchConnections, type ConnectionView } from '../lib/queries'
import { timeAgo } from '../lib/format'
import type { Message } from '../lib/types'
import { Avatar, Button, EmptyState, ErrorState, ListSkeleton, PageHeader } from '../components/ui'
import { ConnectionStatusChip } from '../components/StatusChip'
import { useToast } from '../components/Toast'
import { BlockButton, ReportButton } from '../components/Safety'

function Chat({ conn }: { conn: ConnectionView }) {
  const { id: uid } = useMe()
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const q = useData(
    async () =>
      unwrap(await supabase.from('messages').select('*').eq('connection_id', conn.id).order('created_at')) as Message[],
    [conn.id],
  )

  useEffect(() => {
    const ch = supabase
      .channel('chat-' + conn.id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `connection_id=eq.${conn.id}` },
        () => q.reload(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn.id])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [q.data?.length])

  const canSend = conn.status === 'accepted' || conn.status === 'clarification_requested'

  async function send(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setBusy(true)
    try {
      unwrap(await supabase.from('messages').insert({ connection_id: conn.id, sender_id: uid, body }))
      setText('')
      q.reload()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-96 flex-col rounded-2xl border border-line bg-surface md:h-[calc(100vh-9rem)]">
      <div className="flex items-center gap-3 border-b border-line p-3">
        <Link to="/app/messages" className="md:hidden" aria-label="Back to messages">
          <ArrowLeft aria-hidden />
        </Link>
        <Avatar name={conn.other?.display_name ?? '?'} src={conn.other?.avatar_url} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{conn.other?.display_name}</p>
          <Link to={`/app/cases/${conn.case_id}`} className="block truncate text-xs text-primary">
            {conn.case?.title}
          </Link>
        </div>
        <ConnectionStatusChip status={conn.status} />
        {conn.other && (
          <>
            <ReportButton type="user" id={conn.other.id} />
            <BlockButton userId={conn.other.id} name={conn.other.display_name} onDone={() => window.location.assign('/app/messages')} />
          </>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite">
        {q.loading ? (
          <ListSkeleton rows={2} />
        ) : q.error ? (
          <ErrorState message={q.error} onRetry={q.reload} />
        ) : q.data!.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No messages yet. Say hello.</p>
        ) : (
          q.data!.map((m) => {
            const mine = m.sender_id === uid
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-primary text-primary-fg' : 'bg-surface-2'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-0.5 text-[10px] ${mine ? 'opacity-70' : 'text-muted'}`}>{timeAgo(m.created_at)}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      {canSend ? (
        <form onSubmit={send} className="border-t border-line p-3">
          {conn.status === 'clarification_requested' && (
            <p className="mb-2 text-xs text-muted">You can send up to 3 messages until the request is accepted.</p>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="msg" className="sr-only">Message</label>
            <textarea
              id="msg"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Write a message"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-sm focus:border-primary"
            />
            <Button type="submit" loading={busy} disabled={!text.trim()} aria-label="Send">
              <Send size={16} aria-hidden />
            </Button>
          </div>
        </form>
      ) : (
        <p className="border-t border-line p-3 text-center text-sm text-muted">This conversation is closed.</p>
      )}
    </div>
  )
}

export default function Messages() {
  const { id: uid } = useMe()
  const { connId } = useParams()
  const nav = useNavigate()
  const q = useData(async () => (await fetchConnections(uid)).filter((c) => ['accepted', 'clarification_requested', 'closed'].includes(c.status)), [uid])

  if (q.loading) return <ListSkeleton />
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  const list = q.data ?? []
  const current = list.find((c) => c.id === connId)

  return (
    <div>
      <div className={connId ? 'hidden md:block' : ''}>
        <PageHeader title="Messages" />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No conversations yet" action={<Button variant="secondary" onClick={() => nav('/app/connections')}>See requests</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <ul className={`space-y-2 ${connId ? 'hidden md:block' : ''}`}>
            {list.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/app/messages/${c.id}`}
                  className={`flex min-h-16 items-center gap-3 rounded-2xl border p-3 ${c.id === connId ? 'border-primary bg-accent-soft' : 'border-line bg-surface hover:bg-surface-2'}`}
                >
                  <Avatar name={c.other?.display_name ?? '?'} src={c.other?.avatar_url} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.other?.display_name}</p>
                    <p className="truncate text-xs text-muted">{c.case?.title}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className={connId ? '' : 'hidden md:block'}>
            {current ? (
              <Chat key={current.id} conn={current} />
            ) : (
              <EmptyState icon={MessageSquare} title="Pick a conversation" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
