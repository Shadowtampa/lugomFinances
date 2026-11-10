import { useMemo } from 'react'
import { formatBRL } from '../../lib/money'
import {
  compromissosFuturos,
  faturaMedia,
  filtrarPorPeriodo,
  maiorCompra,
  percentual,
  somarPorChave,
  somarPorMes,
  ticketMedio,
  totalCompromissos,
  utilizacaoLimite,
  type Periodo,
} from '../../lib/indicadores'
import { deslocarMes } from '../../lib/date'
import CardIndicador, { VariacaoDinheiro } from './CardIndicador'
import type { DadosCartoes } from './dadosCartoes'
import { corDaPaleta, formatarPercentual } from './formatos'
import { GraficoBarrasSimples, GraficoCompromissos, GraficoRosca, SemDados, type Fatia } from './Graficos'

interface CartoesAnaliseProps {
  dados: DadosCartoes
  periodo: Periodo
  anterior: Periodo
}

function CartoesAnalise({ dados, periodo, anterior }: CartoesAnaliseProps) {
  const calc = useMemo(() => {
    const fontePorId = new Map(dados.fontes.map((f) => [f.id, f]))
    const ehCartao = (id: string) => fontePorId.get(id)?.ehCartao ?? false

    const doPeriodo = filtrarPorPeriodo(dados.saidas, periodo)
    const doAnterior = filtrarPorPeriodo(dados.saidas, anterior)
    const comprasP = doPeriodo.filter((s) => ehCartao(s.fonteId))
    const comprasAnt = doAnterior.filter((s) => ehCartao(s.fonteId))
    const totalCompras = comprasP.reduce((acc, s) => acc + s.valorCentavos, 0)
    const totalComprasAnt = comprasAnt.reduce((acc, s) => acc + s.valorCentavos, 0)

    const porInstituicao: Fatia[] = somarPorChave(
      doPeriodo.map((s) => ({ chave: dados.instituicaoPorFonte[s.fonteId] ?? 'Manual', valorCentavos: s.valorCentavos })),
    ).map((t, i) => ({ id: t.chave, nome: t.chave, valor: t.totalCentavos, cor: corDaPaleta(i) }))

    const porMeio: Fatia[] = somarPorChave(doPeriodo.map((s) => ({ chave: s.fonteId, valorCentavos: s.valorCentavos }))).map(
      (t, i) => ({
        id: t.chave,
        nome: fontePorId.get(t.chave)?.nome ?? 'Fonte removida',
        valor: t.totalCentavos,
        cor: fontePorId.get(t.chave)?.cor ?? corDaPaleta(i),
      }),
    )

    // Utilização do limite: retrato de hoje, por cartão ativo e no total (só cartões com limite).
    const cartoes = dados.saldosFontes
      .filter((f) => f.ehCartao && !f.arquivada)
      .map((f) => {
        const divida = Math.max(0, -f.saldoCentavos)
        return { id: f.id, nome: f.nome, cor: f.cor, divida, limite: f.limiteCentavos, uso: utilizacaoLimite(divida, f.limiteCentavos) }
      })
    const comLimite = cartoes.filter((c) => c.limite !== null)
    const usoTotal = utilizacaoLimite(
      comLimite.reduce((acc, c) => acc + c.divida, 0),
      comLimite.reduce((acc, c) => acc + (c.limite ?? 0), 0),
    )

    const mesesFatura = Array.from({ length: 12 }, (_, k) => deslocarMes(dados.mesAtual, k - 11))
    const faturasMes = somarPorMes(
      dados.faturas.map((f) => ({ data: `${f.mes}-01`, totalCentavos: f.totalCentavos })),
      mesesFatura,
    )

    const compromissos = compromissosFuturos(
      dados.parcelasCartao,
      dados.parcelasPlanejamento.map((p) => ({ competencia: p.competencia, valorPrevistoCentavos: p.valorPrevistoCentavos })),
      dados.mesAtual,
      12,
    )

    return {
      totalCompras,
      totalComprasAnt,
      ticket: ticketMedio(totalCompras, comprasP.length),
      qtdCompras: comprasP.length,
      maior: maiorCompra(comprasP),
      porInstituicao,
      porMeio,
      cartoes,
      usoTotal,
      faturasMes,
      fatura: faturaMedia(faturasMes, 6),
      compromissos,
      totalCompromissos: totalCompromissos(compromissos),
      totalSaidas: doPeriodo.reduce((acc, s) => acc + s.valorCentavos, 0),
    }
  }, [dados, periodo, anterior])

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CardIndicador titulo="Compras no cartão" valor={formatBRL(calc.totalCompras)} destaque="negativo" nota="Sem pagamentos de fatura">
          <VariacaoDinheiro atual={calc.totalCompras} anterior={calc.totalComprasAnt} maisEhBom={false} />
        </CardIndicador>
        <CardIndicador
          titulo="Ticket médio no cartão"
          valor={calc.ticket === null ? '—' : formatBRL(calc.ticket)}
          nota={`${calc.qtdCompras} ${calc.qtdCompras === 1 ? 'compra' : 'compras'} no período`}
        />
        <CardIndicador
          titulo="Maior compra no cartão"
          valor={calc.maior ? formatBRL(calc.maior.valorCentavos) : '—'}
          nota={calc.maior ? calc.maior.titulo : 'Nenhuma compra no período'}
        />
        <CardIndicador
          titulo="Fatura média"
          valor={calc.fatura.mediaCentavos === null ? '—' : formatBRL(calc.fatura.mediaCentavos)}
          nota={
            calc.fatura.meses === 0
              ? 'Indisponível: nenhuma fatura paga nos últimos 12 meses'
              : `Média de ${calc.fatura.meses} ${calc.fatura.meses === 1 ? 'mês' : 'meses'} com fatura paga (até 6)`
          }
        />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-ink-soft">Utilização do limite</h2>
        <p className="mb-3 text-xs text-ink-soft">Hoje: dívida atual ÷ limite. Não segue o período.</p>
        {calc.cartoes.length === 0 ? (
          <SemDados texto="Nenhum cartão cadastrado." />
        ) : (
          <ul className="flex flex-col gap-3">
            {calc.cartoes.map((c) => (
              <li key={c.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-ink">{c.nome}</span>
                  <span className="font-money text-sm text-ink-soft">{formatarPercentual(c.uso, 0)}</span>
                </div>
                <p className="font-money text-sm text-ink">
                  {formatBRL(c.divida)} {c.limite !== null && `de ${formatBRL(c.limite)}`}
                </p>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full ${(c.uso ?? 0) > 100 ? 'bg-alerta' : (c.uso ?? 0) > 70 ? 'bg-aviso' : 'bg-livre'}`}
                    style={{ width: `${Math.min(c.uso ?? 0, 100)}%` }}
                  />
                </div>
                {c.uso === null && <p className="mt-1 text-xs text-ink-soft">Sem limite cadastrado: utilização indisponível.</p>}
              </li>
            ))}
            {calc.cartoes.length > 1 && (
              <li className="text-right text-xs text-ink-soft">Total dos cartões com limite: {formatarPercentual(calc.usoTotal, 0)}</li>
            )}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-ink-soft">Saídas por instituição</h2>
        <p className="mb-3 text-xs text-ink-soft">
          Instituição = banco conectado (Conexão); Fontes sem conexão ficam em Manual. Saída em várias Fontes é rateada pelo split.
        </p>
        <GraficoRosca fatias={calc.porInstituicao} rotulo="Saídas por instituição" />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Participação por meio de pagamento (Fonte)</h2>
        <GraficoRosca fatias={calc.porMeio} rotulo="Participação por meio de pagamento" />
        {calc.totalSaidas > 0 && (
          <p className="mt-2 text-xs text-ink-soft">
            Total de Saídas no período: {formatBRL(calc.totalSaidas)} (100%). Cartões somam{' '}
            {formatarPercentual(percentual(calc.totalCompras, calc.totalSaidas), 0)}.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-ink-soft">Faturas pagas por mês</h2>
        <p className="mb-3 text-xs text-ink-soft">Soma dos pagamentos de fatura de todos os cartões, nos últimos 12 meses.</p>
        <GraficoBarrasSimples dados={calc.faturasMes.map((p) => ({ mes: p.mes, valor: p.totalCentavos }))} nome="Faturas pagas" cor="var(--color-restrita)" />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-ink-soft">Compromissos futuros</h2>
        <p className="mb-3 text-xs text-ink-soft">
          Parcelas ainda não pagas, por mês de vencimento, nos próximos 12 meses (não seguem o período). Não são dívida: não entram
          no Patrimônio líquido. Total: <span className="font-money text-ink">{formatBRL(calc.totalCompromissos)}</span>. Parcelas de
          cartão vêm do que já foi importado; compras novas ainda não importadas não aparecem.
        </p>
        <GraficoCompromissos dados={calc.compromissos} />
      </section>
    </div>
  )
}

export default CartoesAnalise
