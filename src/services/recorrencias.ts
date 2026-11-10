import { deslocarMes } from '../lib/date'
import { unwrap } from '../lib/erros'
import { db } from '../lib/api'
import { PAGINA_PLANEJAMENTO } from '../lib/planejamento'
import type { FiltroRecorrencia } from '../lib/recorrencias'
import type {
  FaturaPendenteRow,
  RecorrenciaMesRow,
  RecorrenciaRow,
  ResultadoCriarSaidaRow,
  ResumoPlanejamentoRow,
  TipoPlanejamentoRow,
} from '../types/api'
import type {
  FaturaPendente,
  Recorrencia,
  RecorrenciaDoMes,
  ResultadoCriarSaida,
  ResumoPlanejamento,
  TipoPlanejamento,
} from '../types/domain'
import {
  deRecorrencia,
  paraFaturaPendente,
  paraRecorrencia,
  paraRecorrenciaDoMes,
  paraResultadoCriarSaida,
  paraResumoPlanejamento,
  paraTipoPlanejamento,
} from './mappers'

export async function listarRecorrencias(): Promise<Recorrencia[]> {
  const rows = unwrap<RecorrenciaRow[]>(
    await db.from('recorrencias').select('*').order('dia').order('titulo'),
  )
  return rows.map(paraRecorrencia)
}

export async function obterRecorrencia(id: string): Promise<Recorrencia> {
  const row = unwrap<RecorrenciaRow>(await db.from('recorrencias').select('*, recorrencias_fontes(fonte_id)').eq('id', id).single())
  return paraRecorrencia(row)
}

export async function criarRecorrencia(dados: Omit<Recorrencia, 'id'>): Promise<Recorrencia> {
  const row = unwrap<RecorrenciaRow>(
    await db.from('recorrencias').insert(deRecorrencia(dados)).select().single(),
  )
  return paraRecorrencia(row)
}

export async function atualizarRecorrencia(
  id: string,
  dados: Partial<Omit<Recorrencia, 'id'>>,
): Promise<Recorrencia> {
  const row = unwrap<RecorrenciaRow>(
    await db.from('recorrencias').update(deRecorrencia(dados)).eq('id', id).select().single(),
  )
  return paraRecorrencia(row)
}

export async function definirRecorrenciaAtiva(id: string, ativa: boolean): Promise<void> {
  unwrap(await db.from('recorrencias').update({ ativa }).eq('id', id))
}

export async function excluirRecorrencia(id: string): Promise<void> {
  unwrap(await db.from('recorrencias').delete().eq('id', id))
}

/** competencia: YYYY-MM */
export async function listarRecorrenciasDoMes(competencia: string): Promise<RecorrenciaDoMes[]> {
  const rows = unwrap<RecorrenciaMesRow[]>(
    await db
      .from('v_recorrencias_mes')
      .select('*')
      .eq('competencia', `${competencia}-01`)
      .order('dia')
      .order('titulo'),
  )
  return rows.map(paraRecorrenciaDoMes)
}

/**
 * Competências candidatas a vínculo com uma Saída de `mes` (M28): de mes−3 até mes.
 * O front filtra com `opcoesDeVinculo` (lib/recorrencias).
 */
export async function listarRecorrenciasParaVinculo(mes: string): Promise<RecorrenciaDoMes[]> {
  const rows = unwrap<RecorrenciaMesRow[]>(
    await db
      .from('v_recorrencias_mes')
      .select('*')
      .gte('competencia', `${deslocarMes(mes, -3)}-01`)
      .lte('competencia', `${mes}-01`)
      .order('competencia')
      .order('dia')
      .order('titulo'),
  )
  return rows.map(paraRecorrenciaDoMes)
}

/** competencia: YYYY-MM; pagoEm: YYYY-MM-DD */
export async function marcarComoPaga(
  recorrenciaId: string,
  competencia: string,
  pagoEm: string,
): Promise<void> {
  unwrap(
    await db.from('recorrencias_pagamentos').insert({
      recorrencia_id: recorrenciaId,
      competencia: `${competencia}-01`,
      pago_em: pagoEm,
    }),
  )
}

export async function desmarcarPagamento(pagamentoId: string): Promise<void> {
  unwrap(await db.from('recorrencias_pagamentos').delete().eq('id', pagamentoId))
}

export async function listarFaturasPendentes(): Promise<FaturaPendente[]> {
  const rows = unwrap<FaturaPendenteRow[]>(await db.from('v_faturas_pendentes').select('*'))
  return rows.map(paraFaturaPendente)
}

export async function confirmarFaturaCartao(
  cartaoFonteId: string,
  fontePagadoraId: string,
  valorCentavos: number,
  data: string,
): Promise<ResultadoCriarSaida> {
  const row = unwrap<ResultadoCriarSaidaRow>(
    await db.rpc('confirmar_fatura_cartao', {
      p_cartao_fonte_id: cartaoFonteId,
      p_fonte_pagadora_id: fontePagadoraId,
      p_valor_centavos: valorCentavos,
      p_data: data,
    }),
  )
  return paraResultadoCriarSaida(row)
}

/** Troca o meio de pagamento previsto (M27). Lista vazia remove. Não afeta saldo. */
export async function definirFontesRecorrencia(recorrenciaId: string, fonteIds: string[]): Promise<void> {
  unwrap(await db.rpc('definir_fontes_recorrencia', { p_recorrencia_id: recorrenciaId, p_fonte_ids: fonteIds }))
}

/** Tipos de Planejamento (M29), em ordem de exibição. */
export async function listarTiposPlanejamento(): Promise<TipoPlanejamento[]> {
  const rows = unwrap<TipoPlanejamentoRow[]>(
    await db.from('tipos_planejamento').select('*').order('ordem'),
  )
  return rows.map(paraTipoPlanejamento)
}

/** Pago / previsto / falta por Tipo na competência (YYYY-MM), calculados no banco. */
export async function listarResumoPlanejamento(competencia: string): Promise<ResumoPlanejamento[]> {
  const rows = unwrap<ResumoPlanejamentoRow[]>(
    await db.from('v_planejamento_resumo').select('*').eq('competencia', `${competencia}-01`),
  )
  return rows.map(paraResumoPlanejamento)
}

export type PaginaPlanejamento = { itens: RecorrenciaDoMes[]; total: number }

/**
 * Uma página (10 registros) do mês: `offset` = quantos já foram carregados.
 * `tipoId` omitido = Geral. O filtro de status é aplicado no banco para a contagem bater.
 */
export async function listarPlanejamentoPagina(opcoes: {
  competencia: string
  tipoId?: number
  filtro: FiltroRecorrencia
  offset: number
  /** Quantos registros buscar (padrão: uma página). Usado para recarregar o que já estava na tela. */
  tamanho?: number
}): Promise<PaginaPlanejamento> {
  let consulta = db
    .from('v_recorrencias_mes')
    .select('*', { count: 'exact' })
    .eq('competencia', `${opcoes.competencia}-01`)
  if (opcoes.tipoId !== undefined) consulta = consulta.eq('tipo_planejamento_id', opcoes.tipoId)
  if (opcoes.filtro === 'pagas') consulta = consulta.not('pagamento_id', 'is', null)
  if (opcoes.filtro === 'a-pagar') consulta = consulta.is('pagamento_id', null)
  const resposta = await consulta
    .order('dia')
    .order('titulo')
    .order('recorrencia_id')
    .range(opcoes.offset, opcoes.offset + (opcoes.tamanho ?? PAGINA_PLANEJAMENTO) - 1)
  const rows = unwrap<RecorrenciaMesRow[]>(resposta)
  return { itens: rows.map(paraRecorrenciaDoMes), total: resposta.count ?? rows.length }
}
