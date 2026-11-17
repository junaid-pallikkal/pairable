import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  Lock,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { initials } from '../lib/format'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-11 px-5 text-sm'
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg hover:opacity-85',
  secondary: 'border border-line bg-surface shadow-card hover:bg-surface-2',
  ghost: 'hover:bg-surface-2',
  danger: 'border-2 border-fg bg-surface text-fg hover:bg-fg hover:text-bg',
}

export function Button({
  variant = 'primary',
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...rest
}: LinkProps & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...rest} />
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute -bottom-9 left-1/2 z-40 hidden -translate-x-1/2 whitespace-nowrap rounded-xl bg-fg px-2 py-1 text-xs text-bg group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  )
}

export function IconButton({
  icon: Icon,
  label,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <Tooltip text={label}>
      <button
        aria-label={label}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface-2 disabled:opacity-50 ${className}`}
        {...rest}
      >
        <Icon size={20} aria-hidden />
      </button>
    </Tooltip>
  )
}

export function EmptyState({
  icon: Icon = HelpCircle,
  title,
  action,
}: {
  icon?: LucideIcon
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-accent bg-surface-2 px-6 py-12 text-center">
      <Icon size={28} className="text-muted" aria-hidden />
      <p className="font-semibold">{title}</p>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-12 text-center">
      <AlertCircle size={28} className="text-danger" aria-hidden />
      <p className="font-semibold">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-[pulse-soft_1.4s_ease-in-out_infinite] rounded-xl bg-surface-2 ${className}`} />
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="animate-spin text-muted" aria-hidden />
    </div>
  )
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-primary"
    >
      {initials(name)}
    </span>
  )
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'
// Monochrome: meaning comes from the icon and label, weight from fill.
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  success: 'bg-fg text-bg',
  warning: 'border border-line bg-surface text-fg',
  danger: 'border border-fg bg-surface text-fg',
  info: 'bg-accent-soft text-fg',
}
const toneIcon: Record<Tone, LucideIcon> = {
  neutral: Lock,
  success: CheckCircle2,
  warning: Clock,
  danger: XCircle,
  info: HelpCircle,
}

export function Chip({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) {
  const Icon = icon ?? toneIcon[tone]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      <Icon size={12} aria-hidden />
      {children}
    </span>
  )
}

export function SkillChip({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium">{children}</span>
}

export function SkillChips({ names, max = 3 }: { names: string[]; max?: number }) {
  const [open, setOpen] = useState(false)
  const shown = open ? names : names.slice(0, max)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((n) => (
        <SkillChip key={n}>{n}</SkillChip>
      ))}
      {!open && names.length > max && (
        <button className="text-xs font-semibold text-primary" onClick={() => setOpen(true)}>
          +{names.length - max} more
        </button>
      )}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-surface p-5 shadow-card ${className}`}>{children}</div>
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
      {actions}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div role="tablist" className="mb-6 flex max-w-full gap-6 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`min-h-11 whitespace-nowrap border-b-[3px] text-sm font-semibold ${
            value === t.id ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Blocked({ title }: { title: string }) {
  return <EmptyState icon={Ban} title={title} />
}
