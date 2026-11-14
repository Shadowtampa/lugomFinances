import type { AdesaoMetodo, GrupoOrcamentario } from '../../types/domain'

export const GRUPOS: GrupoOrcamentario[] = ['necessidades', 'desejos', 'investimentos']

export const METAS: Record<GrupoOrcamentario, number> = {
  necessidades: 50,
  desejos: 15,
  investimentos: 35,
}

export const ROTULOS_GRUPO: Record<GrupoOrcamentario, string> = {
  necessidades: 'Necessidades',
  desejos: 'Desejos',
  investimentos: 'Investimentos',
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

// Necessidades e Desejos: o problema é passar da meta. Investimentos: o problema é
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
  if (grupo === 'investimentos') {
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
    necessidades: adesao.gastoNecessidadesCentavos,
    desejos: adesao.gastoDesejosCentavos,
    investimentos: adesao.gastoInvestimentosCentavos,
  }
  return GRUPOS.map((grupo) =>
    avaliarGrupo(grupo, gastos[grupo], adesao.totalEntradasMesCentavos),
  )
}
