import { useCallback, useEffect, useRef, useState } from 'react'
import { mensagemDoErro } from '../lib/erros'
import type { FiltroRecorrencia } from '../lib/recorrencias'
import { listarPlanejamentoPagina } from '../services/recorrencias'
import type { RecorrenciaDoMes } from '../types/domain'

type Opcoes = {
  /** YYYY-MM */
  competencia: string
  /** Omitido = Geral. */
  tipoId?: number
  filtro: FiltroRecorrencia
  /** Não busca enquanto o Tipo da URL ainda não foi resolvido (ou é inválido). */
  pausado?: boolean
  onErroCarregarMais?(mensagem: string): void
}

/**
 * Lista do Planejamento paginada pela API (10 por vez, "Carregar mais").
 * Mudou competência/Tipo/filtro: volta à primeira página. `recarregar()` refaz o que já
 * estava na tela (ex.: após marcar como paga) sem perder a posição.
 */
export function usePlanejamentoPaginado({ competencia, tipoId, filtro, pausado, onErroCarregarMais }: Opcoes) {
  const [estado, setEstado] = useState({
    itens: [] as RecorrenciaDoMes[],
    total: 0,
    carregando: true,
    carregandoMais: false,
    erro: false,
  })
  const [versao, setVersao] = useState(0)
  // Quantos itens refazer na próxima busca; consumido e zerado pelo effect.
  const tamanhoRecarga = useRef(0)
  const contexto = `${competencia}|${tipoId ?? ''}|${filtro}`
  const contextoAtual = useRef(contexto)
  contextoAtual.current = contexto
  const itensCarregados = useRef(0)
  itensCarregados.current = estado.itens.length

  useEffect(() => {
    if (pausado) return
    let cancelado = false
    const tamanho = tamanhoRecarga.current
    tamanhoRecarga.current = 0
    setEstado((e) => ({ ...e, carregando: true, erro: false }))
    listarPlanejamentoPagina({ competencia, tipoId, filtro, offset: 0, tamanho: tamanho || undefined })
      .then((pagina) => {
        if (!cancelado) setEstado((e) => ({ ...e, itens: pagina.itens, total: pagina.total, carregando: false }))
      })
      .catch(() => {
        if (!cancelado) setEstado((e) => ({ ...e, carregando: false, erro: true }))
      })
    return () => {
      cancelado = true
    }
  }, [competencia, tipoId, filtro, versao, pausado])

  const recarregar = useCallback(() => {
    tamanhoRecarga.current = Math.max(itensCarregados.current, 1)
    setVersao((v) => v + 1)
  }, [])

  const carregarMais = useCallback(async () => {
    const doContexto = contextoAtual.current
    setEstado((e) => ({ ...e, carregandoMais: true }))
    try {
      const pagina = await listarPlanejamentoPagina({
        competencia,
        tipoId,
        filtro,
        offset: itensCarregados.current,
      })
      if (doContexto !== contextoAtual.current) return // trocou competência/Tipo/filtro no meio
      setEstado((e) => ({ ...e, itens: [...e.itens, ...pagina.itens], total: pagina.total }))
    } catch (e) {
      onErroCarregarMais?.(mensagemDoErro(e))
    } finally {
      setEstado((e) => ({ ...e, carregandoMais: false }))
    }
  }, [competencia, tipoId, filtro, onErroCarregarMais])

  return { ...estado, recarregar, carregarMais }
}
