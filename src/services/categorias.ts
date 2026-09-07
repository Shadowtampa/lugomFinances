import { unwrap } from '../lib/erros'
import { supabase } from '../lib/supabase'
import type { CategoriaRow, SaldoCategoriaRow } from '../types/api'
import type { Categoria, SaldoCategoria } from '../types/domain'
import { deCategoria, paraCategoria, paraSaldoCategoria } from './mappers'

export async function listarCategorias(opts?: {
  incluirArquivadas?: boolean
}): Promise<Categoria[]> {
  let query = supabase.from('categorias').select('*').order('nome')
  if (!opts?.incluirArquivadas) {
    query = query.eq('arquivada', false)
  }
  const rows = unwrap<CategoriaRow[]>(await query)
  return rows.map(paraCategoria)
}

export async function criarCategoria(
  dados: Omit<Categoria, 'id' | 'arquivada'>,
): Promise<Categoria> {
  const row = unwrap<CategoriaRow>(
    await supabase.from('categorias').insert(deCategoria(dados)).select().single(),
  )
  return paraCategoria(row)
}

export async function obterCategoria(id: string): Promise<Categoria> {
  const row = unwrap<CategoriaRow>(
    await supabase.from('categorias').select('*').eq('id', id).single(),
  )
  return paraCategoria(row)
}

export async function atualizarCategoria(
  id: string,
  dados: Partial<Categoria>,
): Promise<Categoria> {
  const row = unwrap<CategoriaRow>(
    await supabase.from('categorias').update(deCategoria(dados)).eq('id', id).select().single(),
  )
  return paraCategoria(row)
}

export async function arquivarCategoria(id: string): Promise<void> {
  unwrap(await supabase.from('categorias').update({ arquivada: true }).eq('id', id))
}

export async function listarSaldosCategorias(): Promise<SaldoCategoria[]> {
  const rows = unwrap<SaldoCategoriaRow[]>(
    await supabase.from('v_saldo_categorias').select('*').order('nome'),
  )
  return rows.map(paraSaldoCategoria)
}
