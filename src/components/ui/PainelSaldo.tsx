import { useEffect } from 'react'
import { formatBRL } from '../../lib/money'

export type LinhaSaldo = {
  rotulo: string
  cor: string
  valorCentavos: number
  sufixo?: string
  tom?: 'normal' | 'atencao' | 'neutro'
}

export type PainelSaldoProps = {
  titulo: string
  fontes: LinhaSaldo[]
  categoria?: LinhaSaldo
  nota?: string
  onFechar: () => void
}

const AUTO_DISMISS_MS = 8000

const tomClasses: Record<NonNullable<LinhaSaldo['tom']>, string> = {
  normal: 'text-ink',
  atencao: 'text-alerta',
  neutro: 'text-ink-soft',
}

function LinhaSaldoItem({ linha }: { linha: LinhaSaldo }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: linha.cor }}
        aria-hidden="true"
      />
      <span className="flex-1 truncate text-ink">{linha.rotulo}</span>
      <span className={`font-money shrink-0 text-right ${tomClasses[linha.tom ?? 'normal']}`}>
        {formatBRL(linha.valorCentavos)}
        {linha.sufixo && <span className="ml-1 font-sans text-xs">{linha.sufixo}</span>}
      </span>
    </div>
  )
}

function PainelSaldo({ titulo, fontes, categoria, nota, onFechar }: PainelSaldoProps) {
  useEffect(() => {
    const timer = setTimeout(onFechar, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [onFechar])

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-20 z-50 rounded border border-line bg-surface p-4 shadow-lg sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink">{titulo}</p>
        <button
          type="button"
          aria-label="Fechar"
          onClick={onFechar}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-soft hover:bg-base"
        >
          ×
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {fontes.map((linha, indice) => (
          <LinhaSaldoItem key={`${linha.rotulo}-${indice}`} linha={linha} />
        ))}
      </div>

      {categoria && (
        <div className="mt-2 flex flex-col gap-1.5 border-t border-line pt-2">
          <LinhaSaldoItem linha={categoria} />
        </div>
      )}

      {nota && <p className="mt-2 text-xs text-ink-soft">{nota}</p>}
    </div>
  )
}

export default PainelSaldo
