import { describe, expect, it } from 'vitest'
import { avisosIntegracao } from './integracao'
import type { StatusIntegracao } from '../types/domain'

const AGORA = new Date(2026, 10, 20, 10)
const ontem = new Date(2026, 10, 19, 10).toISOString()
const tresDias = new Date(2026, 10, 17, 10).toISOString()

function status(p: Partial<StatusIntegracao>): StatusIntegracao {
  return {
    totalItens: 1,
    ultimaSincronizacaoEm: ontem,
    ultimaSincronizacaoSucesso: true,
    ultimaSincronizacaoErro: null,
    ultimaSincronizacaoImportadas: 3,
    ultimaSincronizacaoOkEm: ontem,
    itensComProblema: [],
    ...p,
  }
}

describe('avisosIntegracao', () => {
  it('nada quando não há itens ou tudo está ok', () => {
    expect(avisosIntegracao(null, AGORA)).toEqual([])
    expect(avisosIntegracao(status({ totalItens: 0 }), AGORA)).toEqual([])
    expect(avisosIntegracao(status({}), AGORA)).toEqual([])
  })
  it('falha da última sincronização com motivo traduzido', () => {
    expect(
      avisosIntegracao(status({ ultimaSincronizacaoSucesso: false, ultimaSincronizacaoErro: 'PLUGGY_AUTH_FALHOU: HTTP 401' }), AGORA),
    ).toEqual([{ tipo: 'falhou', em: ontem, motivo: 'credenciais da Pluggy recusadas' }])
  })
  it('item pedindo reautenticação', () => {
    expect(
      avisosIntegracao(status({ itensComProblema: [{ itemId: 'i1', nome: 'Banco Inter', status: 'LOGIN_ERROR' }] }), AGORA),
    ).toEqual([{ tipo: 'reconectar', nomes: ['Banco Inter'] }])
  })
  it('sem sincronização bem-sucedida há 3+ dias', () => {
    expect(avisosIntegracao(status({ ultimaSincronizacaoOkEm: tresDias, ultimaSincronizacaoEm: tresDias }), AGORA)).toEqual([
      { tipo: 'parado', dias: 3 },
    ])
  })
  it('item cadastrado que nunca sincronizou', () => {
    expect(
      avisosIntegracao(status({ ultimaSincronizacaoOkEm: null, ultimaSincronizacaoEm: null, ultimaSincronizacaoSucesso: null }), AGORA),
    ).toEqual([{ tipo: 'parado', dias: null }])
  })
})

describe('ordenarParaConfirmacao', () => {
  it('ordena por data e põe entradas antes de saídas no mesmo dia', async () => {
    const { ordenarParaConfirmacao } = await import('./integracao')
    const r = ordenarParaConfirmacao([
      { id: 'a', data: '2026-11-10', direcao: 'saida' as const },
      { id: 'b', data: '2026-11-09', direcao: 'saida' as const },
      { id: 'c', data: '2026-11-10', direcao: 'entrada' as const },
    ])
    expect(r.map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('extrairItemId', () => {
  it('aceita UUID puro ou dentro de URL e recusa lixo', async () => {
    const { extrairItemId } = await import('../services/integracao')
    expect(extrairItemId(' 5CB4F77D-9d87-4b9f-b09d-17a9d4600894 ')).toBe('5cb4f77d-9d87-4b9f-b09d-17a9d4600894')
    expect(extrairItemId('https://x/connections/f083338d-3e5f-4a76-ae12-6ad6cbbaf752')).toBe('f083338d-3e5f-4a76-ae12-6ad6cbbaf752')
    expect(extrairItemId('abc')).toBeNull()
  })
})
