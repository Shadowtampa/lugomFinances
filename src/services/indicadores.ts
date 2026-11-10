import type { PostgrestResponse } from '@supabase/postgrest-js'
import { unwrap } from '../lib/erros'
import { db } from '../lib/api'
import type {
  EntradaDiaFonteRow,
  PagamentoFaturaMesRow,
  ParcelaCartaoRestanteRow,
  RecorrenciaMesRow,
  SaidaDiaCategoriaRow,
  SaidaFonteRow,
} from '../types/api'
import type {
  PagamentoFaturaMes,
  ParcelaCartaoRestante,
  ParcelaPlanejamentoFutura,
  SaidaNaFonte,
  SomaEntradaDia,
  SomaSaidaDia,
} from '../types/domain'
import {
  paraPagamentoFaturaMes,
  paraParcelaCartaoRestante,
  paraSaidaNaFonte,
  paraSomaEntradaDia,
  paraSomaSaidaDia,
} from './mappers'

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

/** Splits de Saída por Fonte no intervalo (M32). View: v_saidas_fonte. */
export async function listarSaidasNasFontes(de: string, ate: string): Promise<SaidaNaFonte[]> {
  const rows = await buscarTudo<SaidaFonteRow>((inicio, fim) =>
    db
      .from('v_saidas_fonte')
      .select('*')
      .gte('data', de)
      .lte('data', ate)
      .order('data')
      .order('saida_id')
      .order('fonte_id')
      .range(inicio, fim),
  )
  return rows.map(paraSaidaNaFonte)
}

/** Pagamentos de fatura por cartão e mês, de `deMes` (YYYY-MM-DD, dia 1º) em diante (M32). */
export async function listarPagamentosFaturaMes(deMes: string): Promise<PagamentoFaturaMes[]> {
  const rows = unwrap<PagamentoFaturaMesRow[]>(
    await db.from('v_pagamentos_fatura_mes').select('*').gte('mes', deMes).order('mes'),
  )
  return rows.map(paraPagamentoFaturaMes)
}

/** Parcelas de cartão que ainda vão vencer (M32). View: v_parcelas_cartao_restantes. */
export async function listarParcelasCartaoRestantes(): Promise<ParcelaCartaoRestante[]> {
  const rows = unwrap<ParcelaCartaoRestanteRow[]>(await db.from('v_parcelas_cartao_restantes').select('*'))
  return rows.map(paraParcelaCartaoRestante)
}

/** Competências de Planejamentos parcelados ainda não pagas, do mês de `deMes` em diante (M32). */
export async function listarParcelasPlanejamentoFuturas(deMes: string): Promise<ParcelaPlanejamentoFutura[]> {
  const rows = unwrap<Pick<RecorrenciaMesRow, 'titulo' | 'competencia' | 'valor_previsto_centavos'>[]>(
    await db
      .from('v_recorrencias_mes')
      .select('titulo,competencia,valor_previsto_centavos')
      .not('total_parcelas', 'is', null)
      .is('pagamento_id', null)
      .eq('ativa', true)
      .gte('competencia', deMes)
      .order('competencia'),
  )
  return rows.map((r) => ({
    titulo: r.titulo,
    competencia: r.competencia,
    valorPrevistoCentavos: r.valor_previsto_centavos,
  }))
}
