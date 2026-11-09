import { primeiroDiaDoMes, ultimoDiaDoMes } from '../lib/date'
import { unwrap } from '../lib/erros'
import { db } from '../lib/api'
import type { EntradaRow } from '../types/api'
import type { Entrada } from '../types/domain'
import { CAMPOS_APELIDO } from './apelidos'
import { deEntrada, paraEntrada } from './mappers'

export async function listarEntradas(filtro?: {
  mes?: string
  fonteId?: string
  limite?: number
  pagina?: number
  porPagina?: number
}): Promise<Entrada[]> {
  let query = db
    .from('entradas')
    .select(`*, ${CAMPOS_APELIDO}`)
    .order('data', { ascending: false })

  if (filtro?.mes) {
    query = query.gte('data', primeiroDiaDoMes(filtro.mes)).lte('data', ultimoDiaDoMes(filtro.mes))
  }
  if (filtro?.fonteId) {
    query = query.eq('fonte_id', filtro.fonteId)
  }
  if (filtro?.limite) {
    query = query.limit(filtro.limite)
  }
  if (filtro?.pagina && filtro?.porPagina) {
    const inicio = (filtro.pagina - 1) * filtro.porPagina
    query = query.range(inicio, inicio + filtro.porPagina - 1)
  }

  const rows = unwrap<EntradaRow[]>(await query)
  return rows.map(paraEntrada)
}

export async function contarEntradas(filtro?: { mes?: string; fonteId?: string }): Promise<number> {
  let query = db.from('entradas').select('*', { count: 'exact', head: true })

  if (filtro?.mes) {
    query = query.gte('data', primeiroDiaDoMes(filtro.mes)).lte('data', ultimoDiaDoMes(filtro.mes))
  }
  if (filtro?.fonteId) {
    query = query.eq('fonte_id', filtro.fonteId)
  }

  const { count, error, status } = await query
  return unwrap<number>({ data: count, error, status }) ?? 0
}

export async function somarEntradasMes(mes: string, fonteId?: string): Promise<number> {
  let query = db
    .from('entradas')
    .select('valor_centavos')
    .gte('data', primeiroDiaDoMes(mes))
    .lte('data', ultimoDiaDoMes(mes))

  if (fonteId) {
    query = query.eq('fonte_id', fonteId)
  }

  const rows = unwrap<{ valor_centavos: number }[]>(await query)
  return rows.reduce((soma, row) => soma + row.valor_centavos, 0)
}

export async function obterEntrada(id: string): Promise<Entrada> {
  const row = unwrap<EntradaRow>(await db.from('entradas').select(`*, ${CAMPOS_APELIDO}`).eq('id', id).single())
  return paraEntrada(row)
}

export async function criarEntrada(dados: Omit<Entrada, 'id'>): Promise<Entrada> {
  const row = unwrap<EntradaRow>(
    await db.from('entradas').insert(deEntrada(dados)).select().single(),
  )
  return paraEntrada(row)
}

export async function atualizarEntrada(id: string, dados: Partial<Entrada>): Promise<Entrada> {
  const row = unwrap<EntradaRow>(
    await db.from('entradas').update(deEntrada(dados)).eq('id', id).select().single(),
  )
  return paraEntrada(row)
}

export async function excluirEntrada(id: string): Promise<void> {
  unwrap(await db.from('entradas').delete().eq('id', id))
}

