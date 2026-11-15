import { describe, expect, it } from 'vitest'
import type { AdesaoMetodoRow, RecorrenciaMesRow, SaidaRow } from '../types/api'
import {
  deRecorrencia,
  paraAdesaoMetodo,
  paraPagamentoFaturaMes,
  paraParcelaCartaoRestante,
  paraRecorrenciaDoMes,
  paraSaidaLancamento,
  paraSaidaNaFonte,
  paraSomaEntradaDia,
  paraSomaSaidaDia,
  paraResumoPlanejamento,
  paraSaida,
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
      forma_pagamento: 'automatica',
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
      formaPagamento: 'automatica',
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

  it('envia a Forma de pagamento quando presente', () => {
    expect(deRecorrencia({ formaPagamento: 'automatica' })).toEqual({ forma_pagamento: 'automatica' })
  })
})

describe('paraResumoPlanejamento', () => {
  it('converte competência para YYYY-MM', () => {
    expect(
      paraResumoPlanejamento({
        user_id: 'u1',
        competencia: '2026-11-01',
        forma_pagamento: 'manual',
        recorrente: false,
        quantidade: 3,
        previsto_centavos: 30000,
        pago_centavos: 10000,
        falta_centavos: 20000,
      }),
    ).toEqual({
      competencia: '2026-11',
      formaPagamento: 'manual',
      recorrente: false,
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

describe('somas do Dashboard (M31)', () => {
  it('traduz a soma de Saídas por dia e Categoria', () => {
    expect(
      paraSomaSaidaDia({
        user_id: 'u1',
        data: '2026-11-03',
        categoria_id: 'c1',
        total_centavos: 12345,
        quantidade: 2,
      }),
    ).toEqual({ data: '2026-11-03', categoriaId: 'c1', totalCentavos: 12345, quantidade: 2 })
  })

  it('traduz a soma de Entradas por dia e Fonte', () => {
    expect(
      paraSomaEntradaDia({
        user_id: 'u1',
        data: '2026-11-05',
        fonte_id: 'f1',
        total_centavos: 500000,
        quantidade: 1,
      }),
    ).toEqual({ data: '2026-11-05', fonteId: 'f1', totalCentavos: 500000, quantidade: 1 })
  })
})

describe('views de cartões (M32)', () => {
  it('traduz um split de Saída', () => {
    expect(
      paraSaidaNaFonte({
        user_id: 'u1',
        saida_id: 's1',
        data: '2026-11-03',
        fonte_id: 'f1',
        categoria_id: 'c1',
        titulo: 'Mercado',
        valor_centavos: 4500,
      }),
    ).toEqual({ saidaId: 's1', data: '2026-11-03', fonteId: 'f1', categoriaId: 'c1', titulo: 'Mercado', valorCentavos: 4500 })
  })
  it('corta o mês da fatura para YYYY-MM', () => {
    expect(
      paraPagamentoFaturaMes({ user_id: 'u1', fonte_id: 'f1', mes: '2026-10-01', total_centavos: 90000 }),
    ).toEqual({ fonteId: 'f1', mes: '2026-10', totalCentavos: 90000 })
  })
  it('traduz parcelas restantes e corta o próximo mês', () => {
    expect(
      paraParcelaCartaoRestante({
        user_id: 'u1',
        fonte_id: 'f1',
        descricao: 'Notebook',
        parcela: 2,
        total_parcelas: 6,
        restantes: 4,
        valor_parcela_centavos: 25000,
        proximo_mes: '2026-12-01',
      }),
    ).toEqual({
      fonteId: 'f1',
      descricao: 'Notebook',
      parcela: 2,
      totalParcelas: 6,
      restantes: 4,
      valorParcelaCentavos: 25000,
      proximoMes: '2026-12',
    })
  })
})

describe('paraSaidaLancamento (M33)', () => {
  it('traduz a Saída com o estabelecimento', () => {
    expect(
      paraSaidaLancamento({
        user_id: 'u1',
        saida_id: 's1',
        data: '2026-11-03',
        chave: 'ifood',
        nome: 'iFood',
        valor_total_centavos: 4290,
      }),
    ).toEqual({ saidaId: 's1', data: '2026-11-03', chave: 'ifood', nome: 'iFood', valorCentavos: 4290 })
  })
})

describe('paraAdesaoMetodo', () => {
  it('traduz a linha de v_adesao_50_15_35', () => {
    const row: AdesaoMetodoRow = {
      user_id: 'u1',
      total_entradas_mes_centavos: 1000000,
      gasto_necessidades_centavos: 380000,
      gasto_desejos_centavos: 220000,
      gasto_investimentos_centavos: 150000,
      gasto_nao_classificado_centavos: 15000,
    }

    expect(paraAdesaoMetodo(row)).toEqual({
      totalEntradasMesCentavos: 1000000,
      gastoNecessidadesCentavos: 380000,
      gastoDesejosCentavos: 220000,
      gastoInvestimentosCentavos: 150000,
      gastoNaoClassificadoCentavos: 15000,
    })
  })
})
