import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { AlertCircle } from 'lucide-react'

const control =
  'w-full rounded-2xl border bg-surface-2 px-4 min-h-12 text-sm placeholder:text-muted focus:border-fg focus:bg-surface'

interface FieldProps {
  label: string
  error?: string
  children: (id: string, describedBy?: string) => ReactNode
}

export function Field({ label, error, children }: FieldProps) {
  const id = useId()
  const errId = error ? `${id}-err` : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {children(id, errId)}
      {error && (
        <p id={errId} className="flex items-center gap-1.5 text-sm font-semibold">
          <AlertCircle size={14} aria-hidden /> {error}
        </p>
      )}
    </div>
  )
}

export function Input({
  label,
  error,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <Field label={label} error={error}>
      {(id, d) => (
        <input
          id={id}
          aria-describedby={d}
          aria-invalid={!!error}
          className={`${control} ${error ? 'border-fg' : 'border-transparent'} ${className}`}
          {...rest}
        />
      )}
    </Field>
  )
}

export function Textarea({
  label,
  error,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  return (
    <Field label={label} error={error}>
      {(id, d) => (
        <textarea
          id={id}
          aria-describedby={d}
          aria-invalid={!!error}
          className={`${control} py-2.5 ${error ? 'border-fg' : 'border-transparent'} ${className}`}
          {...rest}
        />
      )}
    </Field>
  )
}

export function Select({
  label,
  error,
  children,
  className = '',
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  return (
    <Field label={label} error={error}>
      {(id, d) => (
        <select
          id={id}
          aria-describedby={d}
          className={`${control} ${error ? 'border-fg' : 'border-transparent'} ${className}`}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  )
}

export function Checkbox({
  label,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
      <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" {...rest} />
      {label}
    </label>
  )
}
