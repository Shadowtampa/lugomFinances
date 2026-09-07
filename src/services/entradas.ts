import { primeiroDiaDoMes, ultimoDiaDoMes } from '../lib/date'
import { unwrap } from '../lib/erros'
import { supabase } from '../lib/supabase'
import type { EntradaRow } from '../types/api'
import type { Entrada } from '../types/domain'
import { deEntrada, paraEntrada } from './mappers'

export async function listarEntradas(filtro?: {
  mes?: string
  fonteId?: string
  limite?: number
}): Promise<Entrada[]> {
  let query = supabase.from('entradas').select('*').order('data', { ascending: false })

  if (filtro?.mes) {
    query = query.gte('data', primeiroDiaDoMes(filtro.mes)).lte('data', ultimoDiaDoMes(filtro.mes))
  }
  if (filtro?.fonteId) {
    query = query.eq('fonte_id', filtro.fonteId)
  }
  if (filtro?.limite) {
    query = query.limit(filtro.limite)
  }

  const rows = unwrap<EntradaRow[]>(await query)
  return rows.map(paraEntrada)
}

export async function criarEntrada(dados: Omit<Entrada, 'id'>): Promise<Entrada> {
  const row = unwrap<EntradaRow>(
    await supabase.from('entradas').insert(deEntrada(dados)).select().single(),
  )
  return paraEntrada(row)
}

export async function atualizarEntrada(id: string, dados: Partial<Entrada>): Promise<Entrada> {
  const row = unwrap<EntradaRow>(
    await supabase.from('entradas').update(deEntrada(dados)).eq('id', id).select().single(),
  )
  return paraEntrada(row)
}

export async function excluirEntrada(id: string): Promise<void> {
  unwrap(await supabase.from('entradas').delete().eq('id', id))
}

export async function excluirTemplateRecorrente(
  id: string,
  excluirLancados: boolean,
): Promise<void> {
  if (excluirLancados) {
    unwrap(await supabase.from('entradas').delete().eq('template_id', id))
  }
  unwrap(await supabase.from('entradas').delete().eq('id', id))
}
