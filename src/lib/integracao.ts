import { diasDesde } from './date'
import { mensagemErroSincronizacao } from './erros'
import type { StatusIntegracao } from '../types/domain'

export const DIAS_SEM_SINCRONIZAR = 3

export type AvisoIntegracao =
  | { tipo: 'falhou'; em: string; motivo: string }
  | { tipo: 'reconectar'; nomes: string[] }
  | { tipo: 'parado'; dias: number | null }

/**
 * Avisos do Painel (M20, decisão Q10b). Ordem de prioridade: reconectar banco >
 * última sincronização falhou > sem sincronização bem-sucedida há 3+ dias.
 */
export function avisosIntegracao(status: StatusIntegracao | null, agora: Date = new Date()): AvisoIntegracao[] {
  if (!status || status.totalItens === 0) return []
  const avisos: AvisoIntegracao[] = []

  if (status.itensComProblema.length > 0) {
    avisos.push({ tipo: 'reconectar', nomes: status.itensComProblema.map((i) => i.nome ?? i.itemId) })
  }
  if (status.ultimaSincronizacaoSucesso === false && status.ultimaSincronizacaoEm) {
    avisos.push({
      tipo: 'falhou',
      em: status.ultimaSincronizacaoEm,
      motivo: mensagemErroSincronizacao(status.ultimaSincronizacaoErro),
    })
  }
  if (!status.ultimaSincronizacaoOkEm) {
    // Item cadastrado mas nunca sincronizou com sucesso (e não há falha registrada para explicar).
    if (status.ultimaSincronizacaoSucesso !== false) avisos.push({ tipo: 'parado', dias: null })
  } else {
    const dias = diasDesde(status.ultimaSincronizacaoOkEm, agora)
    if (dias >= DIAS_SEM_SINCRONIZAR) avisos.push({ tipo: 'parado', dias })
  }
  return avisos
}

/** Ordem do "Confirmar todas": data crescente, Entradas antes de Saídas no mesmo dia (RN-02). */
export function ordenarParaConfirmacao<T extends { data: string; direcao: 'entrada' | 'saida' }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1
    if (a.direcao === b.direcao) return 0
    return a.direcao === 'entrada' ? -1 : 1
  })
}
