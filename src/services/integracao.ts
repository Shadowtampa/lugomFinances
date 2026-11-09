import { sessaoAtual } from '../lib/auth'
import { db } from '../lib/api'
import { erroDeCodigo, unwrap } from '../lib/erros'
import type {
  ImportadaPendenteRow,
  PluggyContaRow,
  PluggyItemRow,
  StatusIntegracaoRow,
  SugestaoRecorrenciaRow,
} from '../types/api'
import type {
  PluggyConta,
  PluggyItem,
  StatusIntegracao,
  SugestaoRecorrencia,
  TransacaoImportada,
} from '../types/domain'
import {
  paraPluggyConta,
  paraPluggyItem,
  paraStatusIntegracao,
  paraSugestaoRecorrencia,
  paraTransacaoImportada,
} from './mappers'

export async function listarItens(): Promise<PluggyItem[]> {
  const rows = unwrap<PluggyItemRow[]>(await db.from('pluggy_itens').select('*').order('created_at'))
  return rows.map(paraPluggyItem)
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/** Item ID da Pluggy é um UUID; aceita também colado dentro de uma URL. null se não houver UUID. */
export function extrairItemId(texto: string): string | null {
  return texto.match(UUID)?.[0].toLowerCase() ?? null
}

export async function cadastrarItem(itemId: string): Promise<void> {
  const id = extrairItemId(itemId)
  if (!id) throw erroDeCodigo('ITEM_ID_INVALIDO')
  unwrap(await db.from('pluggy_itens').insert({ item_id: id }))
}

export async function removerItem(id: string): Promise<void> {
  unwrap(await db.from('pluggy_itens').delete().eq('id', id))
}

export async function listarContasPluggy(): Promise<PluggyConta[]> {
  const rows = unwrap<PluggyContaRow[]>(await db.from('pluggy_contas').select('*').order('nome'))
  return rows.map(paraPluggyConta)
}

export type NovaFonteVinculo = { nome: string; limiteCentavos?: number; diaFatura?: number }

/** Liga a conta a uma Fonte existente (fonteId) ou cria uma nova; gera o saldo inicial. */
export async function vincularConta(
  pluggyAccountId: string,
  destino: { fonteId: string } | { novaFonte: NovaFonteVinculo },
): Promise<string> {
  return unwrap<string>(
    await db.rpc('vincular_conta_pluggy', {
      p_pluggy_account_id: pluggyAccountId,
      p_fonte_id: 'fonteId' in destino ? destino.fonteId : null,
      p_nova_fonte:
        'novaFonte' in destino
          ? {
              nome: destino.novaFonte.nome,
              limite_centavos: destino.novaFonte.limiteCentavos ?? null,
              dia_fatura: destino.novaFonte.diaFatura ?? null,
            }
          : null,
    }),
  )
}

export async function listarImportadas(): Promise<TransacaoImportada[]> {
  const rows = unwrap<ImportadaPendenteRow[]>(
    await db.from('v_importadas_pendentes').select('*').order('data').order('direcao'),
  )
  return rows.map(paraTransacaoImportada)
}

export async function contarImportadasPendentes(): Promise<number> {
  const { count, error, status } = await db
    .from('transacoes_importadas')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'pendente')
  return unwrap<number>({ data: count, error, status }) ?? 0
}

export async function listarSugestoesRecorrencia(): Promise<SugestaoRecorrencia[]> {
  const rows = unwrap<SugestaoRecorrenciaRow[]>(await db.from('v_sugestoes_recorrencia').select('*'))
  return rows.map(paraSugestaoRecorrencia)
}

export async function confirmarImportada(
  id: string,
  categoriaId: string | null,
  recorrenciaId: string | null,
): Promise<void> {
  unwrap(
    await db.rpc('confirmar_importada', {
      p_id: id,
      p_categoria_id: categoriaId,
      p_recorrencia_id: recorrenciaId,
    }),
  )
}

export async function ignorarImportada(id: string): Promise<void> {
  unwrap(await db.rpc('ignorar_importada', { p_id: id }))
}

export async function desfazerIgnorarImportada(id: string): Promise<void> {
  unwrap(await db.rpc('desfazer_ignorar_importada', { p_id: id }))
}

export async function obterStatusIntegracao(): Promise<StatusIntegracao | null> {
  const row = unwrap<StatusIntegracaoRow | null>(
    await db.from('v_status_integracao').select('*').maybeSingle(),
  )
  return row ? paraStatusIntegracao(row) : null
}

export type ResumoSincronizacao = { sucesso: boolean; importadas: number; erro: string | null }

/** Única chamada fora do PostgREST: POST /sync no worker (M20). */
export async function sincronizarAgora(): Promise<ResumoSincronizacao> {
  let resp: Response
  try {
    resp = await fetch('/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessaoAtual()?.accessToken ?? ''}` },
    })
  } catch {
    throw erroDeCodigo('NETWORK')
  }
  if (resp.ok) return (await resp.json()) as ResumoSincronizacao
  let codigo = 'SINCRONIZACAO_INDISPONIVEL'
  try {
    codigo = ((await resp.json()) as { code?: string }).code ?? codigo
  } catch {
    // corpo não-JSON (ex.: 502 do nginx)
  }
  throw erroDeCodigo(codigo, resp.status)
}
