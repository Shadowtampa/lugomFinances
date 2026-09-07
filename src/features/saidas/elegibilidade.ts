import { formatBRL } from '../../lib/money'
import type { Categoria, Fonte } from '../../types/domain'

export type FonteComSaldo = Fonte & { saldoCentavos: number }

export type Elegibilidade = {
  elegivel: boolean
  motivo?: string
}

export function avaliarFonte(
  fonte: FonteComSaldo,
  categoriaId: string,
  categorias: Categoria[],
  valorNecessarioCentavos: number,
): Elegibilidade {
  if (fonte.tipo === 'restrita' && !fonte.categoriasPermitidas?.includes(categoriaId)) {
    const nomeCategoria = categorias.find((c) => c.id === categoriaId)?.nome ?? 'essa categoria'
    return { elegivel: false, motivo: `não aceita ${nomeCategoria}` }
  }

  if (valorNecessarioCentavos > 0 && fonte.saldoCentavos < valorNecessarioCentavos) {
    return { elegivel: false, motivo: `${formatBRL(fonte.saldoCentavos)} disponíveis` }
  }

  return { elegivel: true }
}
