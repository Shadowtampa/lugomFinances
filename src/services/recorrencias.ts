import { unwrap } from '../lib/erros'
import { db } from '../lib/api'
import type {
  FaturaPendenteRow,
  RecorrenciaMesRow,
  RecorrenciaRow,
  ResultadoCriarSaidaRow,
} from '../types/api'
import type {
  FaturaPendente,
  Recorrencia,
  RecorrenciaDoMes,
  ResultadoCriarSaida,
} from '../types/domain'
import {
  deRecorrencia,
  paraFaturaPendente,
  paraRecorrencia,
  paraRecorrenciaDoMes,
  paraResultadoCriarSaida,
} from './mappers'

export async function listarRecorrencias(): Promise<Recorrencia[]> {
  const rows = unwrap<RecorrenciaRow[]>(
    await db.from('recorrencias').select('*').order('dia').order('titulo'),
  )
  return rows.map(paraRecorrencia)
}

export async function obterRecorrencia(id: string): Promise<Recorrencia> {
  const row = unwrap<RecorrenciaRow>(await db.from('recorrencias').select('*').eq('id', id).single())
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
