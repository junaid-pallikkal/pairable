import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button } from '../components/ui'
import { Field, Input } from '../components/forms'
import { BotHead, Mascot } from '../components/Mascot'
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

/** Split card: art panel on the left, form on the right. */
function AuthShell({ title, hint, children, footer }: { title: string; hint?: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 p-3 sm:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] bg-surface p-3 shadow-float md:grid-cols-2 md:rounded-[2.5rem] md:p-4">
        {/* art panel */}
        <div className="relative hidden min-h-[34rem] overflow-hidden rounded-[1.75rem] bg-fg md:block">
          <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-accent/25 blur-3xl" aria-hidden />
          <div className="absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-accent/40 blur-3xl" aria-hidden />
          <div
            className="absolute inset-0 opacity-30"
            aria-hidden
            style={{ backgroundImage: 'radial-gradient(circle, rgb(255 255 255 / 0.5) 1px, transparent 1.3px)', backgroundSize: '22px 22px' }}
          />
          <div className="relative p-9 text-white">
            <p className="text-4xl font-bold leading-tight tracking-tight">
              Fix it
              <br />
              <span className="relative inline-block">
                together.
                <svg viewBox="0 0 220 14" className="absolute -bottom-2 left-0 w-full text-accent" aria-hidden preserveAspectRatio="none">
                  <path d="M2 9 Q 30 1 58 8 T 114 8 T 170 7 T 218 6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
            </p>
            <p className="mt-5 max-w-xs text-sm text-white/70">Tell us the problem. We find the people who can help.</p>
          </div>
          <Mascot className="absolute bottom-0 left-1/2 h-[24rem] w-auto -translate-x-1/2" />
        </div>

        {/* form */}
        <div className="flex flex-col justify-center px-4 py-10 sm:px-10 md:px-12">
          <Link to="/" className="mx-auto mb-6 flex items-center gap-2 text-xl font-bold tracking-tight" aria-label="RePair home">
            <BotHead size={36} />
            RePair
          </Link>
          <h1 className="text-center text-3xl font-bold tracking-tight">{title}</h1>
          {hint && <p className="mt-1 text-center text-sm text-muted">{hint}</p>}
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-sm text-muted">{footer}</p>
        </div>
      </div>
    </div>
  )
}

/** Password field with a show/hide eye. */
function PasswordField({
  label,
  value,
  onChange,
  error,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  autoComplete: string
}) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label} error={error}>
      {(id, d) => (
        <div className="relative">
          <input
            id={id}
            aria-describedby={d}
            aria-invalid={!!error}
            type={show ? 'text' : 'password'}
            autoComplete={autoComplete}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`min-h-12 w-full rounded-2xl border bg-surface-2 px-4 pr-12 text-sm focus:border-fg focus:bg-surface ${error ? 'border-fg' : 'border-transparent'}`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            aria-pressed={show}
            className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted hover:text-fg"
          >
            {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
      )}
    </Field>
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
      title="Welcome back"
      hint="Please log in to your account"
      footer={
        <>
          Don’t have an account?{' '}
          <Link to="/sign-up" state={{ from }} className="font-semibold text-fg underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={err.email} />
        <PasswordField label="Password" autoComplete="current-password" value={password} onChange={setPassword} error={err.password} />
        <div className="text-right">
          <Link to="/forgot-password" className="text-xs font-semibold text-muted hover:text-fg">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={busy} className="w-full !min-h-12">
          Log in
        </Button>
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
      <AuthShell title="Check your email" footer={<Link to="/sign-in" className="font-semibold text-fg underline">Back to log in</Link>}>
        <p className="text-center">We sent a link to {email}. Open it to finish creating your account.</p>
      </AuthShell>
    )

  return (
    <AuthShell
      title="Create your account"
      hint="It takes less than a minute"
      footer={
        <>
          Already have one?{' '}
          <Link to="/sign-in" state={{ from }} className="font-semibold text-fg underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={err.name} />
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={err.email} />
        <PasswordField label="Password" autoComplete="new-password" value={password} onChange={setPassword} error={err.password} />
        <p className="text-xs text-muted">
          By continuing you agree to the <Link to="/terms" className="underline">Terms</Link> and{' '}
          <Link to="/privacy" className="underline">Privacy policy</Link>. You must be 18 or older.
        </p>
        <Button type="submit" loading={busy} className="w-full !min-h-12">
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}

export function ForgotPassword() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) return setErr('Enter a valid email.')
    setErr('')
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/reset-password' })
    setBusy(false)
    if (error) {
      if (error.message.toLowerCase().includes('rate')) return setErr('Too many tries. Please wait a minute.')
      toast.error("Couldn't send the email. Please try again.")
      return
    }
    setSent(true) // same message whether or not the email has an account
  }

  return (
    <AuthShell
      title={sent ? 'Check your email' : 'Forgot password?'}
      hint={sent ? undefined : 'We will email you a link to choose a new one'}
      footer={<Link to="/sign-in" className="font-semibold text-fg underline">Back to log in</Link>}
    >
      {sent ? (
        <p className="text-center">If {email} has an account, a reset link is on its way.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={err} />
          <Button type="submit" loading={busy} className="w-full !min-h-12">Send link</Button>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPassword() {
  const nav = useNavigate()
  const toast = useToast()
  const { session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [err, setErr] = useState<{ password?: string; again?: string }>({})
  const [busy, setBusy] = useState(false)
  const [waited, setWaited] = useState(false)

  // The link signs the person in briefly; give it a moment to arrive.
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500)
    return () => clearTimeout(t)
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: typeof err = {}
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    if (again !== password) next.again = 'The passwords do not match.'
    setErr(next)
    if (Object.keys(next).length) return
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return toast.error("Couldn't change the password. Please try again.")
    toast.success('Password changed.')
    nav('/app', { replace: true })
  }

  if (!session && (loading || !waited))
    return (
      <AuthShell title="One moment…" footer={null}>
        <p className="text-center text-muted">Checking your link.</p>
      </AuthShell>
    )
  if (!session)
    return (
      <AuthShell title="Link expired" footer={<Link to="/sign-in" className="font-semibold text-fg underline">Back to log in</Link>}>
        <p className="text-center">This link is not valid any more. <Link to="/forgot-password" className="font-semibold underline">Ask for a new one</Link>.</p>
      </AuthShell>
    )

  return (
    <AuthShell title="Choose a new password" footer={null}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <PasswordField label="New password" autoComplete="new-password" value={password} onChange={setPassword} error={err.password} />
        <PasswordField label="Repeat it" autoComplete="new-password" value={again} onChange={setAgain} error={err.again} />
        <Button type="submit" loading={busy} className="w-full !min-h-12">Save password</Button>
      </form>
    </AuthShell>
  )
}
