import { resolverDiaRecorrencia } from './date'
import type { RecorrenciaDoMes, StatusRecorrencia } from '../types/domain'

/** paga: tem pagamento. atrasada: sem pagamento e hoje passou do dia (resolvido no mês). pendente: o resto. */
export function statusDaRecorrencia(
  item: Pick<RecorrenciaDoMes, 'pagamentoId' | 'competencia' | 'dia'>,
  hoje: string,
): StatusRecorrencia {
  if (item.pagamentoId) return 'paga'
  return hoje > resolverDiaRecorrencia(item.competencia, item.dia) ? 'atrasada' : 'pendente'
}

/** Valor que conta como pago: o real da Saída ligada, senão o previsto. */
export function valorEfetivo(item: Pick<RecorrenciaDoMes, 'valorPagoCentavos' | 'valorPrevistoCentavos'>) {
  return item.valorPagoCentavos ?? item.valorPrevistoCentavos
}

export function resumoDoMes(itens: RecorrenciaDoMes[]) {
  const previstoCentavos = itens.reduce((s, i) => s + i.valorPrevistoCentavos, 0)
  const pagoCentavos = itens.filter((i) => i.pagamentoId).reduce((s, i) => s + valorEfetivo(i), 0)
  const faltaCentavos = itens
    .filter((i) => !i.pagamentoId)
    .reduce((s, i) => s + i.valorPrevistoCentavos, 0)
  return { previstoCentavos, pagoCentavos, faltaCentavos }
}
