import { useId } from 'react'
import { MAX_NOTA } from './limites'

/** Textarea opcional de observação (M24), com contador. */
function CampoNota({ value, onChange }: { value: string; onChange(valor: string): void }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Nota <span className="font-normal text-ink-soft">(opcional)</span>
      </label>
      <textarea
        id={id}
        rows={2}
        maxLength={MAX_NOTA}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-line px-3 py-2 text-base text-ink outline-none focus:ring-2 focus:ring-livre"
      />
      {value.length > MAX_NOTA - 50 && (
        <span className="self-end text-xs text-ink-soft">
          {value.length}/{MAX_NOTA}
        </span>
      )}
    </div>
  )
}

export default CampoNota
