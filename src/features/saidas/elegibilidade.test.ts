import { describe, expect, it } from 'vitest'
import { avaliarFonte, type FonteComSaldo } from './elegibilidade'
import type { Categoria } from '../../types/domain'

const categorias: Categoria[] = [
  { id: 'cat-transporte', nome: 'Transporte', limiteMensalCentavos: null, vigenciaInicio: '2026-01-01', cor: '#000', arquivada: false },
  { id: 'cat-alimentacao', nome: 'Alimentação', limiteMensalCentavos: null, vigenciaInicio: '2026-01-01', cor: '#000', arquivada: false },
]

const fonteLivre: FonteComSaldo = {
  id: 'f-livre',
  nome: 'Conta Corrente',
  tipo: 'livre',
  cor: '#000',
  arquivada: false,
  ehCartao: false,
  limiteCentavos: null,
  diaFatura: null,
  saldoCentavos: 100000,
}

const fonteRestrita: FonteComSaldo = {
  id: 'f-restrita',
  nome: 'VR Flash',
  tipo: 'restrita',
  cor: '#000',
  arquivada: false,
  ehCartao: false,
  limiteCentavos: null,
  diaFatura: null,
  categoriasPermitidas: ['cat-alimentacao'],
  saldoCentavos: 85500,
}

const fonteCartao: FonteComSaldo = {
  id: 'f-cartao',
  nome: 'Nubank',
  tipo: 'livre',
  cor: '#000',
  arquivada: false,
  ehCartao: true,
  limiteCentavos: 100000,
  diaFatura: 10,
  saldoCentavos: -60000,
}

describe('avaliarFonte', () => {
  it('fonte livre é sempre elegível por categoria', () => {
    expect(avaliarFonte(fonteLivre, 'cat-transporte', categorias, 1000).elegivel).toBe(true)
  })

  it('fonte restrita rejeita categoria não permitida', () => {
    const resultado = avaliarFonte(fonteRestrita, 'cat-transporte', categorias, 1000)
    expect(resultado.elegivel).toBe(false)
    expect(resultado.motivo).toBe('não aceita Transporte')
  })

  it('fonte restrita aceita categoria permitida', () => {
    expect(avaliarFonte(fonteRestrita, 'cat-alimentacao', categorias, 1000).elegivel).toBe(true)
  })

  it('rejeita quando saldo é insuficiente', () => {
    const resultado = avaliarFonte(fonteLivre, 'cat-transporte', categorias, 1000000)
    expect(resultado.elegivel).toBe(false)
    expect(resultado.motivo).toBe('R$ 1.000,00 disponíveis')
  })

  it('categoria bloqueante tem precedência sobre saldo insuficiente', () => {
    const resultado = avaliarFonte(fonteRestrita, 'cat-transporte', categorias, 1000000)
    expect(resultado.motivo).toBe('não aceita Transporte')
  })

  it('valor zero não aciona checagem de saldo', () => {
    expect(avaliarFonte(fonteLivre, 'cat-transporte', categorias, 0).elegivel).toBe(true)
  })

  it('cartão aceita compra dentro do limite mesmo com saldo negativo', () => {
    expect(avaliarFonte(fonteCartao, 'cat-transporte', categorias, 30000).elegivel).toBe(true)
  })

  it('cartão rejeita compra que estouraria o limite', () => {
    const resultado = avaliarFonte(fonteCartao, 'cat-transporte', categorias, 50000)
    expect(resultado.elegivel).toBe(false)
    expect(resultado.motivo).toBe('limite de R$ 1.000,00 insuficiente')
  })
})
