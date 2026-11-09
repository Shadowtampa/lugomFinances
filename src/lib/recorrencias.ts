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

/** Filtro da lista de recorrências do mês (M23). "a-pagar" = pendentes + atrasadas. */
export type FiltroRecorrencia = 'todas' | 'a-pagar' | 'pagas'

const FILTROS: FiltroRecorrencia[] = ['todas', 'a-pagar', 'pagas']

/** Lê o `?status=` da URL; ausente ou inválido vale "a-pagar". */
export function lerFiltroRecorrencia(valor: string | null): FiltroRecorrencia {
  return FILTROS.includes(valor as FiltroRecorrencia) ? (valor as FiltroRecorrencia) : 'a-pagar'
}

export function filtrarRecorrencias<T extends Pick<RecorrenciaDoMes, 'pagamentoId'>>(
  itens: T[],
  filtro: FiltroRecorrencia,
): T[] {
  if (filtro === 'todas') return itens
  return itens.filter((i) => (filtro === 'pagas') === Boolean(i.pagamentoId))
}

/** Rótulo do meio de pagamento previsto (M27): "Inter", "Inter + VR", "3 fontes". */
export function rotuloFontesPrevistas(
  ids: string[],
  fontes: Map<string, { nome: string; arquivada: boolean }>,
): string {
  if (ids.length === 0) return ''
  if (ids.length >= 3) return `${ids.length} fontes`
  return ids
    .map((id) => {
      const f = fontes.get(id)
      if (!f) return '—'
      return f.arquivada ? `${f.nome} (arquivada)` : f.nome
    })
    .join(' + ')
}

/** Fonte restrita prevista que não aceita a Categoria da recorrência (RN-03): só aviso. */
export function avisosFontesPrevistas(
  ids: string[],
  fontes: { id: string; nome: string; tipo: 'livre' | 'restrita'; categoriasPermitidas?: string[] }[],
  categoriaId: string | null,
  categoriaNome: string | null,
): string[] {
  if (!categoriaId) return []
  return fontes
    .filter((f) => ids.includes(f.id) && f.tipo === 'restrita' && !f.categoriasPermitidas?.includes(categoriaId))
    .map((f) => `${f.nome} não aceita ${categoriaNome ?? 'essa categoria'}; o pagamento por ela vai ser recusado.`)
}
