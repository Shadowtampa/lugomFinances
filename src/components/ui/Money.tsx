import { formatBRL } from '../../lib/money'

interface MoneyProps {
  centavos: number
  sinal?: boolean
}

function Money({ centavos, sinal = false }: MoneyProps) {
  const corClasse = sinal ? (centavos < 0 ? 'text-alerta' : 'text-livre') : ''

  return <span className={`font-money ${corClasse}`}>{formatBRL(centavos)}</span>
}

export default Money
