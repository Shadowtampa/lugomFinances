import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}

function Select({ label, hint, error, id, className = '', children, ...props }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const hintId = hint ? `${selectId}-hint` : undefined
  const errorId = error ? `${selectId}-error` : undefined

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={selectId}
        className={`rounded border bg-surface px-3 py-2 text-base text-ink outline-none focus:ring-2 focus:ring-livre ${
          error ? 'border-alerta' : 'border-line'
        } ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...props}
      >
        {children}
      </select>
      {hint && !error && (
        <span id={hintId} className="text-xs text-ink-soft">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="text-xs text-alerta">
          {error}
        </span>
      )}
    </div>
  )
}

export default Select
