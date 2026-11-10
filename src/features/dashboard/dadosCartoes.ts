import { deslocarMes, hojeISO, primeiroDiaDoMes } from '../../lib/date'
import type { Periodo } from '../../lib/indicadores'
import { listarFontes, listarSaldosFontes } from '../../services/fontes'
import {
  listarPagamentosFaturaMes,
  listarParcelasCartaoRestantes,
  listarParcelasPlanejamentoFuturas,
  listarSaidasNasFontes,
} from '../../services/indicadores'
import { listarContasPluggy, listarItens } from '../../services/integracao'

/** Fontes sem conexão Pluggy aparecem como "Manual". */
export const INSTITUICAO_MANUAL = 'Manual'

/**
 * Dados da aba Cartões. Os splits vão do começo do período anterior ao fim do período;
 * faturas (12 meses) e compromissos futuros (de hoje em diante) não seguem o filtro.
 */
export async function carregarDadosCartoes(periodo: Periodo, anterior: Periodo) {
  const hoje = hojeISO()
  const mesAtual = hoje.slice(0, 7)
  const [saidas, faturas, parcelasCartao, parcelasPlanejamento, fontes, saldosFontes, itens, contas] =
    await Promise.all([
      listarSaidasNasFontes(anterior.de < periodo.de ? anterior.de : periodo.de, periodo.ate),
      listarPagamentosFaturaMes(primeiroDiaDoMes(deslocarMes(mesAtual, -11))),
      listarParcelasCartaoRestantes(),
      listarParcelasPlanejamentoFuturas(primeiroDiaDoMes(mesAtual)),
      listarFontes({ incluirArquivadas: true }),
      listarSaldosFontes(),
      listarItens(),
      listarContasPluggy(),
    ])

  // Instituição = Conexão (item da Pluggy) da conta vinculada à Fonte.
  const instituicaoPorFonte: Record<string, string> = {}
  for (const f of fontes) {
    const conta = f.pluggyAccountId ? contas.find((c) => c.pluggyAccountId === f.pluggyAccountId) : undefined
    const item = conta ? itens.find((i) => i.itemId === conta.itemId) : undefined
    instituicaoPorFonte[f.id] = conta ? (item?.nome ?? 'Banco conectado') : INSTITUICAO_MANUAL
  }

  return { saidas, faturas, parcelasCartao, parcelasPlanejamento, fontes, saldosFontes, instituicaoPorFonte, mesAtual }
}

export type DadosCartoes = Awaited<ReturnType<typeof carregarDadosCartoes>>
