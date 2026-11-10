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

import { listarPlanejamentoPagina, listarTiposPlanejamento } from './recorrencias'

const linha = {
  recorrencia_id: 'r1', user_id: 'u', titulo: 'Netflix', valor_previsto_centavos: 5000, dia: 5,
  categoria_id: null, categoria_nome: null, total_parcelas: null, ativa: true, competencia: '2026-11-01',
  parcela: 1, pagamento_id: null, pago_em: null, saida_id: null, valor_pago_centavos: null, nota: null,
  fontes_previstas: [], saida_titulo: null, saida_data: null, tipo_planejamento_id: 1,
}

beforeEach(() => {
  chamadas.length = 0
  resposta = { data: [linha], error: null, count: 23 }
})

const nomes = () => chamadas.map((c) => c[0])

describe('listarPlanejamentoPagina', () => {
  it('pede 10 por vez a partir do offset e devolve o total', async () => {
    const pagina = await listarPlanejamentoPagina({ competencia: '2026-11', filtro: 'todas', offset: 10 })
    expect(chamadas).toContainEqual(['range', 10, 19])
    expect(chamadas).toContainEqual(['eq', 'competencia', '2026-11-01'])
    expect(pagina.total).toBe(23)
    expect(pagina.itens[0].tipoPlanejamentoId).toBe(1)
  })

  it('Geral não filtra por Tipo; subseção filtra', async () => {
    await listarPlanejamentoPagina({ competencia: '2026-11', filtro: 'todas', offset: 0 })
    expect(chamadas.some((c) => c[0] === 'eq' && c[1] === 'tipo_planejamento_id')).toBe(false)
    chamadas.length = 0
    await listarPlanejamentoPagina({ competencia: '2026-11', tipoId: 3, filtro: 'todas', offset: 0 })
    expect(chamadas).toContainEqual(['eq', 'tipo_planejamento_id', 3])
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

describe('listarTiposPlanejamento', () => {
  it('busca uma vez só e reaproveita', async () => {
    resposta = { data: [{ id: 1, slug: 'assinaturas', nome: 'Assinaturas', ordem: 1 }], error: null }
    const a = await listarTiposPlanejamento()
    const b = await listarTiposPlanejamento()
    expect(a).toEqual(b)
    expect(nomes().filter((n) => n === 'from')).toHaveLength(1)
  })
})
