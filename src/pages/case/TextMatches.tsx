import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { BellRing, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { errorMessage, unwrap, useData } from '../../lib/data'
import { fetchTextMatches } from '../../lib/textmatch'
import type { Case } from '../../lib/types'
import { ButtonLink, Card, ErrorState, ListSkeleton } from '../../components/ui'
import { MatchDeck, type DeckItem } from '../../components/MatchDeck'
import { MatchList } from '../../components/MatchList'
import { useToast } from '../../components/Toast'

/** Matches for a problem that was written in plain words. Swipe cards, or "we'll notify you". */
export function TextMatches({ c, onChanged }: { c: Case; onChanged: () => void }) {
  const toast = useToast()
  const q = useData(() => fetchTextMatches(c.id), [c.id])
  const [items, setItems] = useState<DeckItem[]>([])
  useEffect(() => {
    if (q.data) setItems(q.data.items)
  }, [q.data])

  // no matches yet: look again every few seconds
  const waitingNow = !!q.data && q.data.rows.length === 0 && ['open', 'in_progress'].includes(c.status)
  useEffect(() => {
    if (!waitingNow) return
    const t = setInterval(() => q.reload(), 8000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingNow])

  async function decide(item: DeckItem, choose: boolean): Promise<boolean> {
    try {
      unwrap(await supabase.rpc('decide_match', { p_match: item.matchId, p_choose: choose, p_message: choose ? c.description.slice(0, 480) : null }))
      if (choose) toast.success(`Request sent to ${item.person.display_name}.`)
      setItems((l) => l.filter((i) => i.matchId !== item.matchId))
      onChanged()
      return true
    } catch (e) {
      toast.error(errorMessage(e))
      return false
    }
  }

  if (q.loading) return <ListSkeleton rows={2} />
  if (q.error || !q.data) return <ErrorState message={q.error ?? "Couldn't load."} onRetry={q.reload} />

  const liked = q.data.rows.filter((r) => r.decision === 'liked').length
  const active = ['open', 'in_progress'].includes(c.status)

  return (
    <>
    <MatchDeck
      needText={c.description}
      items={active ? items : []}
      onDecide={decide}
      empty={
        <Card className="mx-auto max-w-md space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-black">
            <BellRing size={26} aria-hidden />
          </div>
          <p className="text-lg font-bold">
            {q.data.rows.length === 0 ? 'No one fits yet.' : liked > 0 ? 'You have chosen someone.' : 'That was everyone for now.'}
          </p>
          <p className="text-sm text-muted">
            {q.data.rows.length === 0
              ? 'Your problem is saved. I will notify you the moment someone matches.'
              : liked > 0
                ? 'You will be notified when they reply.'
                : 'If someone new matches later, I will notify you.'}
          </p>
          {q.data.rows.length === 0 && active && (
            <p role="status" className="flex items-center justify-center gap-2 text-sm font-semibold">
              <Loader2 size={16} className="animate-spin" aria-hidden /> Still looking. I check again every few seconds.
            </p>
          )}
          <div className="flex justify-center gap-2">
            <ButtonLink to="/app/connections">My requests</ButtonLink>
            <Link to="/app/ask" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold underline">Ask something else</Link>
          </div>
        </Card>
      }
    />
    {active && <MatchList items={items} needText={c.description} onChoose={(i) => decide(i, true)} />}
    </>
  )
}
