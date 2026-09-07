import { describe, expect, it } from 'vitest'
import { centavosParaReais, formatBRL, parseBRL } from './money'

describe('formatBRL', () => {
  it('formata centavos como moeda BRL', () => {
    expect(formatBRL(123456)).toBe('R$ 1.234,56')
  })

  it('formata zero', () => {
    expect(formatBRL(0)).toBe('R$ 0,00')
  })

  it('formata valores negativos', () => {
    expect(formatBRL(-500)).toBe('-R$ 5,00')
  })
})

describe('parseBRL', () => {
  it('converte "1234,56" em 123456 centavos', () => {
    expect(parseBRL('1234,56')).toBe(123456)
  })

  it('converte "1.234,56" (com separador de milhar) em 123456', () => {
    expect(parseBRL('1.234,56')).toBe(123456)
  })

  it('converte valor sem centavos', () => {
    expect(parseBRL('50')).toBe(5000)
  })

  it('converte string vazia em 0', () => {
    expect(parseBRL('')).toBe(0)
  })
})

describe('centavosParaReais', () => {
  it('converte centavos em reais', () => {
    expect(centavosParaReais(123456)).toBe(1234.56)
  })
})
