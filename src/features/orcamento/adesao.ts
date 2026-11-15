import type { AdesaoMetodo, GrupoOrcamentario } from '../../types/domain'

export const GRUPOS: GrupoOrcamentario[] = ['essenciais', 'prioridades', 'estilo_de_vida']

export const METAS: Record<GrupoOrcamentario, number> = {
  essenciais: 50,
  prioridades: 15,
  estilo_de_vida: 35,
}

export const ROTULOS_GRUPO: Record<GrupoOrcamentario, string> = {
  essenciais: 'Essenciais',
  prioridades: 'Prioridades',
  estilo_de_vida: 'Estilo de vida',
}

export const LEGENDAS_GRUPO: Record<GrupoOrcamentario, string> = {
  essenciais: 'moradia, contas, mercado, transporte, saúde',
  prioridades: 'quitar dívidas e investir',
  estilo_de_vida: 'lazer, restaurantes, compras, viagens',
}

export type AvaliacaoGrupo = {
  grupo: GrupoOrcamentario
  gastoCentavos: number
  percentual: number
  meta: number
  alerta: boolean
  texto: string
}

export function percentualDaRenda(gastoCentavos: number, rendaCentavos: number): number {
  if (rendaCentavos <= 0) return 0
  return Math.round((gastoCentavos / rendaCentavos) * 100)
}

// Essenciais e Estilo de vida: o problema é passar da meta. Prioridades: o problema é
// ficar abaixo dela.
export function avaliarGrupo(
  grupo: GrupoOrcamentario,
  gastoCentavos: number,
  rendaCentavos: number,
): AvaliacaoGrupo {
  const meta = METAS[grupo]
  const percentual = percentualDaRenda(gastoCentavos, rendaCentavos)
  const diferenca = Math.abs(percentual - meta)

  let alerta: boolean
  let texto: string
  if (grupo === 'prioridades') {
    alerta = percentual < meta
    texto = alerta ? `${diferenca}% abaixo da meta` : 'meta atingida'
  } else {
    alerta = percentual > meta
    if (alerta) texto = `${diferenca}% acima da meta`
    else if (diferenca === 0) texto = 'na meta'
    else texto = `dentro da meta · sobram ${diferenca}%`
  }

  return { grupo, gastoCentavos, percentual, meta, alerta, texto }
}

export function avaliarAdesao(adesao: AdesaoMetodo): AvaliacaoGrupo[] {
  const gastos: Record<GrupoOrcamentario, number> = {
    essenciais: adesao.gastoEssenciaisCentavos,
    prioridades: adesao.gastoPrioridadesCentavos,
    estilo_de_vida: adesao.gastoEstiloDeVidaCentavos,
  }
  return GRUPOS.map((grupo) =>
    avaliarGrupo(grupo, gastos[grupo], adesao.totalEntradasMesCentavos),
  )
}
