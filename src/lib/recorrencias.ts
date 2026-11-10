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

/** Filtro da lista de recorrências do mês (M23). "a-pagar" = pendentes + atrasadas. */
export type FiltroRecorrencia = 'todas' | 'a-pagar' | 'pagas'

const FILTROS: FiltroRecorrencia[] = ['todas', 'a-pagar', 'pagas']

/** Lê o `?status=` da URL; ausente ou inválido vale "a-pagar". */
export function lerFiltroRecorrencia(valor: string | null): FiltroRecorrencia {
  return FILTROS.includes(valor as FiltroRecorrencia) ? (valor as FiltroRecorrencia) : 'a-pagar'
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

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "nov/2026" a partir de YYYY-MM. */
export function rotuloCompetencia(ym: string): string {
  const [ano, mes] = ym.split('-').map(Number)
  return `${MESES_CURTOS[mes - 1]}/${ano}`
}

export type SituacaoVinculo = 'pendente' | 'atrasada' | 'manual' | 'vinculada'

export type OpcaoVinculo = {
  recorrenciaId: string
  /** YYYY-MM */
  competencia: string
  titulo: string
  situacao: SituacaoVinculo
  item: RecorrenciaDoMes
}

/**
 * Competências que uma Saída de `mes` pode quitar (M28):
 * não pagas do mês e de meses anteriores (atrasadas), marcadas sem lançamento só no próprio
 * mês, e a já ligada à Saída em edição. Ordem: competência, dia, título.
 */
export function opcoesDeVinculo(
  itens: RecorrenciaDoMes[],
  mes: string,
  hoje: string,
  saidaIdEmEdicao?: string,
): OpcaoVinculo[] {
  const opcoes: OpcaoVinculo[] = []
  for (const item of itens) {
    if (item.competencia > mes) continue
    let situacao: SituacaoVinculo | null = null
    if (saidaIdEmEdicao && item.saidaId === saidaIdEmEdicao) situacao = 'vinculada'
    else if (!item.pagamentoId) situacao = item.competencia < mes || statusDaRecorrencia(item, hoje) === 'atrasada' ? 'atrasada' : 'pendente'
    else if (!item.saidaId && item.competencia === mes) situacao = 'manual'
    if (situacao) {
      opcoes.push({ recorrenciaId: item.recorrenciaId, competencia: item.competencia, titulo: item.titulo, situacao, item })
    }
  }
  return opcoes.sort(
    (a, b) =>
      a.competencia.localeCompare(b.competencia) ||
      a.item.dia - b.item.dia ||
      a.titulo.localeCompare(b.titulo),
  )
}

/** Chave única de uma competência de recorrência, para o <select>. */
export function chaveVinculo(v: { recorrenciaId: string; competencia: string }): string {
  return `${v.recorrenciaId}|${v.competencia}`
}
