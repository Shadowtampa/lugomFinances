// Regras puras de importação (testadas em normalizar.test.ts). Sem I/O.

export type TipoConta = 'BANK' | 'CREDIT'

export interface TransacaoPluggy {
  id: string
  date: string // ISO8601 UTC
  description: string
  amount: number
  type: 'DEBIT' | 'CREDIT'
  status: 'PENDING' | 'POSTED'
  category?: string | null
  creditCardMetadata?: {
    installmentNumber?: number
    totalInstallments?: number
    purchaseDate?: string | null
  } | null
}

export interface TransacaoNormalizada {
  pluggyTransactionId: string
  data: string // YYYY-MM-DD em America/Sao_Paulo
  descricao: string
  valorCentavos: number
  direcao: 'entrada' | 'saida'
  statusPluggy: 'PENDING' | 'POSTED'
  categoriaPluggy: string | null
  parcela: number | null
  totalParcelas: number | null
  /** Data da compra original (YYYY-MM-DD, SP), só quando é parcela. */
  dataCompra: string | null
}

const FUSO = 'America/Sao_Paulo'

/** Data de calendário (YYYY-MM-DD) do instante no fuso de São Paulo. */
export function dataLocal(iso: string | Date): string {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof iso === 'string' ? new Date(iso) : iso)
}

export function paraCentavos(valor: number): number {
  return Math.round(Math.abs(valor) * 100)
}

/**
 * Converte uma transação da Pluggy no formato da caixa de entrada, ou devolve null
 * quando ela não deve ser importada:
 *  - conta (BANK): só POSTED;
 *  - cartão (CREDIT): PENDING entra, mas nada com data futura (parcelas futuras);
 *  - valor zero;
 *  - data <= data de corte da conta.
 */
export function normalizarTransacao(
  t: TransacaoPluggy,
  tipoConta: TipoConta,
  dataCorte: string,
  hoje: string,
): TransacaoNormalizada | null {
  const data = dataLocal(t.date)
  if (data <= dataCorte) return null
  if (tipoConta === 'BANK' && t.status !== 'POSTED') return null
  if (tipoConta === 'CREDIT' && data > hoje) return null

  const valorCentavos = paraCentavos(t.amount)
  if (valorCentavos === 0) return null

  // Cartão: amount > 0 é compra (saída), < 0 é pagamento/estorno (entrada).
  // Conta: o sinal não é garantido; a direção vem do type.
  const direcao =
    tipoConta === 'CREDIT'
      ? t.amount > 0
        ? 'saida'
        : 'entrada'
      : t.type === 'DEBIT'
        ? 'saida'
        : 'entrada'

  const meta = t.creditCardMetadata ?? null
  const parcela = meta?.installmentNumber ?? null
  return {
    pluggyTransactionId: t.id,
    data,
    descricao: t.description.trim() || '(sem descrição)',
    valorCentavos,
    direcao,
    statusPluggy: t.status,
    categoriaPluggy: t.category ?? null,
    parcela,
    totalParcelas: meta?.totalInstallments ?? null,
    dataCompra: parcela !== null && meta?.purchaseDate ? dataLocal(meta.purchaseDate) : null,
  }
}

export interface ImportadaExistente {
  id: string
  pluggyTransactionId: string
  estado: 'pendente' | 'confirmada' | 'ignorada' | 'divergente'
  statusPluggy: string
}

/**
 * Transações que estavam PENDING no nosso banco e não vieram nesta busca foram apagadas
 * (ou recriadas com outro id) na Pluggy. Pendente de revisão -> apagar; já confirmada ->
 * divergente (o usuário revisa à mão). Ignoradas e divergentes ficam como estão.
 */
export function decidirSumidas(
  existentes: ImportadaExistente[],
  idsRecebidos: Set<string>,
): { apagar: string[]; divergentes: string[] } {
  const apagar: string[] = []
  const divergentes: string[] = []
  for (const e of existentes) {
    if (e.statusPluggy !== 'PENDING' || idsRecebidos.has(e.pluggyTransactionId)) continue
    if (e.estado === 'pendente') apagar.push(e.id)
    else if (e.estado === 'confirmada') divergentes.push(e.id)
  }
  return { apagar, divergentes }
}
