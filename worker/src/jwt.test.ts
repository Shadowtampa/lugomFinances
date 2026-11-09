import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { validarJwt } from './jwt.ts'

const SEGREDO = 'segredo-de-teste'
function token(corpo: object, segredo = SEGREDO, alg = 'HS256') {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const base = `${enc({ alg, typ: 'JWT' })}.${enc(corpo)}`
  return `${base}.${createHmac('sha256', segredo).update(base).digest('base64url')}`
}
const AGORA = 1_800_000_000_000

describe('validarJwt', () => {
  it('aceita token válido e devolve o sub', () => {
    expect(validarJwt(token({ sub: 'u1', role: 'authenticated', exp: AGORA / 1000 + 60 }), SEGREDO, AGORA)).toBe('u1')
  })
  it('recusa assinatura com outro segredo', () => {
    expect(validarJwt(token({ sub: 'u1', role: 'authenticated' }, 'outro'), SEGREDO, AGORA)).toBeNull()
  })
  it('recusa expirado e role errada', () => {
    expect(validarJwt(token({ sub: 'u1', role: 'authenticated', exp: AGORA / 1000 - 1 }), SEGREDO, AGORA)).toBeNull()
    expect(validarJwt(token({ sub: 'u1', role: 'anon' }), SEGREDO, AGORA)).toBeNull()
  })
  it('recusa lixo', () => {
    expect(validarJwt('abc', SEGREDO, AGORA)).toBeNull()
  })
})
