import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button } from '../components/ui'
import { Input } from '../components/forms'
import { useToast } from '../components/Toast'

function authError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'Email or password is wrong.'
  if (m.includes('already registered')) return 'This email already has an account.'
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox.'
  if (m.includes('rate limit')) return 'Too many tries. Please wait a minute.'
  if (m.includes('password')) return 'Password must be at least 8 characters.'
  return "Couldn't continue. Please try again."
}

function AuthShell({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-float">
        <h1 className="mb-6 text-2xl font-bold">{title}</h1>
        {children}
      </div>
      <p className="mt-6 text-center text-sm text-muted">{footer}</p>
    </div>
  )
}

export function SignIn() {
  const { session } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const toast = useToast()
  const from = (loc.state as { from?: string } | null)?.from ?? '/app'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<{ email?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to={from} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: typeof err = {}
    if (!email.includes('@')) next.email = 'Enter a valid email.'
    if (!password) next.password = 'Enter your password.'
    setErr(next)
    if (Object.keys(next).length) return
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) return setErr({ password: authError(error.message) })
    toast.success('Welcome back.')
    nav(from, { replace: true })
  }

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here? <Link to="/sign-up" state={{ from }} className="font-semibold text-primary">Create an account</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={err.email} />
        <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={err.password} />
        <Button type="submit" loading={busy} className="w-full">Sign in</Button>
      </form>
    </AuthShell>
  )
}

export function SignUp() {
  const { session } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const toast = useToast()
  const from = (loc.state as { from?: string } | null)?.from ?? '/app'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<{ name?: string; email?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  if (session) return <Navigate to={from} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: typeof err = {}
    if (!name.trim()) next.name = 'Enter your name.'
    if (!email.includes('@')) next.email = 'Enter a valid email.'
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    setErr(next)
    if (Object.keys(next).length) return
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin + '/app' },
    })
    setBusy(false)
    if (error) return setErr({ email: authError(error.message) })
    if (data.session) {
      toast.success('Account created.')
      nav(from, { replace: true })
    } else {
      setSent(true)
    }
  }

  if (sent)
    return (
      <AuthShell title="Check your email" footer={<Link to="/sign-in" className="font-semibold text-primary">Back to sign in</Link>}>
        <p>We sent a link to {email}. Open it to finish creating your account.</p>
      </AuthShell>
    )

  return (
    <AuthShell
      title="Create account"
      footer={
        <>
          Already have one? <Link to="/sign-in" state={{ from }} className="font-semibold text-primary">Sign in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={err.name} />
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={err.email} />
        <Input label="Password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={err.password} />
        <p className="text-xs text-muted">
          By continuing you agree to the <Link to="/terms" className="underline">Terms</Link> and{' '}
          <Link to="/privacy" className="underline">Privacy policy</Link>. You must be 18 or older.
        </p>
        <Button type="submit" loading={busy} className="w-full">Create account</Button>
      </form>
    </AuthShell>
  )
}
