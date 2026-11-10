import { formatBRL } from '../../lib/money'

type Props = { pagoCentavos: number; previstoCentavos: number; faltaCentavos: number }

function IconeCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

function IconeRelogio() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function Card({ rotulo, centavos, icone, cor, bg, children }: {
  rotulo: string
  centavos: number
  icone: React.ReactNode
  cor: string
  bg: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex min-w-[10.5rem] flex-1 flex-col gap-2 rounded-lg border border-line bg-surface px-4 py-3 shadow-sm sm:max-w-[15rem]">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${bg} ${cor}`}>{icone}</span>
        <span className="text-sm font-medium text-ink-soft">{rotulo}</span>
      </div>
      <p className="font-money text-2xl font-semibold text-ink">{formatBRL(centavos)}</p>
      {children}
    </div>
  )
}

/** Cards Pago / Falta do mês, centralizados no topo (M30). Barra = pago ÷ previsto. */
function CardsResumo({ pagoCentavos, previstoCentavos, faltaCentavos }: Props) {
  const percentual = previstoCentavos > 0 ? Math.min(100, Math.round((pagoCentavos / previstoCentavos) * 100)) : 0
  return (
    <div className="mb-6 flex flex-wrap justify-center gap-3" aria-label="Resumo do mês">
      <Card rotulo="Pago" centavos={pagoCentavos} icone={<IconeCheck />} cor="text-livre" bg="bg-livre/10">
        <div
          role="progressbar"
          aria-label="Percentual pago"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentual}
          className="h-1.5 overflow-hidden rounded-full bg-base"
        >
          <div className="h-full rounded-full bg-livre" style={{ width: `${percentual}%` }} />
        </div>
        <p className="font-money text-xs text-ink-soft">
          {percentual}% de {formatBRL(previstoCentavos)}
        </p>
      </Card>
      <Card rotulo="Falta" centavos={faltaCentavos} icone={<IconeRelogio />} cor="text-alerta" bg="bg-alerta/10">
        <p className="text-xs text-ink-soft">{faltaCentavos === 0 ? 'Tudo pago' : 'ainda a pagar'}</p>
      </Card>
    </div>
  )
}

export default CardsResumo
