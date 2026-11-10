import { useMemo } from 'react'
import { formatBRL } from '../../lib/money'
import {
  comprometimentoRenda,
  filtrarPorPeriodo,
  mesesDoGrafico,
  patrimonioLiquido,
  saldoOperacional,
  somaCentavos,
  somarPorMes,
  taxaEconomia,
  type Periodo,
} from '../../lib/indicadores'
import CardIndicador, { VariacaoDinheiro, VariacaoPontos } from './CardIndicador'
import type { DadosAnaliticos } from './dadosAnaliticos'
import { formatarPercentual } from './formatos'
import { GraficoEntradasSaidas, GraficoRosca, GraficoSaldo, type Fatia } from './Graficos'

interface VisaoGeralProps {
  dados: DadosAnaliticos
  periodo: Periodo
  anterior: Periodo
}

function VisaoGeral({ dados, periodo, anterior }: VisaoGeralProps) {
  const calc = useMemo(() => {
    const entradas = filtrarPorPeriodo(dados.entradas, periodo)
    const saidas = filtrarPorPeriodo(dados.saidas, periodo)
    const e = somaCentavos(entradas)
    const s = somaCentavos(saidas)
    const eAnt = somaCentavos(filtrarPorPeriodo(dados.entradas, anterior))
    const sAnt = somaCentavos(filtrarPorPeriodo(dados.saidas, anterior))

    const meses = mesesDoGrafico(periodo)
    const entradasMes = somarPorMes(dados.entradas, meses)
    const saidasMes = somarPorMes(dados.saidas, meses)
    const serie = meses.map((mes, i) => ({
      mes,
      entradas: entradasMes[i].totalCentavos,
      saidas: saidasMes[i].totalCentavos,
    }))

    const porFonte = new Map<string, number>()
    for (const x of entradas) porFonte.set(x.fonteId, (porFonte.get(x.fonteId) ?? 0) + x.totalCentavos)
    const fatias: Fatia[] = [...porFonte.entries()]
      .map(([id, valor]) => {
        const fonte = dados.fontes.find((f) => f.id === id)
        return { id, nome: fonte?.nome ?? 'Fonte removida', valor, cor: fonte?.cor ?? 'var(--color-ink-soft)' }
      })
      .sort((a, b) => b.valor - a.valor)

    return { e, s, eAnt, sAnt, serie, fatias }
  }, [dados, periodo, anterior])

  const { e, s, eAnt, sAnt } = calc
  const saldo = saldoOperacional(e, s)
  const saldoAnt = saldoOperacional(eAnt, sAnt)
  const economia = taxaEconomia(e, s)
  const comprometimento = comprometimentoRenda(e, s)
  const patrimonio = patrimonioLiquido(dados.saldosNaoCartaoCentavos, dados.dividaCartoesCentavos)

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CardIndicador titulo="Entradas" valor={formatBRL(e)} destaque="positivo">
          <VariacaoDinheiro atual={e} anterior={eAnt} maisEhBom />
        </CardIndicador>
        <CardIndicador titulo="Saídas" valor={formatBRL(s)} destaque="negativo">
          <VariacaoDinheiro atual={s} anterior={sAnt} maisEhBom={false} />
        </CardIndicador>
        <CardIndicador
          titulo="Saldo operacional"
          valor={formatBRL(saldo)}
          destaque={saldo < 0 ? 'negativo' : 'neutro'}
          nota="Entradas − Saídas"
        >
          <VariacaoDinheiro atual={saldo} anterior={saldoAnt} maisEhBom />
        </CardIndicador>
        <CardIndicador
          titulo="Taxa de economia"
          valor={formatarPercentual(economia, 1)}
          nota={economia === null ? 'Indisponível: sem Entradas no período' : '(Entradas − Saídas) ÷ Entradas'}
        >
          <VariacaoPontos atual={economia} anterior={taxaEconomia(eAnt, sAnt)} maisEhBom />
        </CardIndicador>
        <CardIndicador
          titulo="Comprometimento da renda"
          valor={formatarPercentual(comprometimento, 1)}
          nota={comprometimento === null ? 'Indisponível: sem Entradas no período' : 'Saídas ÷ Entradas'}
        >
          <VariacaoPontos atual={comprometimento} anterior={comprometimentoRenda(eAnt, sAnt)} maisEhBom={false} />
        </CardIndicador>
        <CardIndicador
          titulo="Patrimônio líquido"
          valor={formatBRL(patrimonio)}
          destaque={patrimonio < 0 ? 'negativo' : 'neutro'}
          nota="Hoje: saldos das Fontes (sem cartão) − dívida dos cartões. Não segue o período."
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Entradas e Saídas por mês</h2>
        <GraficoEntradasSaidas dados={calc.serie} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Saldo operacional por mês</h2>
        <GraficoSaldo dados={calc.serie.map((p) => ({ mes: p.mes, saldo: p.entradas - p.saidas }))} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Entradas por Fonte</h2>
        <GraficoRosca fatias={calc.fatias} rotulo="Distribuição das Entradas por Fonte" />
      </section>
    </div>
  )
}

export default VisaoGeral
