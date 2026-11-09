import { useCallback, useEffect, useRef, useState } from 'react'
import { type ApiError, mensagemDoErro } from '../lib/erros'

function paraApiError(e: unknown): ApiError {
  if (e && typeof e === 'object' && 'codigo' in e && 'mensagem' in e) {
    return e as ApiError
  }
  return { codigo: 'UNKNOWN', mensagem: mensagemDoErro(e) }
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
): {
  data: T | undefined
  isLoading: boolean
  erro: ApiError | null
  recarregar(): void
} {
  const [data, setData] = useState<T>()
  const [isLoading, setIsLoading] = useState(true)
  const [erro, setErro] = useState<ApiError | null>(null)
  const [versao, setVersao] = useState(0)

  // Recarga silenciosa (aba voltou ao foco) não pisca o estado de carregamento.
  const silencioso = useRef(false)
  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  // Dado pode mudar fora desta tela (worker da Pluggy, outra aba, celular):
  // ao voltar para a aba, busca de novo.
  useEffect(() => {
    function aoVoltar() {
      if (document.visibilityState !== 'visible') return
      silencioso.current = true
      setVersao((v) => v + 1)
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [])

  useEffect(() => {
    let cancelado = false
    if (!silencioso.current) setIsLoading(true)
    silencioso.current = false
    setErro(null)

    fn()
      .then((resultado) => {
        if (cancelado) return
        setData(resultado)
      })
      .catch((e: unknown) => {
        if (cancelado) return
        setErro(paraApiError(e))
      })
      .finally(() => {
        if (cancelado) return
        setIsLoading(false)
      })

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versao])

  return { data, isLoading, erro, recarregar }
}
