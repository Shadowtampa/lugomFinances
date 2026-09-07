import { formatBRL } from '../../lib/money'

interface BarraLimiteProps {
  totalGastoCentavos: number
  limiteAcumuladoCentavos: number | null
  gastoMesAtualCentavos: number
}

export function calcularPercentual(gasto: number, limite: number): number {
  if (limite <= 0) return gasto > 0 ? 100 : 0
  return Math.round((gasto / limite) * 100)
}

function BarraLimite({
  totalGastoCentavos,
  limiteAcumuladoCentavos,
  gastoMesAtualCentavos,
}: BarraLimiteProps) {
  if (limiteAcumuladoCentavos === null) {
    return (
      <div>
        <p className="font-money text-sm text-ink">{formatBRL(totalGastoCentavos)}</p>
        <p className="text-xs text-ink-soft">sem limite definido</p>
      </div>
    )
  }

  const percentual = calcularPercentual(totalGastoCentavos, limiteAcumuladoCentavos)
  const estourou = totalGastoCentavos > limiteAcumuladoCentavos
  const diferenca = Math.abs(limiteAcumuladoCentavos - totalGastoCentavos)

  return (
    <div>
      <p className="font-money text-sm text-ink">
        {formatBRL(totalGastoCentavos)} de {formatBRL(limiteAcumuladoCentavos)}
      </p>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full ${estourou ? 'bg-alerta' : 'bg-livre'}`}
          style={{ width: `${Math.min(percentual, 100)}%` }}
        />
      </div>
      <p className={`mt-1 text-xs ${estourou ? 'text-alerta' : 'text-ink-soft'}`}>
        {percentual}% ·{' '}
        {estourou
          ? `estourou ${formatBRL(diferenca)}`
          : `restam ${formatBRL(diferenca)} acumulados`}
      </p>
      <p className="text-xs text-ink-soft">{formatBRL(gastoMesAtualCentavos)} neste mês</p>
    </div>
  )
}

export default BarraLimite
