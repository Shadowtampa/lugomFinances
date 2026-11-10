import { useMemo } from 'react'
import { formatBRL } from '../../lib/money'
import {
  agruparPorCategoria,
  avaliarOrcamento,
  concentracaoTopN,
  contarExcedidas,
  crescimentoPorCategoria,
  diaDoMes,
  diasDoMes,
  filtrarPorPeriodo,
  maiorAumentoAbsoluto,
  maiorCrescimentoPercentual,
  mesesDoGrafico,
  mesesTocados,
  percentual,
  planejadoDoPeriodo,
  projetarFechamento,
  rankingCategorias,
  ROTULOS_FAIXA,
  somaCentavos,
  somarPorMes,
  ticketMedio,
  variacaoPercentual,
  type FaixaOrcamento,
  type Periodo,
  type PresetPeriodo,
} from '../../lib/indicadores'
import CardIndicador from './CardIndicador'
import type { DadosAnaliticos } from './dadosAnaliticos'
import { formatarPercentual } from './formatos'
import { GraficoLinhas, GraficoRosca, SemDados, type Fatia } from './Graficos'

const COR_BARRA: Record<FaixaOrcamento, string> = {
  dentro: 'bg-livre',
  atencao: 'bg-aviso/60',
  proximo: 'bg-aviso',
  excedido: 'bg-alerta',
}
const COR_TEXTO: Record<FaixaOrcamento, string> = {
  dentro: 'text-livre',
  atencao: 'text-aviso',
  proximo: 'text-aviso',
  excedido: 'text-alerta',
}

interface CategoriasAnaliseProps {
  dados: DadosAnaliticos
  periodo: Periodo
  anterior: Periodo
  preset: PresetPeriodo
  hoje: string
}

function CategoriasAnalise({ dados, periodo, anterior, preset, hoje }: CategoriasAnaliseProps) {
  const calc = useMemo(() => {
    const nomeCor = (id: string) => {
      const c = dados.categorias.find((x) => x.id === id)
      return { nome: c?.nome ?? 'Categoria removida', cor: c?.cor ?? 'var(--color-ink-soft)' }
    }
    const saidas = filtrarPorPeriodo(dados.saidas, periodo)
    const totalSaidas = somaCentavos(saidas)
    const totais = agruparPorCategoria(saidas)
    const totaisAnt = agruparPorCategoria(filtrarPorPeriodo(dados.saidas, anterior))
    const ranking = rankingCategorias(totais)

    const linhas = ranking.map((t) => ({
      ...t,
      ...nomeCor(t.categoriaId),
      participacao: percentual(t.totalCentavos, totalSaidas),
      ticket: ticketMedio(t.totalCentavos, t.quantidade),
      variacao: variacaoPercentual(
        t.totalCentavos,
        totaisAnt.find((a) => a.categoriaId === t.categoriaId)?.totalCentavos ?? 0,
      ),
    }))

    const fatias: Fatia[] = ranking.map((t) => ({
      id: t.categoriaId,
      valor: t.totalCentavos,
      ...nomeCor(t.categoriaId),
    }))

    const crescimento = crescimentoPorCategoria(totais, totaisAnt)
    const maiorPct = maiorCrescimentoPercentual(crescimento)
    const maiorAbs = maiorAumentoAbsoluto(crescimento)

    const meses = mesesDoGrafico(periodo)
    const series = ranking.slice(0, 5).map((t) => ({
      id: t.categoriaId,
      ...nomeCor(t.categoriaId),
      valores: somarPorMes(
        dados.saidas.filter((s) => s.categoriaId === t.categoriaId),
        meses,
      ).map((p) => p.totalCentavos),
    }))

    // Planejado × realizado: limite mensal da Categoria × meses que o período toca.
    const nMeses = mesesTocados(periodo).length
    const orcamentos = dados.categorias
      .filter((c) => !c.arquivada && c.limiteMensalCentavos !== null)
      .map((c) => {
        const realizado = totais.find((t) => t.categoriaId === c.id)?.totalCentavos ?? 0
        const planejado = planejadoDoPeriodo(c.limiteMensalCentavos ?? 0, nMeses)
        const avaliacao = avaliarOrcamento(planejado, realizado)
        const projecao =
          preset === 'mes'
            ? projetarFechamento(realizado, planejado, diaDoMes(hoje), diasDoMes(hoje.slice(0, 7)))
            : null
        return { id: c.id, nome: c.nome, avaliacao, projecao }
      })
      .sort((a, b) => (b.avaliacao.percentualUtilizado ?? -1) - (a.avaliacao.percentualUtilizado ?? -1))

    return {
      totalSaidas,
      linhas,
      fatias,
      maiorPct: maiorPct && { ...maiorPct, ...nomeCor(maiorPct.categoriaId) },
      maiorAbs: maiorAbs && { ...maiorAbs, ...nomeCor(maiorAbs.categoriaId) },
      top3: concentracaoTopN(totais, 3, totalSaidas),
      top5: concentracaoTopN(totais, 5, totalSaidas),
      meses,
      series,
      orcamentos,
      excedidas: contarExcedidas(orcamentos.map((o) => o.avaliacao)),
    }
  }, [dados, periodo, anterior, preset, hoje])

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CardIndicador titulo="Saídas no período" valor={formatBRL(calc.totalSaidas)} />
        <CardIndicador
          titulo="3 maiores Categorias"
          valor={formatarPercentual(calc.top3, 1)}
          nota="das Saídas do período"
        />
        <CardIndicador
          titulo="5 maiores Categorias"
          valor={formatarPercentual(calc.top5, 1)}
          nota="das Saídas do período"
        />
        <CardIndicador
          titulo="Orçamentos excedidos"
          valor={String(calc.excedidas)}
          destaque={calc.excedidas > 0 ? 'negativo' : 'neutro'}
          nota={`de ${calc.orcamentos.length} Categorias com limite`}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CardIndicador
          titulo="Maior crescimento (%)"
          valor={calc.maiorPct ? `${calc.maiorPct.nome} +${(calc.maiorPct.variacaoPercentual ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'}
          nota={calc.maiorPct ? `${formatBRL(calc.maiorPct.anteriorCentavos)} → ${formatBRL(calc.maiorPct.atualCentavos)}` : 'Nenhuma Categoria cresceu sobre uma base anterior'}
        />
        <CardIndicador
          titulo="Maior aumento (R$)"
          valor={calc.maiorAbs ? `${calc.maiorAbs.nome} +${formatBRL(calc.maiorAbs.variacaoAbsolutaCentavos)}` : '—'}
          nota={calc.maiorAbs ? `${formatBRL(calc.maiorAbs.anteriorCentavos)} → ${formatBRL(calc.maiorAbs.atualCentavos)}` : 'Nenhuma Categoria aumentou'}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Distribuição das Saídas por Categoria</h2>
        <GraficoRosca fatias={calc.fatias} rotulo="Distribuição das Saídas por Categoria" />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Ranking de Categorias</h2>
        {calc.linhas.length === 0 ? (
          <SemDados />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium">Part.</th>
                  <th className="px-3 py-2 text-right font-medium">Lanç.</th>
                  <th className="px-3 py-2 text-right font-medium">Ticket médio</th>
                  <th className="px-3 py-2 text-right font-medium">vs. anterior</th>
                </tr>
              </thead>
              <tbody>
                {calc.linhas.map((l, i) => (
                  <tr key={l.categoriaId} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink-soft">{i + 1}</td>
                    <td className="px-3 py-2">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: l.cor }} />
                      {l.nome}
                    </td>
                    <td className="px-3 py-2 text-right font-money">{formatBRL(l.totalCentavos)}</td>
                    <td className="px-3 py-2 text-right font-money">{formatarPercentual(l.participacao, 1)}</td>
                    <td className="px-3 py-2 text-right font-money">{l.quantidade}</td>
                    <td className="px-3 py-2 text-right font-money">{l.ticket === null ? '—' : formatBRL(l.ticket)}</td>
                    <td className="px-3 py-2 text-right font-money">
                      {l.variacao === null ? '—' : `${l.variacao > 0 ? '+' : ''}${l.variacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Evolução mensal das 5 maiores Categorias</h2>
        <GraficoLinhas meses={calc.meses} series={calc.series} />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-ink-soft">Planejado × realizado</h2>
        <p className="mb-3 text-xs text-ink-soft">
          Planejado = limite mensal da Categoria × {mesesTocados(periodo).length}{' '}
          {mesesTocados(periodo).length === 1 ? 'mês' : 'meses'} do período. Só Categorias com limite.
        </p>
        {calc.orcamentos.length === 0 ? (
          <SemDados texto="Nenhuma Categoria tem limite mensal. Defina um em Categorias." />
        ) : (
          <ul className="flex flex-col gap-3">
            {calc.orcamentos.map((o) => {
              const a = o.avaliacao
              return (
                <li key={o.id} className="rounded-lg border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">{o.nome}</span>
                    {a.faixa && <span className={`text-xs font-medium ${COR_TEXTO[a.faixa]}`}>{ROTULOS_FAIXA[a.faixa]}</span>}
                  </div>
                  <p className="font-money text-sm text-ink">
                    {formatBRL(a.realizadoCentavos)} de {formatBRL(a.planejadoCentavos)}
                    {a.percentualUtilizado !== null && ` · ${formatarPercentual(a.percentualUtilizado, 0)}`}
                  </p>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className={`h-full ${a.faixa ? COR_BARRA[a.faixa] : 'bg-alerta'}`}
                      style={{ width: `${Math.min(a.percentualUtilizado ?? 100, 100)}%` }}
                    />
                  </div>
                  <p className={`mt-1 text-xs ${a.excedida ? 'text-alerta' : 'text-ink-soft'}`}>
                    {a.excedida
                      ? `Estourou ${formatBRL(a.desvioAbsolutoCentavos)} (${formatarPercentual(a.desvioPercentual, 0)} acima)`
                      : `Sobram ${formatBRL(a.saldoDisponivelCentavos)}`}
                  </p>
                  {o.projecao && (
                    <p className="mt-1 text-xs italic text-ink-soft">
                      Estimativa de fechamento do mês: {formatBRL(o.projecao.projecaoCentavos)}
                      {o.projecao.utilizacaoProjetada !== null &&
                        ` (${formatarPercentual(o.projecao.utilizacaoProjetada, 0)} do limite)`}{' '}
                      · desvio projetado {formatBRL(o.projecao.desvioProjetadoCentavos)}. Não é valor realizado.
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default CategoriasAnalise
