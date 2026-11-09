import type {
  ApelidoEstabelecimentoRow,
  CategoriaRow,
  EntradaRow,
  FonteRow,
  FaturaPendenteRow,
  ConciliacaoContaRow,
  ImportadaPendenteRow,
  ParPagamentoFaturaRow,
  PluggyContaRow,
  PluggyItemRow,
  StatusIntegracaoRow,
  SugestaoRecorrenciaRow,
  RecorrenciaMesRow,
  RecorrenciaRow,
  ResultadoCriarSaidaRow,
  ResumoGeralRow,
  SaidaRow,
  SaldoCategoriaRow,
  SaldoFonteRow,
} from '../types/api'
import type {
  ApelidoEstabelecimento,
  Categoria,
  Entrada,
  Fonte,
  FaturaPendente,
  ConciliacaoConta,
  ParPagamentoFatura,
  PluggyConta,
  PluggyItem,
  StatusIntegracao,
  SugestaoRecorrencia,
  TransacaoImportada,
  Recorrencia,
  RecorrenciaDoMes,
  ResultadoCriarSaida,
  ResumoGeral,
  Saida,
  SaldoCategoria,
  SaldoFonte,
} from '../types/domain'
import { identidadeDaFonte } from '../lib/identidadeFontes'

/** Nome e cor da marca, quando a Fonte tem identidade fixa (identidadeFontes.ts). */
function nomeDaFonte(fonteId: string, nome: string): string {
  return identidadeDaFonte(fonteId)?.nome ?? nome
}

function corDaFonte(fonteId: string, cor: string): string {
  return identidadeDaFonte(fonteId)?.cor ?? cor
}

export function paraFonte(row: FonteRow, categoriasPermitidas?: string[]): Fonte {
  return {
    id: row.id,
    nome: nomeDaFonte(row.id, row.nome),
    tipo: row.tipo,
    cor: corDaFonte(row.id, row.cor),
    arquivada: row.arquivada,
    ehCartao: row.eh_cartao,
    limiteCentavos: row.limite_centavos,
    diaFatura: row.dia_fatura,
    origem: row.origem,
    pluggyAccountId: row.pluggy_account_id,
    ...(categoriasPermitidas ? { categoriasPermitidas } : {}),
  }
}

export function paraSaldoFonte(row: SaldoFonteRow): SaldoFonte {
  return {
    id: row.fonte_id,
    nome: nomeDaFonte(row.fonte_id, row.nome),
    tipo: row.tipo,
    cor: corDaFonte(row.fonte_id, row.cor),
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
    cor: row.cor,
    arquivada: row.arquivada,
  }
}

export function paraSaldoCategoria(row: SaldoCategoriaRow): SaldoCategoria {
  return {
    id: row.categoria_id,
    nome: row.nome,
    limiteMensalCentavos: row.limite_mensal_centavos,
    cor: row.cor,
    arquivada: row.arquivada,
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
    ehPagamentoFatura: row.eh_pagamento_fatura,
    nota: row.nota ?? null,
    ...camposApelido(row),
  }
}

/** Campos computados do M22; ausentes quando o select não os pediu. */
function camposApelido(row: EntradaRow | SaidaRow) {
  if (row.chave_estabelecimento === undefined) return {}
  return {
    chaveEstabelecimento: row.chave_estabelecimento,
    apelido: row.apelido_estabelecimento ?? null,
    descricaoPluggy: row.descricao_pluggy ?? null,
  }
}

export function paraApelido(row: ApelidoEstabelecimentoRow): ApelidoEstabelecimento {
  return { chave: row.chave, apelido: row.apelido }
}

export function paraSaida(row: SaidaRow): Saida {
  return {
    id: row.id,
    categoriaId: row.categoria_id,
    titulo: row.titulo,
    valorTotalCentavos: row.valor_total_centavos,
    data: row.data,
    ehPagamentoFatura: row.eh_pagamento_fatura,
    nota: row.nota ?? null,
    splits: (row.saida_splits ?? []).map((split) => ({
      fonteId: split.fonte_id,
      valorCentavos: split.valor_centavos,
    })),
    ...camposApelido(row),
  }
}

export function paraResumoGeral(row: ResumoGeralRow): ResumoGeral {
  return {
    saldoTotalCentavos: row.saldo_total_centavos,
    saldoLivreCentavos: row.saldo_livre_centavos,
    saldoRestritoCentavos: row.saldo_restrito_centavos,
  }
}

export function paraRecorrencia(row: RecorrenciaRow): Recorrencia {
  return {
    id: row.id,
    titulo: row.titulo,
    valorPrevistoCentavos: row.valor_previsto_centavos,
    dia: row.dia,
    categoriaId: row.categoria_id,
    mesInicio: row.mes_inicio.slice(0, 7),
    totalParcelas: row.total_parcelas,
    ativa: row.ativa,
    nota: row.nota ?? null,
    fontesPrevistas: row.recorrencias_fontes?.map((rf) => rf.fonte_id) ?? [],
  }
}

export function paraRecorrenciaDoMes(row: RecorrenciaMesRow): RecorrenciaDoMes {
  return {
    recorrenciaId: row.recorrencia_id,
    titulo: row.titulo,
    valorPrevistoCentavos: row.valor_previsto_centavos,
    dia: row.dia,
    categoriaId: row.categoria_id,
    categoriaNome: row.categoria_nome,
    totalParcelas: row.total_parcelas,
    ativa: row.ativa,
    competencia: row.competencia.slice(0, 7),
    parcela: row.parcela,
    pagamentoId: row.pagamento_id,
    pagoEm: row.pago_em,
    saidaId: row.saida_id,
    valorPagoCentavos: row.valor_pago_centavos,
    nota: row.nota ?? null,
    fontesPrevistas: row.fontes_previstas ?? [],
  }
}

export function paraPluggyItem(row: PluggyItemRow): PluggyItem {
  return {
    id: row.id,
    itemId: row.item_id,
    nome: row.nome,
    status: row.status,
    executionStatus: row.execution_status,
    atualizadoNaPluggyEm: row.atualizado_na_pluggy_em,
  }
}

export function paraPluggyConta(row: PluggyContaRow): PluggyConta {
  return {
    pluggyAccountId: row.pluggy_account_id,
    itemId: row.item_id,
    nome: row.nome,
    tipo: row.tipo,
    numero: row.numero,
    saldoCentavos: row.saldo_centavos,
    limiteCentavos: row.limite_centavos,
    diaFatura: row.dia_fatura,
    dataCorte: row.data_corte,
    saldoInicialPendente: row.saldo_inicial_pendente_desde !== null,
  }
}

export function paraTransacaoImportada(row: ImportadaPendenteRow): TransacaoImportada {
  return {
    id: row.id,
    pluggyAccountId: row.pluggy_account_id,
    fonteId: row.fonte_id,
    data: row.data,
    descricao: row.descricao,
    valorCentavos: row.valor_centavos,
    direcao: row.direcao,
    statusPluggy: row.status_pluggy,
    parcela: row.parcela,
    totalParcelas: row.total_parcelas,
    estado: row.estado,
    entradaId: row.entrada_id,
    saidaId: row.saida_id,
    categoriaSugeridaId: row.categoria_sugerida_id,
    sugerirIgnorarParcela: row.sugerir_ignorar_parcela,
    chaveEstabelecimento: row.chave_estabelecimento,
    apelido: row.apelido,
  }
}

export function paraParPagamentoFatura(row: ParPagamentoFaturaRow): ParPagamentoFatura {
  return {
    bancoId: row.banco_id,
    cartaoId: row.cartao_id,
    fontePagadoraId: row.fonte_pagadora_id,
    cartaoFonteId: row.cartao_fonte_id,
    valorCentavos: row.valor_centavos,
    data: row.data,
  }
}

export function paraConciliacaoConta(row: ConciliacaoContaRow): ConciliacaoConta {
  return {
    pluggyAccountId: row.pluggy_account_id,
    fonteId: row.fonte_id,
    saldoAppCentavos: row.saldo_app_centavos,
    pendentesCentavos: row.pendentes_centavos,
    saldoPluggyCentavos: row.saldo_pluggy_centavos,
    diferencaCentavos: row.saldo_pluggy_centavos - row.saldo_app_centavos - row.pendentes_centavos,
    saldoInicialPendente: row.saldo_inicial_pendente,
  }
}

export function paraSugestaoRecorrencia(row: SugestaoRecorrenciaRow): SugestaoRecorrencia {
  return {
    transacaoId: row.transacao_id,
    recorrenciaId: row.recorrencia_id,
    titulo: row.titulo,
    competencia: row.competencia.slice(0, 7),
  }
}

export function paraStatusIntegracao(row: StatusIntegracaoRow): StatusIntegracao {
  return {
    totalItens: row.total_itens,
    ultimaSincronizacaoEm: row.ultima_sincronizacao_em,
    ultimaSincronizacaoSucesso: row.ultima_sincronizacao_sucesso,
    ultimaSincronizacaoErro: row.ultima_sincronizacao_erro,
    ultimaSincronizacaoImportadas: row.ultima_sincronizacao_importadas,
    ultimaSincronizacaoOkEm: row.ultima_sincronizacao_ok_em,
    itensComProblema: row.itens_com_problema.map((i) => ({
      itemId: i.item_id,
      nome: i.nome,
      status: i.status,
    })),
  }
}

export function paraFaturaPendente(row: FaturaPendenteRow): FaturaPendente {
  return {
    fonteId: row.fonte_id,
    nome: nomeDaFonte(row.fonte_id, row.nome),
    valorSugeridoCentavos: row.valor_sugerido_centavos,
    diaFatura: row.dia_fatura,
  }
}

export function paraResultadoCriarSaida(row: ResultadoCriarSaidaRow): ResultadoCriarSaida {
  return {
    saidaId: row.saida_id,
    fontes: row.fontes.map((fonte) => ({
      fonteId: fonte.fonte_id,
      nome: nomeDaFonte(fonte.fonte_id, fonte.nome),
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

export function deRecorrencia(dados: Partial<Omit<Recorrencia, 'id'>>) {
  return {
    ...(dados.titulo !== undefined && { titulo: dados.titulo }),
    ...(dados.valorPrevistoCentavos !== undefined && {
      valor_previsto_centavos: dados.valorPrevistoCentavos,
    }),
    ...(dados.dia !== undefined && { dia: dados.dia }),
    ...(dados.categoriaId !== undefined && { categoria_id: dados.categoriaId }),
    ...(dados.mesInicio !== undefined && { mes_inicio: `${dados.mesInicio}-01` }),
    ...(dados.totalParcelas !== undefined && { total_parcelas: dados.totalParcelas }),
    ...(dados.ativa !== undefined && { ativa: dados.ativa }),
    ...(dados.nota !== undefined && { nota: dados.nota }),
  }
}

export function deEntrada(dados: Partial<Omit<Entrada, 'id'>>) {
  return {
    ...(dados.fonteId !== undefined && { fonte_id: dados.fonteId }),
    ...(dados.titulo !== undefined && { titulo: dados.titulo }),
    ...(dados.valorCentavos !== undefined && { valor_centavos: dados.valorCentavos }),
    ...(dados.data !== undefined && { data: dados.data }),
    ...(dados.nota !== undefined && { nota: dados.nota }),
  }
}
