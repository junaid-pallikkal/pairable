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
