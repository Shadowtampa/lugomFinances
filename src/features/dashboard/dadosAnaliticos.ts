import { primeiroDiaDoMes } from '../../lib/date'
import { mesesDoGrafico, type Periodo } from '../../lib/indicadores'
import { listarCategorias } from '../../services/categorias'
import { listarFontes, listarSaldosFontes } from '../../services/fontes'
import { listarSomasEntradas, listarSomasSaidas } from '../../services/indicadores'
import { obterResumoGeral } from '../../services/resumo'

/**
 * Uma única ida ao banco por período: traz do começo do período anterior (ou do primeiro mês
 * dos gráficos, o que vier antes) até o fim do período. O recorte por período é feito em memória.
 */
export async function carregarDadosAnaliticos(periodo: Periodo, anterior: Periodo) {
  const de = [anterior.de, primeiroDiaDoMes(mesesDoGrafico(periodo)[0])].sort()[0]
  const [saidas, entradas, categorias, fontes, resumo, saldosFontes] = await Promise.all([
    listarSomasSaidas(de, periodo.ate),
    listarSomasEntradas(de, periodo.ate),
    listarCategorias({ incluirArquivadas: true }),
    listarFontes({ incluirArquivadas: true }),
    obterResumoGeral(),
    listarSaldosFontes(),
  ])
  // Cartão tem saldo ≤ 0: a dívida é o módulo desse saldo.
  const dividaCartoesCentavos = saldosFontes
    .filter((f) => f.ehCartao && f.saldoCentavos < 0)
    .reduce((acc, f) => acc - f.saldoCentavos, 0)
  return {
    saidas,
    entradas,
    categorias,
    fontes,
    saldosNaoCartaoCentavos: resumo.saldoTotalCentavos,
    dividaCartoesCentavos,
  }
}

export type DadosAnaliticos = Awaited<ReturnType<typeof carregarDadosAnaliticos>>
