import { env } from './env'

// Sessão própria (M17): o token vem da RPC `login` do banco e fica no localStorage.
// Sem refresh token: o JWT vale 30 dias; expirou, entra de novo.

export interface Usuario {
  id: string
  email: string
}

export interface Sessao {
  accessToken: string
  expiresAt: number // epoch em segundos
  user: Usuario
}

export type EventoSessao = 'SIGNED_IN' | 'SIGNED_OUT'

const CHAVE = 'lugom.sessao'
const ouvintes = new Set<(evento: EventoSessao, sessao: Sessao | null) => void>()

function expirou(sessao: Sessao): boolean {
  return sessao.expiresAt * 1000 <= Date.now()
}

function ler(): Sessao | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return null
    const sessao = JSON.parse(bruto) as Sessao
    if (!sessao.accessToken || expirou(sessao)) {
      localStorage.removeItem(CHAVE)
      return null
    }
    return sessao
  } catch {
    return null
  }
}

function emitir(evento: EventoSessao, sessao: Sessao | null) {
  for (const ouvinte of ouvintes) ouvinte(evento, sessao)
}

export function sessaoAtual(): Sessao | null {
  return ler()
}

export function aoMudarSessao(
  ouvinte: (evento: EventoSessao, sessao: Sessao | null) => void,
): () => void {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

export class ErroLogin extends Error {}

export async function entrar(email: string, senha: string): Promise<Sessao> {
  const resposta = await fetch(`${env.apiUrl}/rpc/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })

  const corpo = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    const mensagem: string = corpo?.message ?? ''
    throw new ErroLogin(mensagem.split(':')[0]?.trim() || 'UNKNOWN')
  }

  const sessao: Sessao = {
    accessToken: corpo.access_token,
    expiresAt: corpo.expires_at,
    user: corpo.user,
  }
  localStorage.setItem(CHAVE, JSON.stringify(sessao))
  emitir('SIGNED_IN', sessao)
  return sessao
}

export function sair(): void {
  const tinhaSessao = localStorage.getItem(CHAVE) !== null
  localStorage.removeItem(CHAVE)
  if (tinhaSessao) emitir('SIGNED_OUT', null)
}
