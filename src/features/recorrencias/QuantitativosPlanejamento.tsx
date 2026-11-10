import { useState } from 'react'
import { resumoDe } from '../../lib/planejamento'
import { formatBRL } from '../../lib/money'
import type { ResumoPlanejamento } from '../../types/domain'

/**
 * Geral (M30): Manuais, Automáticas, Recorrentes, Parceladas e Total geral do mês.
 * Mobile: só "Total geral", que abre/fecha as outras quatro (começa fechado).
 */
function QuantitativosPlanejamento({ linhas }: { linhas: ResumoPlanejamento[] }) {
  const [aberto, setAberto] = useState(false)
  const caixas = [
    { chave: 'manual', nome: 'Manuais', ...resumoDe(linhas, { forma: 'manual' }) },
    { chave: 'automatica', nome: 'Automáticas', ...resumoDe(linhas, { forma: 'automatica' }) },
    { chave: 'recorrente', nome: 'Recorrentes', ...resumoDe(linhas, { duracao: 'recorrente' }) },
    { chave: 'parcelado', nome: 'Parceladas', ...resumoDe(linhas, { duracao: 'parcelado' }) },
    { chave: 'total', nome: 'Total geral', ...resumoDe(linhas) },
  ]
  const total = caixas[caixas.length - 1]
  const detalhes = caixas.slice(0, -1)
  return (
    <section aria-label="Quantitativos">
      <div className="flex flex-col gap-2 sm:hidden">
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls="quantitativos-detalhe"
          onClick={() => setAberto((a) => !a)}
          className="flex w-full items-center gap-3 rounded-lg border border-ink/30 bg-base px-3 py-2 text-left"
        >
          <span className="flex-1">
            <span className="flex items-baseline gap-2 text-sm font-semibold text-ink">
              Total geral <span className="text-xs font-normal text-ink-soft">{total.quantidade}</span>
            </span>
            <span className="font-money block text-xs text-ink-soft">
              Pago {formatBRL(total.pagoCentavos)} · Falta {formatBRL(total.faltaCentavos)}
            </span>
          </span>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-ink-soft transition-transform ${aberto ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {aberto && (
          <ul id="quantitativos-detalhe" className="flex flex-col gap-2">
            {detalhes.map((c) => (
              <li key={c.chave} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
                <span className="flex-1 text-sm text-ink">
                  {c.nome} <span className="text-xs text-ink-soft">{c.quantidade}</span>
                </span>
                <span className="font-money text-right text-xs text-ink-soft">
                  Pago {formatBRL(c.pagoCentavos)}
                  <span className="block">Falta {formatBRL(c.faltaCentavos)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="hidden grid-cols-2 gap-2 sm:grid lg:grid-cols-5">
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
