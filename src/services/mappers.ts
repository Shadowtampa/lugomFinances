import type {
  CategoriaRow,
  EntradaRow,
  FonteRow,
  RecorrenciaPendenteRow,
  RecorrenciaTemplateRow,
  ResultadoCriarSaidaRow,
  ResumoGeralRow,
  SaidaRow,
  SaldoCategoriaRow,
  SaldoFonteRow,
} from '../types/api'
import type {
  Categoria,
  Entrada,
  Fonte,
  RecorrenciaPendente,
  RecorrenciaTemplate,
  ResultadoCriarSaida,
  ResumoGeral,
  Saida,
  SaldoCategoria,
  SaldoFonte,
} from '../types/domain'

export function paraFonte(row: FonteRow, categoriasPermitidas?: string[]): Fonte {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    cor: row.cor,
    arquivada: row.arquivada,
    ehCartao: row.eh_cartao,
    limiteCentavos: row.limite_centavos,
    diaFatura: row.dia_fatura,
    ...(categoriasPermitidas ? { categoriasPermitidas } : {}),
  }
}

export function paraSaldoFonte(row: SaldoFonteRow): SaldoFonte {
  return {
    id: row.fonte_id,
    nome: row.nome,
    tipo: row.tipo,
    cor: row.cor,
    arquivada: row.arquivada,
    ehCartao: row.eh_cartao,
    limiteCentavos: row.limite_centavos,
    diaFatura: row.dia_fatura,
    totalEntradasCentavos: row.total_entradas_centavos,
    totalSaidasCentavos: row.total_saidas_centavos,
    saldoCentavos: row.saldo_centavos,
  }
}

export function paraCategoria(row: CategoriaRow): Categoria {
  return {
    id: row.id,
    nome: row.nome,
    limiteMensalCentavos: row.limite_mensal_centavos,
    vigenciaInicio: row.vigencia_inicio,
    cor: row.cor,
    arquivada: row.arquivada,
  }
}

export function paraSaldoCategoria(row: SaldoCategoriaRow): SaldoCategoria {
  return {
    id: row.categoria_id,
    nome: row.nome,
    limiteMensalCentavos: row.limite_mensal_centavos,
    vigenciaInicio: '', // v_saldo_categorias não expõe vigencia_inicio (M2)
    cor: row.cor,
    arquivada: row.arquivada,
    mesesAtivos: row.meses_ativos,
    limiteAcumuladoCentavos: row.limite_acumulado_centavos,
    totalGastoCentavos: row.total_gasto_centavos,
    gastoMesAtualCentavos: row.gasto_mes_atual_centavos,
    saldoDisponivelCentavos: row.saldo_disponivel_centavos,
  }
}

export function paraEntrada(row: EntradaRow): Entrada {
  return {
    id: row.id,
    fonteId: row.fonte_id,
    titulo: row.titulo,
    valorCentavos: row.valor_centavos,
    data: row.data,
    recorrente: row.recorrente,
    diaRecorrencia: row.dia_recorrencia,
    recorrenciaAtiva: row.recorrencia_ativa,
    templateId: row.template_id,
    totalParcelas: row.total_parcelas,
    ehPagamentoFatura: row.eh_pagamento_fatura,
  }
}

export function paraSaida(row: SaidaRow): Saida {
  return {
    id: row.id,
    categoriaId: row.categoria_id,
    titulo: row.titulo,
    valorTotalCentavos: row.valor_total_centavos,
    data: row.data,
    recorrente: row.recorrente,
    diaRecorrencia: row.dia_recorrencia,
    recorrenciaAtiva: row.recorrencia_ativa,
    templateId: row.template_id,
    totalParcelas: row.total_parcelas,
    ehPagamentoFatura: row.eh_pagamento_fatura,
    splits: (row.saida_splits ?? []).map((split) => ({
      fonteId: split.fonte_id,
      valorCentavos: split.valor_centavos,
    })),
  }
}

export function paraResumoGeral(row: ResumoGeralRow): ResumoGeral {
  return {
    saldoTotalCentavos: row.saldo_total_centavos,
    saldoLivreCentavos: row.saldo_livre_centavos,
    saldoRestritoCentavos: row.saldo_restrito_centavos,
  }
}

export function paraRecorrenciaPendente(row: RecorrenciaPendenteRow): RecorrenciaPendente {
  return {
    tipo: row.tipo_lancamento,
    templateId: row.template_id,
    titulo: row.titulo,
    valorSugeridoCentavos: row.valor_sugerido_centavos,
    diaRecorrencia: row.dia_recorrencia,
    fonteId: row.fonte_id,
    categoriaId: row.categoria_id,
    totalParcelas: row.total_parcelas,
    parcelasLancadas: row.parcelas_lancadas,
  }
}

export function paraRecorrenciaTemplate(row: RecorrenciaTemplateRow): RecorrenciaTemplate {
  return {
    tipo: row.tipo_lancamento,
    templateId: row.template_id,
    titulo: row.titulo,
    valorCentavos: row.valor_centavos,
    diaRecorrencia: row.dia_recorrencia,
    recorrenciaAtiva: row.recorrencia_ativa,
    totalParcelas: row.total_parcelas,
    parcelasLancadas: row.parcelas_lancadas,
    fonteId: row.fonte_id,
    categoriaId: row.categoria_id,
  }
}

export function paraResultadoCriarSaida(row: ResultadoCriarSaidaRow): ResultadoCriarSaida {
  return {
    saidaId: row.saida_id,
    fontes: row.fontes.map((fonte) => ({
      fonteId: fonte.fonte_id,
      nome: fonte.nome,
      tipo: fonte.tipo,
      saldoCentavos: fonte.saldo_centavos,
    })),
    categoria: row.categoria
      ? {
          categoriaId: row.categoria.categoria_id,
          nome: row.categoria.nome,
          limiteMensalCentavos: row.categoria.limite_mensal_centavos,
          saldoDisponivelCentavos: row.categoria.saldo_disponivel_centavos,
          gastoMesAtualCentavos: row.categoria.gasto_mes_atual_centavos,
        }
      : null,
  }
}

export function deCategoria(dados: Partial<Omit<Categoria, 'id'>>) {
  return {
    ...(dados.nome !== undefined && { nome: dados.nome }),
    ...(dados.limiteMensalCentavos !== undefined && {
      limite_mensal_centavos: dados.limiteMensalCentavos,
    }),
    ...(dados.vigenciaInicio !== undefined && { vigencia_inicio: dados.vigenciaInicio }),
    ...(dados.cor !== undefined && { cor: dados.cor }),
    ...(dados.arquivada !== undefined && { arquivada: dados.arquivada }),
  }
}

export function deFonte(dados: Partial<Omit<Fonte, 'id' | 'categoriasPermitidas'>>) {
  return {
    ...(dados.nome !== undefined && { nome: dados.nome }),
    ...(dados.tipo !== undefined && { tipo: dados.tipo }),
    ...(dados.cor !== undefined && { cor: dados.cor }),
    ...(dados.arquivada !== undefined && { arquivada: dados.arquivada }),
    ...(dados.ehCartao !== undefined && { eh_cartao: dados.ehCartao }),
    ...(dados.limiteCentavos !== undefined && { limite_centavos: dados.limiteCentavos }),
    ...(dados.diaFatura !== undefined && { dia_fatura: dados.diaFatura }),
  }
}

export function deEntrada(dados: Partial<Omit<Entrada, 'id'>>) {
  return {
    ...(dados.fonteId !== undefined && { fonte_id: dados.fonteId }),
    ...(dados.titulo !== undefined && { titulo: dados.titulo }),
    ...(dados.valorCentavos !== undefined && { valor_centavos: dados.valorCentavos }),
    ...(dados.data !== undefined && { data: dados.data }),
    ...(dados.recorrente !== undefined && { recorrente: dados.recorrente }),
    ...(dados.diaRecorrencia !== undefined && { dia_recorrencia: dados.diaRecorrencia }),
    ...(dados.recorrenciaAtiva !== undefined && { recorrencia_ativa: dados.recorrenciaAtiva }),
    ...(dados.templateId !== undefined && { template_id: dados.templateId }),
    ...(dados.totalParcelas !== undefined && { total_parcelas: dados.totalParcelas }),
  }
}
