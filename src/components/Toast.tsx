import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

interface ToastItem {
  id: number
  kind: 'success' | 'error'
  text: string
}
interface ToastApi {
  success: (text: string) => void
  error: (text: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)
let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((kind: ToastItem['kind'], text: string) => {
    const id = nextId++
    setItems((s) => [...s, { id, kind, text }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4000)
  }, [])

  const api: ToastApi = {
    success: (t) => push('success', t),
    error: (t) => push('error', t),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium shadow-float"
          >
            {t.kind === 'success' ? (
              <CheckCircle2 size={18} className="text-success" aria-hidden />
            ) : (
              <XCircle size={18} className="text-danger" aria-hidden />
            )}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
