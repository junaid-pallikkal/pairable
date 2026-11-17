import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../lib/data'
import { Button, Card } from '../../components/ui'
import { AskResourceModal } from '../Resources'

interface Match {
  id: string
  title: string
  description: string | null
  kind: string
  city: string | null
  state: string | null
  owner_name: string
  reason: string
}

/** Resources offered by others that fit this problem (same category, or mention one of its skills). */
export function ResourcesForCase({ caseId, onSent }: { caseId: string; onSent: () => void }) {
  const [ask, setAsk] = useState<Match | null>(null)
  const q = useData(async () => {
    const { data, error } = await supabase.rpc('resources_for_case', { p_case: caseId })
    if (error) return [] as Match[] // feature not set up yet: show nothing instead of an error
    return data as Match[]
  }, [caseId])

  if (!q.data || q.data.length === 0) return null
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-bold">Resources that may help</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {q.data.map((r) => (
          <li key={r.id}>
            <Card className="flex h-full flex-col gap-2">
              <p className="font-semibold">{r.title}</p>
              {r.description && <p className="line-clamp-2 text-sm text-muted">{r.description}</p>}
              <p className="text-xs text-muted">{r.reason}</p>
              <p className="inline-flex items-center gap-1 text-xs text-muted">
                <MapPin size={12} aria-hidden /> {[r.city, r.state].filter(Boolean).join(', ') || 'Online'} · {r.owner_name}
              </p>
              <Button variant="secondary" className="mt-auto" onClick={() => setAsk(r)}>Ask for this</Button>
            </Card>
          </li>
        ))}
      </ul>
      <AskResourceModal resource={ask} caseId={caseId} onClose={() => setAsk(null)} onSent={onSent} />
    </section>
  )
}
