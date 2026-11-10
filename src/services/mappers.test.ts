import { describe, expect, it } from 'vitest'
import type { RecorrenciaMesRow, SaidaRow } from '../types/api'
import {
  deRecorrencia,
  paraRecorrenciaDoMes,
  paraResumoPlanejamento,
  paraSaida,
  paraTipoPlanejamento,
  paraVinculoRecorrencia,
} from './mappers'

describe('paraSaida', () => {
  it('desempacota os splits aninhados', () => {
    const row: SaidaRow = {
      id: 's1',
      user_id: 'u1',
      categoria_id: 'c1',
      titulo: 'Almoço',
      valor_total_centavos: 8000,
      data: '2026-09-05',
      eh_pagamento_fatura: false,
      nota: null,
      created_at: '2026-09-05T12:00:00Z',
      saida_splits: [
        { fonte_id: 'f1', valor_centavos: 5000 },
        { fonte_id: 'f2', valor_centavos: 3000 },
      ],
    }

    expect(paraSaida(row)).toEqual({
      id: 's1',
      categoriaId: 'c1',
      titulo: 'Almoço',
      valorTotalCentavos: 8000,
      data: '2026-09-05',
      ehPagamentoFatura: false,
      nota: null,
      recorrencia: null,
      splits: [
        { fonteId: 'f1', valorCentavos: 5000 },
        { fonteId: 'f2', valorCentavos: 3000 },
      ],
    })
  })

  it('devolve splits vazio quando saida_splits não veio no embed', () => {
    const row: SaidaRow = {
      id: 's2',
      user_id: 'u1',
      categoria_id: 'c1',
      titulo: 'Uber',
      valor_total_centavos: 2200,
      data: '2026-09-06',
      eh_pagamento_fatura: false,
      nota: null,
      created_at: '2026-09-06T12:00:00Z',
    }

    expect(paraSaida(row).splits).toEqual([])
  })

  it('traduz os campos de apelido (M22) quando vieram no select', () => {
    const row: SaidaRow = {
      id: 's3',
      user_id: 'u1',
      categoria_id: 'c1',
      titulo: 'Compra no débito - Esthneygomesguima     Santarem     Bra',
      valor_total_centavos: 3600,
      data: '2026-11-08',
      eh_pagamento_fatura: false,
      nota: null,
      created_at: '2026-11-08T12:00:00Z',
      chave_estabelecimento: 'esthneygomesguima',
      apelido_estabelecimento: 'Açaí do Lester',
      descricao_pluggy: 'Compra no débito - Esthneygomesguima     Santarem     Bra',
    }

    expect(paraSaida(row)).toMatchObject({
      chaveEstabelecimento: 'esthneygomesguima',
      apelido: 'Açaí do Lester',
      descricaoPluggy: 'Compra no débito - Esthneygomesguima     Santarem     Bra',
    })
  })
})

describe('paraRecorrenciaDoMes', () => {
  it('converte competência para YYYY-MM e mantém campos de pagamento', () => {
    const row: RecorrenciaMesRow = {
      recorrencia_id: 'r1',
      user_id: 'u1',
      titulo: 'Internet',
      valor_previsto_centavos: 9990,
      dia: 7,
      categoria_id: 'c1',
      categoria_nome: 'Casa',
      total_parcelas: null,
      ativa: true,
      competencia: '2026-11-01',
      parcela: 3,
      pagamento_id: 'p1',
      pago_em: '2026-11-07',
      saida_id: null,
      valor_pago_centavos: null,
      nota: null,
      fontes_previstas: [],
      saida_titulo: null,
      saida_data: null,
      tipo_planejamento_id: 2,
    }
    expect(paraRecorrenciaDoMes(row)).toEqual({
      recorrenciaId: 'r1',
      titulo: 'Internet',
      valorPrevistoCentavos: 9990,
      dia: 7,
      categoriaId: 'c1',
      categoriaNome: 'Casa',
      totalParcelas: null,
      ativa: true,
      competencia: '2026-11',
      parcela: 3,
      pagamentoId: 'p1',
      pagoEm: '2026-11-07',
      nota: null,
      fontesPrevistas: [],
      saidaId: null,
      valorPagoCentavos: null,
      saidaTitulo: null,
      saidaData: null,
      tipoPlanejamentoId: 2,
    })
  })
})

describe('deRecorrencia', () => {
  it('converte mesInicio para o dia 1 e só envia campos presentes', () => {
    expect(deRecorrencia({ mesInicio: '2026-11', categoriaId: null })).toEqual({
      mes_inicio: '2026-11-01',
      categoria_id: null,
    })
  })

  it('envia o Tipo de Planejamento quando presente', () => {
    expect(deRecorrencia({ tipoPlanejamentoId: 5 })).toEqual({ tipo_planejamento_id: 5 })
  })
})

describe('paraTipoPlanejamento', () => {
  it('converte a linha do enum', () => {
    expect(paraTipoPlanejamento({ id: 2, slug: 'transferencias', nome: 'Transferências manuais', ordem: 2 })).toEqual({
      id: 2,
      slug: 'transferencias',
      nome: 'Transferências manuais',
      ordem: 2,
    })
  })
})

describe('paraResumoPlanejamento', () => {
  it('converte competência para YYYY-MM', () => {
    expect(
      paraResumoPlanejamento({
        user_id: 'u1',
        competencia: '2026-11-01',
        tipo_planejamento_id: 5,
        quantidade: 3,
        previsto_centavos: 30000,
        pago_centavos: 10000,
        falta_centavos: 20000,
      }),
    ).toEqual({
      competencia: '2026-11',
      tipoPlanejamentoId: 5,
      quantidade: 3,
      previstoCentavos: 30000,
      pagoCentavos: 10000,
      faltaCentavos: 20000,
    })
  })
})

describe('paraVinculoRecorrencia', () => {
  it('aceita objeto ou array do embed e converte competência', () => {
    const row = { recorrencia_id: 'r1', competencia: '2026-10-01', recorrencias: { titulo: 'Aluguel' } }
    const esperado = { recorrenciaId: 'r1', competencia: '2026-10', titulo: 'Aluguel' }
    expect(paraVinculoRecorrencia(row)).toEqual(esperado)
    expect(paraVinculoRecorrencia([row])).toEqual(esperado)
  })
  it('sem vínculo vira null', () => {
    expect(paraVinculoRecorrencia(null)).toBeNull()
    expect(paraVinculoRecorrencia([])).toBeNull()
    expect(paraVinculoRecorrencia(undefined)).toBeNull()
  })
})
