import type { ReactNode } from 'react'
import { formatBRL } from '../../lib/money'
import { diferencaPontos, variacaoPercentual } from '../../lib/indicadores'

function cor(delta: number, maisEhBom: boolean | null): string {
  if (delta === 0 || maisEhBom === null) return 'text-ink-soft'
  return (delta > 0) === maisEhBom ? 'text-livre' : 'text-alerta'
}

/** Variação de um valor em dinheiro contra o período anterior. */
export function VariacaoDinheiro({
  atual,
  anterior,
  maisEhBom,
}: {
  atual: number
  anterior: number
  maisEhBom: boolean | null
}) {
  const pct = variacaoPercentual(atual, anterior)
  const abs = atual - anterior
  if (pct === null) {
    return <p className="text-xs text-ink-soft">vs. período anterior: — (sem base)</p>
  }
  const sinal = abs > 0 ? '+' : ''
  return (
    <p className={`text-xs ${cor(abs, maisEhBom)}`}>
      {sinal}
      {formatBRL(abs)} ({sinal}
      {pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%) vs. período anterior
    </p>
  )
}

/** Variação de uma taxa (%) em pontos percentuais. */
export function VariacaoPontos({
  atual,
  anterior,
  maisEhBom,
}: {
  atual: number | null
  anterior: number | null
  maisEhBom: boolean | null
}) {
  const dif = diferencaPontos(atual, anterior)
  if (dif === null) return <p className="text-xs text-ink-soft">vs. período anterior: —</p>
  const sinal = dif > 0 ? '+' : ''
  return (
    <p className={`text-xs ${cor(dif, maisEhBom)}`}>
      {sinal}
      {dif.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p. vs. período anterior
    </p>
  )
}

interface CardIndicadorProps {
  titulo: string
  valor: string
  destaque?: 'positivo' | 'negativo' | 'neutro'
  nota?: string
  children?: ReactNode
}

const COR_DESTAQUE = { positivo: 'text-livre', negativo: 'text-alerta', neutro: 'text-ink' }

function CardIndicador({ titulo, valor, destaque = 'neutro', nota, children }: CardIndicadorProps) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-sm text-ink-soft">{titulo}</p>
      <p className={`font-money text-xl font-semibold ${COR_DESTAQUE[destaque]}`}>{valor}</p>
      {nota && <p className="text-xs text-ink-soft">{nota}</p>}
      {children}
    </div>
  )
}

export default CardIndicador
