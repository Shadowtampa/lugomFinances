import { hojeISO, primeiroDiaDoMes } from '../../lib/date'
import { mesesDoGrafico, type Periodo } from '../../lib/indicadores'
import { listarSaidasLancamento } from '../../services/indicadores'

/** Saídas (uma por linha) do começo do período anterior (ou do primeiro mês dos gráficos) ao fim do período. */
export async function carregarDadosComportamento(periodo: Periodo, anterior: Periodo) {
  const de = [anterior.de, primeiroDiaDoMes(mesesDoGrafico(periodo)[0])].sort()[0]
  const lancamentos = await listarSaidasLancamento(de, periodo.ate)
  return { lancamentos, hoje: hojeISO() }
}

export type DadosComportamento = Awaited<ReturnType<typeof carregarDadosComportamento>>
