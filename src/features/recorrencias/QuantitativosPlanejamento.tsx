import { resumoDe } from '../../lib/planejamento'
import { formatBRL } from '../../lib/money'
import type { ResumoPlanejamento } from '../../types/domain'

/** Geral (M30): Manuais, Automáticas, Recorrentes, Parceladas e Total geral do mês. */
function QuantitativosPlanejamento({ linhas }: { linhas: ResumoPlanejamento[] }) {
  const caixas = [
    { chave: 'manual', nome: 'Manuais', ...resumoDe(linhas, { forma: 'manual' }) },
    { chave: 'automatica', nome: 'Automáticas', ...resumoDe(linhas, { forma: 'automatica' }) },
    { chave: 'recorrente', nome: 'Recorrentes', ...resumoDe(linhas, { duracao: 'recorrente' }) },
    { chave: 'parcelado', nome: 'Parceladas', ...resumoDe(linhas, { duracao: 'parcelado' }) },
    { chave: 'total', nome: 'Total geral', ...resumoDe(linhas) },
  ]
  return (
    <section aria-label="Quantitativos">
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {caixas.map((c) => (
          <li
            key={c.chave}
            className={`rounded-lg border px-3 py-2 ${c.chave === 'total' ? 'border-ink/30 bg-base' : 'border-line bg-surface'}`}
          >
            <p className="flex items-baseline justify-between text-sm text-ink">
              <span className={c.chave === 'total' ? 'font-semibold' : ''}>{c.nome}</span>
              <span className="text-xs text-ink-soft">{c.quantidade}</span>
            </p>
            <p className="font-money text-xs text-ink-soft">Pago {formatBRL(c.pagoCentavos)}</p>
            <p className="font-money text-xs text-ink-soft">Falta {formatBRL(c.faltaCentavos)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default QuantitativosPlanejamento
