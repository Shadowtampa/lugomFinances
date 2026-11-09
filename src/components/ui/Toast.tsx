import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { idLocal } from '../../lib/id'

type ToastVariant = 'info' | 'success' | 'error'

interface AcaoToast {
  rotulo: string
  onClick: () => void | Promise<void>
}

interface Toast {
  id: string
  message: string
  variant: ToastVariant
  acao?: AcaoToast
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, opcoes?: { acao?: AcaoToast }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const variantClasses: Record<ToastVariant, string> = {
  info: 'bg-ink text-white',
  success: 'bg-livre text-white',
  error: 'bg-alerta text-white',
}

const AUTO_DISMISS_MS = 6000

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div className={`flex items-center gap-3 rounded px-4 py-3 text-sm shadow-lg ${variantClasses[toast.variant]}`}>
      <span>{toast.message}</span>
      {toast.acao && (
        <button
          type="button"
          className="font-medium underline"
          onClick={() => {
            onDismiss(toast.id)
            void toast.acao?.onClick()
          }}
        >
          {toast.acao.rotulo}
        </button>
      )}
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info', opcoes?: { acao?: AcaoToast }) => {
      const id = idLocal()
      setToasts((current) => [...current, { id, message, variant, acao: opcoes?.acao }])
    },
    [],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        aria-live="polite"
        role="status"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast deve ser usado dentro de ToastProvider')
  }
  return context
}
