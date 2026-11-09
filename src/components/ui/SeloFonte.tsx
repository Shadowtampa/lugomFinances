import { identidadeDaFonte } from '../../lib/identidadeFontes'

/**
 * Selo com a marca da Fonte (identidadeFontes.ts). Fonte sem identidade: bolinha na `cor`
 * quando informada, senão nada.
 */
function SeloFonte({ fonteId, cor, pequeno = false }: { fonteId: string; cor?: string; pequeno?: boolean }) {
  const identidade = identidadeDaFonte(fonteId)
  if (!identidade) {
    if (!cor) return null
    return <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cor }} aria-hidden="true" />
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-bold lowercase leading-none tracking-tight ${
        pequeno ? 'h-4 min-w-4 px-1 text-[9px]' : 'h-6 min-w-6 px-1.5 text-[11px]'
      }`}
      style={{ backgroundColor: identidade.cor, color: identidade.corTexto }}
    >
      {identidade.sigla}
    </span>
  )
}

export default SeloFonte
