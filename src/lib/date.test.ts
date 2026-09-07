import { describe, expect, it } from 'vitest'
import { formatarData, nomeDoMes, primeiroDiaDoMes, ultimoDiaDoMes } from './date'

describe('primeiroDiaDoMes', () => {
  it('retorna o primeiro dia do mês', () => {
    expect(primeiroDiaDoMes('2026-09')).toBe('2026-09-01')
  })
})

describe('ultimoDiaDoMes', () => {
  it('retorna o último dia de um mês com 30 dias', () => {
    expect(ultimoDiaDoMes('2026-09')).toBe('2026-09-30')
  })

  it('retorna o último dia de um mês com 31 dias', () => {
    expect(ultimoDiaDoMes('2026-01')).toBe('2026-01-31')
  })

  it('retorna o último dia de fevereiro em ano bissexto', () => {
    expect(ultimoDiaDoMes('2024-02')).toBe('2024-02-29')
  })
})

describe('formatarData', () => {
  it('formata ISO para dd/mm/aaaa', () => {
    expect(formatarData('2026-09-05')).toBe('05/09/2026')
  })
})

describe('nomeDoMes', () => {
  it('formata o nome do mês por extenso', () => {
    expect(nomeDoMes('2026-09')).toBe('setembro de 2026')
  })
})
