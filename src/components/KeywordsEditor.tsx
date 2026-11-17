import { useEffect, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, useMe } from '../lib/auth'
import { errorMessage, unwrap } from '../lib/data'
import { Button, Card } from './ui'
import { useToast } from './Toast'

const MAX = 20

/** The keywords on your profile. Matching uses them together with what you wrote. */
export function KeywordsEditor() {
  const { profile } = useMe()
  const { refreshProfile } = useAuth()
  const toast = useToast()
  const saved = profile.offer_keywords ?? []
  const [words, setWords] = useState<string[]>(saved)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => setWords(profile.offer_keywords ?? []), [profile.offer_keywords])

  const changed = words.length !== saved.length || words.some((w) => !saved.includes(w))

  function add(raw: string) {
    const w = raw.trim().toLowerCase().replace(/[^a-z0-9 +#-]/g, '')
    if (w.length < 2 || w.length > 30) return
    if (words.includes(w)) return setInput('')
    if (words.length >= MAX) return setNote(`You can add up to ${MAX} keywords.`)
    setWords([...words, w])
    setInput('')
    setNote('')
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(input)
    }
    if (e.key === 'Backspace' && !input && words.length) setWords(words.slice(0, -1))
  }

  async function save() {
    if (!profile.offer_text) return setNote('Tell Pip what you offer first. Keywords work together with it.')
    setBusy(true)
    setNote('')
    try {
      const res = unwrap(
        await supabase.rpc('save_offer', {
          p_text: profile.offer_text,
          p_headline: profile.headline,
          p_summary: profile.offer_summary,
          p_keywords: words,
          p_city: profile.city,
        }),
      ) as { matched_problems: number }
      await refreshProfile()
      toast.success(res.matched_problems > 0 ? `Saved. ${res.matched_problems} waiting ${res.matched_problems === 1 ? 'person was' : 'people were'} told.` : 'Saved.')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-bold">Your keywords</h2>
        <p className="text-sm text-muted">People are matched to you by these words and by what you wrote. Add skills, tools, places or languages.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3">
        {words.map((w) => (
          <span key={w} className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pl-3 pr-1 text-sm font-semibold text-black">
            {w}
            <button onClick={() => setWords(words.filter((x) => x !== w))} aria-label={`Remove ${w}`} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/10">
              <X size={14} aria-hidden />
            </button>
          </span>
        ))}
        <label htmlFor="kw-input" className="sr-only">Add a keyword</label>
        <input
          id="kw-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => input && add(input)}
          placeholder={words.length ? 'Add another…' : 'e.g. coconut, stories, plumbing'}
          className="min-h-9 min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
        <button onClick={() => add(input)} disabled={!input.trim()} aria-label="Add keyword" className="flex h-9 w-9 items-center justify-center rounded-full bg-fg text-bg disabled:opacity-40">
          <Plus size={16} aria-hidden />
        </button>
      </div>
      {note && (
        <p className="text-sm font-semibold">
          {note} {!profile.offer_text && <Link to="/app/settings" className="underline">Tell Pip</Link>}
        </p>
      )}
      <Button onClick={save} loading={busy} disabled={!changed && !!profile.offer_text}>
        Save keywords
      </Button>
    </Card>
  )
}
