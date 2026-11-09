import { unwrap } from '../lib/erros'
import { db } from '../lib/api'
import type { ApelidoEstabelecimentoRow } from '../types/api'
import type { ApelidoEstabelecimento } from '../types/domain'
import { paraApelido } from './mappers'

/** Campos computados do M22 para pedir junto com saidas/entradas. */
export const CAMPOS_APELIDO = 'chave_estabelecimento,apelido_estabelecimento,descricao_pluggy'

export async function listarApelidos(): Promise<ApelidoEstabelecimento[]> {
  const rows = unwrap<ApelidoEstabelecimentoRow[]>(
    await db.from('apelidos_estabelecimento').select('*').order('apelido'),
  )
  return rows.map(paraApelido)
}

/** Cria ou troca o apelido da chave. Apelido vazio remove. */
export async function definirApelido(chave: string, apelido: string): Promise<void> {
  unwrap(await db.rpc('definir_apelido', { p_chave: chave, p_apelido: apelido }))
}

export async function removerApelido(chave: string): Promise<void> {
  await definirApelido(chave, '')
}
