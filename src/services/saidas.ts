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
}): Promise<Saida[]> {
  let query = supabase
    .from('saidas')
    .select('*, saida_splits(fonte_id,valor_centavos)')
    .order('data', { ascending: false })

  if (filtro?.mes) {
    query = query.gte('data', primeiroDiaDoMes(filtro.mes)).lte('data', ultimoDiaDoMes(filtro.mes))
  }
  if (filtro?.categoriaId) {
    query = query.eq('categoria_id', filtro.categoriaId)
  }
  if (filtro?.limite) {
    query = query.limit(filtro.limite)
  }

  const rows = unwrap<SaidaRow[]>(await query)
  const saidas = rows.map(paraSaida)

  return filtro?.fonteId
    ? saidas.filter((saida) => saida.splits.some((split) => split.fonteId === filtro.fonteId))
    : saidas
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
    }),
  )
  return paraResultadoCriarSaida(row)
}

export async function excluirSaida(id: string): Promise<void> {
  unwrap(await supabase.rpc('excluir_saida', { p_saida_id: id }))
}
