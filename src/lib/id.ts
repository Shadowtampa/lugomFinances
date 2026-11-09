let contador = 0

/**
 * Id local para chaves de UI (toasts, painéis). Não usa crypto.randomUUID():
 * ele só existe em contexto seguro (HTTPS/localhost), e o app roda em
 * http://<ip>:10070 — lá ele é undefined e quebrava todo showToast.
 */
export function idLocal(): string {
  contador += 1
  return `${Date.now().toString(36)}-${contador}`
}
