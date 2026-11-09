// Validação HS256 do JWT emitido pela RPC `login` (mesmo segredo do PostgREST).
import { createHmac, timingSafeEqual } from 'node:crypto'

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/** Devolve o `sub` se o token for válido, com role `authenticated` e não expirado; senão null. */
export function validarJwt(token: string, segredo: string, agora = Date.now()): string | null {
  const partes = token.split('.')
  if (partes.length !== 3) return null
  const [cabecalho, corpo, assinatura] = partes
  const esperado = b64url(createHmac('sha256', segredo).update(`${cabecalho}.${corpo}`).digest())
  const a = Buffer.from(assinatura)
  const b = Buffer.from(esperado)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const h = JSON.parse(Buffer.from(cabecalho, 'base64url').toString()) as { alg?: string }
    if (h.alg !== 'HS256') return null
    const c = JSON.parse(Buffer.from(corpo, 'base64url').toString()) as {
      sub?: string
      role?: string
      exp?: number
    }
    if (c.role !== 'authenticated' || !c.sub) return null
    if (typeof c.exp === 'number' && c.exp * 1000 < agora) return null
    return c.sub
  } catch {
    return null
  }
}
