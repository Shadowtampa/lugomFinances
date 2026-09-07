import { unwrap } from '../lib/erros'
import { supabase } from '../lib/supabase'
import type { FonteRow, SaldoFonteRow } from '../types/api'
import type { Fonte, SaldoFonte } from '../types/domain'
import { deFonte, paraFonte, paraSaldoFonte } from './mappers'

type FonteRowComCategorias = FonteRow & {
  fonte_categorias?: { categoria_id: string }[]
}

export async function listarFontes(opts?: { incluirArquivadas?: boolean }): Promise<Fonte[]> {
  let query = supabase
    .from('fontes')
    .select('*, fonte_categorias(categoria_id)')
    .order('nome')
  if (!opts?.incluirArquivadas) {
    query = query.eq('arquivada', false)
  }
  const rows = unwrap<FonteRowComCategorias[]>(await query)
  return rows.map((row) =>
    paraFonte(
      row,
      row.tipo === 'restrita' ? row.fonte_categorias?.map((fc) => fc.categoria_id) : undefined,
    ),
  )
}

export async function criarFonte(
  dados: Omit<Fonte, 'id' | 'arquivada' | 'categoriasPermitidas'>,
  categoriasPermitidas: string[],
): Promise<Fonte> {
  const fonteRow = unwrap<FonteRow>(
    await supabase.from('fontes').insert(deFonte(dados)).select().single(),
  )

  if (categoriasPermitidas.length > 0) {
    const { error } = await supabase
      .from('fonte_categorias')
      .insert(categoriasPermitidas.map((categoriaId) => ({ fonte_id: fonteRow.id, categoria_id: categoriaId })))

    if (error) {
      // Não há transação via REST — desfaz a fonte criada se o vínculo falhar.
      await supabase.from('fontes').delete().eq('id', fonteRow.id)
      unwrap({ data: null, error })
    }
  }

  return paraFonte(fonteRow, categoriasPermitidas)
}

export async function atualizarFonte(
  id: string,
  dados: Partial<Omit<Fonte, 'id' | 'categoriasPermitidas'>>,
  categoriasPermitidas?: string[],
): Promise<Fonte> {
  const fonteRow = unwrap<FonteRow>(
    await supabase.from('fontes').update(deFonte(dados)).eq('id', id).select().single(),
  )

  if (categoriasPermitidas !== undefined) {
    unwrap(await supabase.from('fonte_categorias').delete().eq('fonte_id', id))
    if (categoriasPermitidas.length > 0) {
      unwrap(
        await supabase
          .from('fonte_categorias')
          .insert(categoriasPermitidas.map((categoriaId) => ({ fonte_id: id, categoria_id: categoriaId }))),
      )
    }
  }

  return paraFonte(fonteRow, categoriasPermitidas)
}

export async function arquivarFonte(id: string): Promise<void> {
  unwrap(await supabase.from('fontes').update({ arquivada: true }).eq('id', id))
}

export async function listarSaldosFontes(): Promise<SaldoFonte[]> {
  const rows = unwrap<SaldoFonteRow[]>(await supabase.from('v_saldo_fontes').select('*').order('nome'))
  return rows.map(paraSaldoFonte)
}
