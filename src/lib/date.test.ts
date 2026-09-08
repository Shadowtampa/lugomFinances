import { describe, expect, it } from 'vitest'
import {
  deslocarMes,
  formatarData,
  nomeDoMes,
  primeiroDiaDoMes,
  resolverDiaRecorrencia,
  ultimoDiaDoMes,
} from './date'

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

describe('resolverDiaRecorrencia', () => {
  it('mantém o dia quando ele existe no mês (mês de 30 dias)', () => {
    expect(resolverDiaRecorrencia('2026-09', 30)).toBe('2026-09-30')
  })

  it('ajusta dia 31 para o último dia de um mês de 30 dias', () => {
    expect(resolverDiaRecorrencia('2026-09', 31)).toBe('2026-09-30')
  })

  it('ajusta dia 31 para 28 em fevereiro de ano comum', () => {
    expect(resolverDiaRecorrencia('2026-02', 31)).toBe('2026-02-28')
  })

  it('ajusta dia 31 para 29 em fevereiro de ano bissexto', () => {
    expect(resolverDiaRecorrencia('2024-02', 31)).toBe('2024-02-29')
  })
})

describe('deslocarMes', () => {
  it('avança um mês', () => {
    expect(deslocarMes('2026-09', 1)).toBe('2026-10')
  })

  it('retrocede um mês', () => {
    expect(deslocarMes('2026-09', -1)).toBe('2026-08')
  })

  it('cruza a virada de ano ao avançar', () => {
    expect(deslocarMes('2026-12', 1)).toBe('2027-01')
  })

  it('cruza a virada de ano ao retroceder', () => {
    expect(deslocarMes('2026-01', -1)).toBe('2025-12')
  })
})
