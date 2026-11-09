import { describe, expect, it } from 'vitest'
import { dataLocal, decidirSumidas, normalizarTransacao, type TransacaoPluggy } from './normalizar.ts'
import cartao from './fixtures/transacoes-cartao.json'
import conta from './fixtures/transacoes-conta.json'

const CORTE = '2026-11-08'
const HOJE = '2026-11-20'

describe('dataLocal', () => {
  it('converte UTC para o dia em São Paulo (02:30Z ainda é o dia anterior)', () => {
    expect(dataLocal('2026-11-10T02:30:00.000Z')).toBe('2026-11-09')
    expect(dataLocal('2026-11-10T03:00:00.000Z')).toBe('2026-11-10')
  })
})

describe('normalizarTransacao — conta', () => {
  const [debito, credito, pendente, antesDoCorte] = conta as TransacaoPluggy[]

  it('DEBIT vira saída com centavos positivos', () => {
    expect(normalizarTransacao(debito, 'BANK', CORTE, HOJE)).toMatchObject({
      direcao: 'saida',
      valorCentavos: 9990,
      data: '2026-11-10',
      statusPluggy: 'POSTED',
    })
  })
  it('CREDIT vira entrada', () => {
    expect(normalizarTransacao(credito, 'BANK', CORTE, HOJE)?.direcao).toBe('entrada')
  })
  it('PENDING de conta não entra', () => {
    expect(normalizarTransacao(pendente, 'BANK', CORTE, HOJE)).toBeNull()
  })
  it('transação no dia do corte ou antes não entra', () => {
    expect(normalizarTransacao(antesDoCorte, 'BANK', CORTE, HOJE)).toBeNull()
  })
})

describe('normalizarTransacao — cartão', () => {
  const [compraPendente, pagamento, parcelaFutura, arredondamento] = cartao as TransacaoPluggy[]

  it('compra PENDING entra como saída, com parcela', () => {
    expect(normalizarTransacao(compraPendente, 'CREDIT', CORTE, HOJE)).toMatchObject({
      direcao: 'saida',
      valorCentavos: 2500,
      statusPluggy: 'PENDING',
      parcela: 1,
      totalParcelas: 3,
    })
  })
  it('valor negativo (pagamento/estorno) vira entrada', () => {
    expect(normalizarTransacao(pagamento, 'CREDIT', CORTE, HOJE)).toMatchObject({
      direcao: 'entrada',
      valorCentavos: 30000,
    })
  })
  it('parcela futura não entra', () => {
    expect(normalizarTransacao(parcelaFutura, 'CREDIT', CORTE, HOJE)).toBeNull()
  })
  it('parcela traz a data da compra original (fuso de SP); compra à vista não', () => {
    const parcela: TransacaoPluggy = {
      ...compraPendente,
      creditCardMetadata: { installmentNumber: 3, totalInstallments: 3, purchaseDate: '2026-09-12T01:56:12.000Z' },
    }
    expect(normalizarTransacao(parcela, 'CREDIT', CORTE, HOJE)?.dataCompra).toBe('2026-09-11')
    expect(normalizarTransacao(pagamento, 'CREDIT', CORTE, HOJE)?.dataCompra).toBeNull()
  })
  it('arredonda para centavos inteiros', () => {
    expect(normalizarTransacao(arredondamento, 'CREDIT', CORTE, HOJE)?.valorCentavos).toBe(1999)
  })
})

describe('decidirSumidas', () => {
  it('apaga pendente sumida, marca confirmada sumida como divergente, ignora o resto', () => {
    const r = decidirSumidas(
      [
        { id: 'a', pluggyTransactionId: 'p1', estado: 'pendente', statusPluggy: 'PENDING' },
        { id: 'b', pluggyTransactionId: 'p2', estado: 'confirmada', statusPluggy: 'PENDING' },
        { id: 'c', pluggyTransactionId: 'p3', estado: 'pendente', statusPluggy: 'PENDING' },
        { id: 'd', pluggyTransactionId: 'p4', estado: 'pendente', statusPluggy: 'POSTED' },
        { id: 'e', pluggyTransactionId: 'p5', estado: 'ignorada', statusPluggy: 'PENDING' },
      ],
      new Set(['p3']),
    )
    expect(r).toEqual({ apagar: ['a'], divergentes: ['b'] })
  })
})
