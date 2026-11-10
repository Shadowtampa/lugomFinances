import { useId } from 'react'

export type TomSeletor = 'neutro' | 'livre' | 'alerta' | 'restrita' | 'aviso'

export type OpcaoSeletor<T extends string> = { valor: T; rotulo: string; tom: TomSeletor }

// Classes literais (o Tailwind só gera o que enxerga no código).
const ESTILO_TOM: Record<TomSeletor, { caixa: string; ponto: string }> = {
  neutro: { caixa: 'border-line bg-surface text-ink', ponto: 'bg-ink-soft' },
  livre: { caixa: 'border-livre/40 bg-livre/10 text-livre', ponto: 'bg-livre' },
  alerta: { caixa: 'border-alerta/40 bg-alerta/10 text-alerta', ponto: 'bg-alerta' },
  restrita: { caixa: 'border-restrita/40 bg-restrita/10 text-restrita', ponto: 'bg-restrita' },
  aviso: { caixa: 'border-aviso/40 bg-aviso/10 text-aviso', ponto: 'bg-aviso' },
}

interface Props<T extends string> {
  label: string
  valor: T
  opcoes: OpcaoSeletor<T>[]
  onChange(valor: T): void
}

/** Drop-down de filtro colorido: a cor segue a opção escolhida (M30b). */
function SeletorFiltro<T extends string>({ label, valor, opcoes, onChange }: Props<T>) {
  const id = useId()
  const atual = opcoes.find((o) => o.valor === valor) ?? opcoes[0]
  const estilo = ESTILO_TOM[atual.tom]

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-ink-soft">
        {label}
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${estilo.ponto}`}
        />
        <select
          id={id}
          value={valor}
          onChange={(event) => onChange(event.target.value as T)}
          className={`min-w-[10.5rem] appearance-none rounded-lg border py-2 pl-8 pr-9 text-sm font-medium outline-none focus:ring-2 focus:ring-livre ${estilo.caixa}`}
        >
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor} className="bg-surface text-ink">
              {o.rotulo}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-70"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  )
}

export default SeletorFiltro
