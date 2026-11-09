import { identidadeDaFonte } from '../../lib/identidadeFontes'

/** Selo com a marca da Fonte (identidadeFontes.ts); Fonte sem identidade não mostra nada. */
function SeloFonte({ fonteId }: { fonteId: string }) {
  const identidade = identidadeDaFonte(fonteId)
  if (!identidade) return null
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 text-[11px] font-bold lowercase leading-none tracking-tight"
      style={{ backgroundColor: identidade.cor, color: identidade.corTexto }}
    >
      {identidade.sigla}
    </span>
  )
}

export default SeloFonte
