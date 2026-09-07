import { useId, useState, type InputHTMLAttributes } from 'react'
import { formatBRL } from '../../lib/money'

interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  label: string
  hint?: string
  error?: string
  value: number
  onChange: (centavos: number) => void
}

function digitsParaCentavos(digits: string): number {
  if (!digits) return 0
  return parseInt(digits, 10)
}

function MoneyInput({
  label,
  hint,
  error,
  value,
  onChange,
  id,
  className = '',
  ...props
}: MoneyInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const [display, setDisplay] = useState(() => formatBRL(value))

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, '')
    const centavos = digitsParaCentavos(digits)
    setDisplay(formatBRL(centavos))
    onChange(centavos)
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        inputMode="numeric"
        className={`rounded border px-3 py-2 text-base font-money text-ink outline-none focus:ring-2 focus:ring-livre ${
          error ? 'border-alerta' : 'border-line'
        } ${className}`}
        value={display}
        onChange={handleChange}
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

export default MoneyInput
