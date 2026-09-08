import { calcularPercentual } from '../categorias/BarraLimite'
import { formatBRL } from '../../lib/money'

interface BarraCartaoProps {
  usadoCentavos: number
  limiteCentavos: number
}

function BarraCartao({ usadoCentavos: usadoBruto, limiteCentavos }: BarraCartaoProps) {
  const usadoCentavos = usadoBruto || 0 // normaliza -0
  const percentual = calcularPercentual(usadoCentavos, limiteCentavos)
  const estourou = usadoCentavos > limiteCentavos
  const disponivel = Math.max(limiteCentavos - usadoCentavos, 0)

  return (
    <div>
      <p className="font-money text-sm text-ink">
        {formatBRL(usadoCentavos)} de {formatBRL(limiteCentavos)}
      </p>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full ${estourou ? 'bg-alerta' : 'bg-livre'}`}
          style={{ width: `${Math.min(percentual, 100)}%` }}
        />
      </div>
      <p className={`mt-1 text-xs ${estourou ? 'text-alerta' : 'text-ink-soft'}`}>
        {percentual}% usado · {formatBRL(disponivel)} disponível
      </p>
    </div>
  )
}

export default BarraCartao
