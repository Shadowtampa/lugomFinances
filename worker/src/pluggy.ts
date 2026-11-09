// Cliente mínimo da API Pluggy. Nunca loga apiKey nem clientSecret.
import type { TransacaoPluggy } from './normalizar.ts'

const BASE = 'https://api.pluggy.ai'
const VALIDADE_MS = 110 * 60 * 1000 // apiKey vale 2h; renova antes

export class ErroPluggy extends Error {
  readonly codigo: string
  constructor(codigo: string, detalhe?: string) {
    super(detalhe ? `${codigo}: ${detalhe}` : codigo)
    this.codigo = codigo
  }
}

export interface ItemPluggy {
  id: string
  status: string
  executionStatus?: string | null
  updatedAt?: string | null
  connector?: { name?: string } | null
}

export interface ContaPluggy {
  id: string
  type: 'BANK' | 'CREDIT'
  name: string
  number?: string | null
  balance: number
  creditData?: { creditLimit?: number | null; balanceDueDate?: string | null } | null
}

export class ClientePluggy {
  private apiKey: string | null = null
  private obtidaEm = 0
  private readonly clientId: string
  private readonly clientSecret: string

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  private async chave(): Promise<string> {
    if (this.apiKey && Date.now() - this.obtidaEm < VALIDADE_MS) return this.apiKey
    let resp: Response
    try {
      resp = await fetch(`${BASE}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: this.clientId, clientSecret: this.clientSecret }),
      })
    } catch {
      throw new ErroPluggy('PLUGGY_INDISPONIVEL')
    }
    if (!resp.ok) throw new ErroPluggy('PLUGGY_AUTH_FALHOU', `HTTP ${resp.status}`)
    const corpo = (await resp.json()) as { apiKey: string }
    this.apiKey = corpo.apiKey
    this.obtidaEm = Date.now()
    return corpo.apiKey
  }

  private async get<T>(caminho: string): Promise<T> {
    let resp: Response
    try {
      resp = await fetch(`${BASE}${caminho}`, { headers: { 'X-API-KEY': await this.chave() } })
    } catch (e) {
      if (e instanceof ErroPluggy) throw e
      throw new ErroPluggy('PLUGGY_INDISPONIVEL')
    }
    if (resp.status === 401) {
      this.apiKey = null
      throw new ErroPluggy('PLUGGY_AUTH_FALHOU', 'HTTP 401')
    }
    if (resp.status === 404) throw new ErroPluggy('PLUGGY_NAO_ENCONTRADO', caminho.split('?')[0])
    if (resp.status === 400) throw new ErroPluggy('PLUGGY_REQUISICAO_INVALIDA', caminho.split('?')[0])
    if (!resp.ok) throw new ErroPluggy('PLUGGY_INDISPONIVEL', `HTTP ${resp.status}`)
    return (await resp.json()) as T
  }

  obterItem(itemId: string): Promise<ItemPluggy> {
    return this.get(`/items/${encodeURIComponent(itemId)}`)
  }

  async listarContas(itemId: string): Promise<ContaPluggy[]> {
    const r = await this.get<{ results: ContaPluggy[] }>(`/accounts?itemId=${encodeURIComponent(itemId)}`)
    return r.results
  }

  /** Todas as transações da conta com data >= dateFrom (YYYY-MM-DD), seguindo o cursor. */
  async listarTransacoes(accountId: string, dateFrom: string): Promise<TransacaoPluggy[]> {
    const todas: TransacaoPluggy[] = []
    let caminho: string | null =
      `/v2/transactions?accountId=${encodeURIComponent(accountId)}&dateFrom=${dateFrom}`
    while (caminho) {
      const r: { results: TransacaoPluggy[]; next: string | null } = await this.get(caminho)
      todas.push(...r.results)
      caminho = r.next ? `/v2/transactions${r.next.startsWith('?') ? r.next : `?${r.next}`}` : null
    }
    return todas
  }
}
