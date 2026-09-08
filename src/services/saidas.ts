import { primeiroDiaDoMes, ultimoDiaDoMes } from '../lib/date'
import { unwrap } from '../lib/erros'
import { supabase } from '../lib/supabase'
import type { ResultadoCriarSaidaRow, SaidaRow } from '../types/api'
import type { ResultadoCriarSaida, Saida } from '../types/domain'
import { paraResultadoCriarSaida, paraSaida } from './mappers'

export async function listarSaidas(filtro?: {
  mes?: string
  categoriaId?: string
  fonteId?: string
  limite?: number
  pagina?: number
  porPagina?: number
}): Promise<Saida[]> {
  let query = filtro?.fonteId
    ? supabase.from('saidas').select('*, saida_splits!inner(fonte_id,valor_centavos)')
    : supabase.from('saidas').select('*, saida_splits(fonte_id,valor_centavos)')
  query = query.order('data', { ascending: false })

  if (filtro?.mes) {
    query = query.gte('data', primeiroDiaDoMes(filtro.mes)).lte('data', ultimoDiaDoMes(filtro.mes))
  }
  if (filtro?.categoriaId) {
    query = query.eq('categoria_id', filtro.categoriaId)
  }
  if (filtro?.fonteId) {
    query = query.eq('saida_splits.fonte_id', filtro.fonteId)
  }
  if (filtro?.limite) {
    query = query.limit(filtro.limite)
  }
  if (filtro?.pagina && filtro?.porPagina) {
    const inicio = (filtro.pagina - 1) * filtro.porPagina
    query = query.range(inicio, inicio + filtro.porPagina - 1)
  }

  const rows = unwrap<SaidaRow[]>(await query)
  return rows.map(paraSaida)
}

export async function contarSaidas(filtro?: {
  mes?: string
  categoriaId?: string
  fonteId?: string
}): Promise<number> {
  let query = filtro?.fonteId
    ? supabase.from('saidas').select('*, saida_splits!inner(fonte_id)', { count: 'exact', head: true })
    : supabase.from('saidas').select('*', { count: 'exact', head: true })

  if (filtro?.mes) {
    query = query.gte('data', primeiroDiaDoMes(filtro.mes)).lte('data', ultimoDiaDoMes(filtro.mes))
  }
  if (filtro?.categoriaId) {
    query = query.eq('categoria_id', filtro.categoriaId)
  }
  if (filtro?.fonteId) {
    query = query.eq('saida_splits.fonte_id', filtro.fonteId)
  }

  const { count, error, status } = await query
  return unwrap<number>({ data: count, error, status }) ?? 0
}

export async function somarSaidasMes(
  mes: string,
  filtro?: { categoriaId?: string; fonteId?: string },
): Promise<number> {
  let query = filtro?.fonteId
    ? supabase.from('saidas').select('valor_total_centavos, saida_splits!inner(fonte_id)')
    : supabase.from('saidas').select('valor_total_centavos')

  query = query.gte('data', primeiroDiaDoMes(mes)).lte('data', ultimoDiaDoMes(mes))
  if (filtro?.categoriaId) {
    query = query.eq('categoria_id', filtro.categoriaId)
  }
  if (filtro?.fonteId) {
    query = query.eq('saida_splits.fonte_id', filtro.fonteId)
  }

  const rows = unwrap<{ valor_total_centavos: number }[]>(await query)
  return rows.reduce((soma, row) => soma + row.valor_total_centavos, 0)
}

export async function obterSaida(id: string): Promise<Saida> {
  const row = unwrap<SaidaRow>(
    await supabase
      .from('saidas')
      .select('*, saida_splits(fonte_id,valor_centavos)')
      .eq('id', id)
      .single(),
  )
  return paraSaida(row)
}

export async function definirRecorrenciaAtivaSaida(id: string, ativa: boolean): Promise<void> {
  unwrap(await supabase.from('saidas').update({ recorrencia_ativa: ativa }).eq('id', id))
}

function paraSplitsRpc(splits: Saida['splits']) {
  return splits.map((split) => ({ fonte_id: split.fonteId, valor_centavos: split.valorCentavos }))
}

export async function criarSaida(dados: Omit<Saida, 'id'>): Promise<ResultadoCriarSaida> {
  const row = unwrap<ResultadoCriarSaidaRow>(
    await supabase.rpc('criar_saida', {
      p_titulo: dados.titulo,
      p_valor_total_centavos: dados.valorTotalCentavos,
      p_categoria_id: dados.categoriaId,
      p_data: dados.data,
      p_splits: paraSplitsRpc(dados.splits),
      p_recorrente: dados.recorrente,
      p_dia_recorrencia: dados.diaRecorrencia,
      p_template_id: dados.templateId,
      p_total_parcelas: dados.totalParcelas,
    }),
  )
  return paraResultadoCriarSaida(row)
}

export async function atualizarSaida(
  id: string,
  dados: Omit<Saida, 'id'>,
): Promise<ResultadoCriarSaida> {
  const row = unwrap<ResultadoCriarSaidaRow>(
    await supabase.rpc('atualizar_saida', {
      p_saida_id: id,
      p_titulo: dados.titulo,
      p_valor_total_centavos: dados.valorTotalCentavos,
      p_categoria_id: dados.categoriaId,
      p_data: dados.data,
      p_splits: paraSplitsRpc(dados.splits),
      p_recorrente: dados.recorrente,
      p_dia_recorrencia: dados.diaRecorrencia,
      p_template_id: dados.templateId,
      p_total_parcelas: dados.totalParcelas,
    }),
  )
  return paraResultadoCriarSaida(row)
}

export async function excluirSaida(id: string): Promise<void> {
  unwrap(await supabase.rpc('excluir_saida', { p_saida_id: id }))
}
