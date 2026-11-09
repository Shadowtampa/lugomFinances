import { useState } from 'react'

/** Ícone 📝 em linha com nota; clique ou toque mostra o texto (M24). */
function IndicadorNota({ nota }: { nota?: string | null }) {
  const [aberta, setAberta] = useState(false)
  if (!nota) return null
  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label="Ver nota"
        aria-expanded={aberta}
        title={nota}
        className="rounded px-1 text-sm leading-none hover:bg-base"
        onClick={(e) => {
          e.stopPropagation()
          setAberta((v) => !v)
        }}
        onBlur={() => setAberta(false)}
      >
        📝
      </button>
      {aberta && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1 w-64 max-w-[80vw] whitespace-pre-wrap break-words rounded border border-line bg-surface p-2 text-xs text-ink shadow"
        >
          {nota}
        </span>
      )}
    </span>
  )
}

export default IndicadorNota
