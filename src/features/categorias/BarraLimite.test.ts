import { describe, expect, it } from 'vitest'
import { calcularPercentual } from './BarraLimite'

describe('calcularPercentual', () => {
  it('calcula percentual normal', () => {
    expect(calcularPercentual(34000, 120000)).toBe(28)
  })

  it('calcula estouro acima de 100%', () => {
    expect(calcularPercentual(38000, 30000)).toBe(127)
  })

  it('limite zero com gasto retorna 100', () => {
    expect(calcularPercentual(100, 0)).toBe(100)
  })

  it('limite zero sem gasto retorna 0', () => {
    expect(calcularPercentual(0, 0)).toBe(0)
  })
})
