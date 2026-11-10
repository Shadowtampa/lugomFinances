import { beforeEach, describe, expect, it, vi } from 'vitest'

const chamadas: [string, ...unknown[]][] = []
let resposta: { data: unknown; error: unknown; count?: number }

// Builder encadeável que registra cada chamada e resolve com `resposta` ao ser aguardado.
function builder(): unknown {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_, nome: string) {
        if (nome === 'then') return (res: (v: unknown) => unknown) => res(resposta)
        return (...args: unknown[]) => {
          chamadas.push([nome, ...args])
          return proxy
        }
      },
    },
  )
  return proxy
}

vi.mock('../lib/api', () => ({ db: { from: (t: string) => (chamadas.push(['from', t]), builder()) } }))

import { listarPlanejamentoPagina } from './recorrencias'

const linha = {
  recorrencia_id: 'r1', user_id: 'u', titulo: 'Netflix', valor_previsto_centavos: 5000, dia: 5,
  categoria_id: null, categoria_nome: null, total_parcelas: null, ativa: true, competencia: '2026-11-01',
  parcela: 1, pagamento_id: null, pago_em: null, saida_id: null, valor_pago_centavos: null, nota: null,
  fontes_previstas: [], saida_titulo: null, saida_data: null, forma_pagamento: 'automatica',
}

beforeEach(() => {
  chamadas.length = 0
  resposta = { data: [linha], error: null, count: 23 }
})


describe('listarPlanejamentoPagina', () => {
  it('pede 10 por vez a partir do offset e devolve o total', async () => {
    const pagina = await listarPlanejamentoPagina({ competencia: '2026-11', filtro: 'todas', offset: 10 })
    expect(chamadas).toContainEqual(['range', 10, 19])
    expect(chamadas).toContainEqual(['eq', 'competencia', '2026-11-01'])
    expect(pagina.total).toBe(23)
    expect(pagina.itens[0].formaPagamento).toBe('automatica')
  })

  it('Geral não filtra por forma; subseção filtra', async () => {
    await listarPlanejamentoPagina({ competencia: '2026-11', filtro: 'todas', offset: 0 })
    expect(chamadas.some((c) => c[0] === 'eq' && c[1] === 'forma_pagamento')).toBe(false)
    chamadas.length = 0
    await listarPlanejamentoPagina({ competencia: '2026-11', forma: 'manual', filtro: 'todas', offset: 0 })
    expect(chamadas).toContainEqual(['eq', 'forma_pagamento', 'manual'])
  })

  it('filtra duração no banco pelo número de parcelas', async () => {
    await listarPlanejamentoPagina({ competencia: '2026-11', duracao: 'recorrente', filtro: 'todas', offset: 0 })
    expect(chamadas).toContainEqual(['is', 'total_parcelas', null])
    chamadas.length = 0
    await listarPlanejamentoPagina({ competencia: '2026-11', duracao: 'parcelado', filtro: 'todas', offset: 0 })
    expect(chamadas).toContainEqual(['not', 'total_parcelas', 'is', null])
    chamadas.length = 0
    await listarPlanejamentoPagina({ competencia: '2026-11', duracao: 'todas', filtro: 'todas', offset: 0 })
    expect(chamadas.some((c) => c[1] === 'total_parcelas')).toBe(false)
  })

  it('filtra status no banco', async () => {
    await listarPlanejamentoPagina({ competencia: '2026-11', filtro: 'a-pagar', offset: 0 })
    expect(chamadas).toContainEqual(['is', 'pagamento_id', null])
    chamadas.length = 0
    await listarPlanejamentoPagina({ competencia: '2026-11', filtro: 'pagas', offset: 0 })
    expect(chamadas).toContainEqual(['not', 'pagamento_id', 'is', null])
  })

  it('tamanho maior refaz o que já estava na tela', async () => {
    await listarPlanejamentoPagina({ competencia: '2026-11', filtro: 'todas', offset: 0, tamanho: 30 })
    expect(chamadas).toContainEqual(['range', 0, 29])
  })
})
