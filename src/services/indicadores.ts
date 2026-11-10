import type { PostgrestResponse } from '@supabase/postgrest-js'
import { unwrap } from '../lib/erros'
import { db } from '../lib/api'
import type { EntradaDiaFonteRow, SaidaDiaCategoriaRow } from '../types/api'
import type { SomaEntradaDia, SomaSaidaDia } from '../types/domain'
import { paraSomaEntradaDia, paraSomaSaidaDia } from './mappers'

/** PostgREST devolve no máximo 1000 linhas por chamada; busca por faixas até acabar. */
const TAMANHO_PAGINA = 1000

async function buscarTudo<T>(
  pagina: (inicio: number, fim: number) => PromiseLike<PostgrestResponse<T>>,
): Promise<T[]> {
  const todas: T[] = []
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const rows = unwrap<T[]>(await pagina(inicio, inicio + TAMANHO_PAGINA - 1))
    todas.push(...rows)
    if (rows.length < TAMANHO_PAGINA) return todas
  }
}

/** Saídas somadas por dia e Categoria no intervalo (inclusive). Views: v_saidas_dia_categoria (M31). */
export async function listarSomasSaidas(de: string, ate: string): Promise<SomaSaidaDia[]> {
  const rows = await buscarTudo<SaidaDiaCategoriaRow>((inicio, fim) =>
    db
      .from('v_saidas_dia_categoria')
      .select('*')
      .gte('data', de)
      .lte('data', ate)
      .order('data')
      .order('categoria_id')
      .range(inicio, fim),
  )
  return rows.map(paraSomaSaidaDia)
}

/** Entradas somadas por dia e Fonte no intervalo (inclusive). Views: v_entradas_dia_fonte (M31). */
export async function listarSomasEntradas(de: string, ate: string): Promise<SomaEntradaDia[]> {
  const rows = await buscarTudo<EntradaDiaFonteRow>((inicio, fim) =>
    db
      .from('v_entradas_dia_fonte')
      .select('*')
      .gte('data', de)
      .lte('data', ate)
      .order('data')
      .order('fonte_id')
      .range(inicio, fim),
  )
  return rows.map(paraSomaEntradaDia)
}
