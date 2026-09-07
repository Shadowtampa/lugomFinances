import { useId, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
}

function Input({ label, hint, error, id, className = '', ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        className={`rounded border px-3 py-2 text-base text-ink outline-none focus:ring-2 focus:ring-livre ${
          error ? 'border-alerta' : 'border-line'
        } ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...props}
      />
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

export default Input
