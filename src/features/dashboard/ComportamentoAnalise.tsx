import { useMemo } from 'react'
import { formatarData } from '../../lib/date'
import { formatBRL } from '../../lib/money'
import {
  diasDecorridos,
  diaMaiorGasto,
  filtrarPorPeriodo,
  frequenciaCompras,
  gastoMedioDiario,
  gastoPorDia,
  gastoPorDiaDaSemana,
  mesesDoGrafico,
  percentual,
  periodoDecorrido,
  rankingEstabelecimentos,
  ticketMedio,
  ticketMedioPorMes,
  variacaoPercentual,
  type Periodo,
} from '../../lib/indicadores'
import CalendarioCalor from './CalendarioCalor'
import CardIndicador from './CardIndicador'
import type { DadosComportamento } from './dadosComportamento'
import { DIAS_SEMANA, formatarPercentual, rotuloDia, rotuloMes } from './formatos'
import { GraficoBarrasRotulos, GraficoLinhaSimples, SemDados } from './Graficos'

interface ComportamentoAnaliseProps {
  dados: DadosComportamento
  periodo: Periodo
  anterior: Periodo
}

function ComportamentoAnalise({ dados, periodo, anterior }: ComportamentoAnaliseProps) {
  const calc = useMemo(() => {
    const { hoje } = dados
    const doPeriodo = filtrarPorPeriodo(dados.lancamentos, periodo)
    const doAnterior = filtrarPorPeriodo(dados.lancamentos, anterior)
    const itens = doPeriodo.map((l) => ({ data: l.data, valorCentavos: l.valorCentavos }))
    const total = doPeriodo.reduce((acc, l) => acc + l.valorCentavos, 0)
    const totalAnt = doAnterior.reduce((acc, l) => acc + l.valorCentavos, 0)
    const dias = diasDecorridos(periodo, hoje)
    const decorrido = periodoDecorrido(periodo, hoje)
    const porDia = decorrido ? gastoPorDia(itens, decorrido) : []
    const meses = mesesDoGrafico(periodo)
    const mensal = ticketMedioPorMes(
      dados.lancamentos.map((l) => ({ data: l.data, valorCentavos: l.valorCentavos })),
      meses,
    )
    const ranking = rankingEstabelecimentos(
      doPeriodo.map((l) => ({ chave: l.chave, nome: l.nome, valorCentavos: l.valorCentavos })),
    )
    return {
      total,
      quantidade: doPeriodo.length,
      ticket: ticketMedio(total, doPeriodo.length),
      mediaDiaria: gastoMedioDiario(total, dias),
      frequencia: frequenciaCompras(doPeriodo.length, dias),
      dias,
      crescimento: variacaoPercentual(total, totalAnt),
      totalAnt,
      porDia,
      maiorDia: diaMaiorGasto(porDia),
      semana: gastoPorDiaDaSemana(porDia),
      mensal,
      ranking: ranking.slice(0, 10),
    }
  }, [dados, periodo, anterior])

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CardIndicador
          titulo="Ticket médio"
          valor={calc.ticket === null ? '—' : formatBRL(calc.ticket)}
          nota={`${calc.quantidade} ${calc.quantidade === 1 ? 'Saída' : 'Saídas'} no período`}
        />
        <CardIndicador
          titulo="Gasto médio diário"
          valor={calc.mediaDiaria === null ? '—' : formatBRL(calc.mediaDiaria)}
          nota={`Saídas ÷ ${calc.dias} ${calc.dias === 1 ? 'dia decorrido' : 'dias decorridos'}`}
        />
        <CardIndicador
          titulo="Frequência de compras"
          valor={calc.frequencia === null ? '—' : `${calc.frequencia.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} por dia`}
          nota="Saídas ÷ dias decorridos"
        />
        <CardIndicador
          titulo="Dia de maior gasto"
          valor={calc.maiorDia ? formatarData(calc.maiorDia.data) : '—'}
          nota={calc.maiorDia ? formatBRL(calc.maiorDia.totalCentavos) : 'Nenhuma Saída no período'}
        />
        <CardIndicador
          titulo="Crescimento das Saídas"
          valor={calc.crescimento === null ? '—' : `${calc.crescimento > 0 ? '+' : ''}${formatarPercentual(calc.crescimento, 1)}`}
          destaque={calc.crescimento !== null && calc.crescimento > 0 ? 'negativo' : 'neutro'}
          nota={
            calc.crescimento === null
              ? 'Indisponível: sem Saídas no período anterior'
              : `${formatBRL(calc.totalAnt)} → ${formatBRL(calc.total)}`
          }
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Evolução dos gastos diários</h2>
        <GraficoLinhaSimples
          dados={calc.porDia.map((d) => ({ rotulo: rotuloDia(d.data), valor: d.totalCentavos }))}
          nome="Gasto do dia"
          cor="var(--color-alerta)"
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Calendário de calor</h2>
        <CalendarioCalor dias={calc.porDia} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Saídas por mês</h2>
        <GraficoBarrasRotulos
          dados={calc.mensal.map((m) => ({ rotulo: rotuloMes(m.mes), valor: m.totalCentavos }))}
          nome="Saídas por mês"
          cor="var(--color-alerta)"
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Gasto por dia da semana</h2>
        <GraficoBarrasRotulos
          dados={calc.semana.map((s) => ({ rotulo: DIAS_SEMANA[s.dia], valor: s.totalCentavos }))}
          nome="Gasto por dia da semana"
          cor="var(--color-restrita)"
        />
        <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-ink-soft sm:grid-cols-4">
          {calc.semana.map((s) => (
            <li key={s.dia}>
              {DIAS_SEMANA[s.dia]}: média{' '}
              <span className="font-money text-ink">{s.mediaCentavos === null ? '—' : formatBRL(s.mediaCentavos)}</span> por dia
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Evolução do ticket médio</h2>
        <GraficoLinhaSimples
          dados={calc.mensal.map((m) => ({ rotulo: rotuloMes(m.mes), valor: m.ticketCentavos }))}
          nome="Ticket médio"
          cor="var(--color-livre)"
        />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-ink-soft">Ranking de estabelecimentos</h2>
        <p className="mb-3 text-xs text-ink-soft">Os 10 que mais receberam no período. Usa o apelido do estabelecimento quando existe.</p>
        {calc.ranking.length === 0 ? (
          <SemDados />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Estabelecimento</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium">Part.</th>
                  <th className="px-3 py-2 text-right font-medium">Saídas</th>
                  <th className="px-3 py-2 text-right font-medium">Ticket médio</th>
                </tr>
              </thead>
              <tbody>
                {calc.ranking.map((e, i) => (
                  <tr key={e.chave} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink-soft">{i + 1}</td>
                    <td className="px-3 py-2">{e.nome}</td>
                    <td className="px-3 py-2 text-right font-money">{formatBRL(e.totalCentavos)}</td>
                    <td className="px-3 py-2 text-right font-money">{formatarPercentual(percentual(e.totalCentavos, calc.total), 1)}</td>
                    <td className="px-3 py-2 text-right font-money">{e.quantidade}</td>
                    <td className="px-3 py-2 text-right font-money">{e.ticketCentavos === null ? '—' : formatBRL(e.ticketCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default ComportamentoAnalise
