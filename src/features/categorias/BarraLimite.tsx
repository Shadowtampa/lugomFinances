import { formatBRL } from '../../lib/money'

interface BarraLimiteProps {
  limiteMensalCentavos: number | null
  gastoMesAtualCentavos: number
}

export function calcularPercentual(gasto: number, limite: number): number {
  if (limite <= 0) return gasto > 0 ? 100 : 0
  return Math.round((gasto / limite) * 100)
}

/** Gasto do mês corrente contra o limite mensal (RN-05: não acumula, zera todo dia 1º). */
function BarraLimite({ limiteMensalCentavos, gastoMesAtualCentavos }: BarraLimiteProps) {
  if (limiteMensalCentavos === null) {
    return (
      <div>
        <p className="font-money text-sm text-ink">{formatBRL(gastoMesAtualCentavos)}</p>
        <p className="text-xs text-ink-soft">neste mês · sem limite definido</p>
      </div>
    )
  }

  const percentual = calcularPercentual(gastoMesAtualCentavos, limiteMensalCentavos)
  const estourou = gastoMesAtualCentavos > limiteMensalCentavos
  const diferenca = Math.abs(limiteMensalCentavos - gastoMesAtualCentavos)

  return (
    <div>
      <p className="font-money text-sm text-ink">
        {formatBRL(gastoMesAtualCentavos)} de {formatBRL(limiteMensalCentavos)}
      </p>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full ${estourou ? 'bg-alerta' : 'bg-livre'}`}
          style={{ width: `${Math.min(percentual, 100)}%` }}
        />
      </div>
      <p className={`mt-1 text-xs ${estourou ? 'text-alerta' : 'text-ink-soft'}`}>
        {percentual}% ·{' '}
        {estourou ? `estourou ${formatBRL(diferenca)} neste mês` : `restam ${formatBRL(diferenca)} neste mês`}
      </p>
    </div>
  )
}

export default BarraLimite
