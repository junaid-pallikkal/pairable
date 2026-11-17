import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Thrown when the AI service is off, missing its key, or unreachable. Callers fall back to manual flows. */
export class AiUnavailable extends Error {}
export class AiLimit extends Error {}

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

export interface Interpretation {
  title: string
  summary: string
  skills: string[]
  category: string | null
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = error.context.status
      if (status === 429) throw new AiLimit('limit')
      if (status === 401) throw new AiUnavailable('signin')
    }
    throw new AiUnavailable('unavailable')
  }
  return data as T
}

export async function askAssistant(messages: ChatMsg[]): Promise<string> {
  const res = await call<{ reply?: string }>({ task: 'chat', messages: messages.slice(-10) })
  if (!res.reply) throw new AiUnavailable('empty')
  return res.reply
}

export async function interpretProblem(text: string, skills: string[], categories: string[]): Promise<Interpretation> {
  const res = await call<{ result?: Interpretation }>({ task: 'interpret', text, skills, categories })
  if (!res.result) throw new AiUnavailable('empty')
  return res.result
}

export interface Understood {
  title: string
  summary: string
  keywords: string[]
  /** true when the AI helped, false when only the plain text was used */
  ai: boolean
}

/** First sentence, trimmed: used when the AI is not available. */
function firstSentence(text: string, max: number): string {
  const s = text.trim().replace(/\s+/g, ' ').split(/(?<=[.!?])\s/)[0]
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s
}

/**
 * Turn what a person wrote into a title, a short summary and extra related words.
 * Never fails: without the AI, matching still works from the text itself.
 */
export async function understand(kind: 'problem' | 'offer', text: string): Promise<Understood> {
  try {
    const res = await call<{ result?: { title: string; summary: string; keywords: string[] } }>({ task: 'understand', kind, text })
    if (res.result && (res.result.title || res.result.summary)) {
      return {
        title: res.result.title || firstSentence(text, 90),
        summary: res.result.summary || firstSentence(text, 280),
        keywords: res.result.keywords ?? [],
        ai: true,
      }
    }
  } catch {
    /* fall through to the plain version */
  }
  return { title: firstSentence(text, 90), summary: text.trim().slice(0, 280), keywords: [], ai: false }
}
