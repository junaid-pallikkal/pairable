import { supabase } from './supabase'

export type GuestResult = 'ok' | 'off' | 'limit' | 'error'

/**
 * Open a guest account so someone can try RePair without an email.
 * 'off' means guest access is not switched on for this site in Supabase.
 */
export async function continueAsGuest(): Promise<GuestResult> {
  const { error } = await supabase.auth.signInAnonymously()
  if (!error) return 'ok'
  const m = error.message.toLowerCase()
  if (m.includes('disabled')) return 'off'
  if (m.includes('rate') || m.includes('too many')) return 'limit'
  return 'error'
}

export const GUEST_MESSAGE: Record<Exclude<GuestResult, 'ok'>, string> = {
  off: 'Guest access is not switched on for this site yet. Please sign up with your email.',
  limit: 'Too many guests were created just now. Wait a minute and try again.',
  error: "Couldn't start a guest account. Please try again.",
}
