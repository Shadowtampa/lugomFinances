const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-11" → "nov/26". */
export function rotuloMes(ym: string): string {
  const [ano, mes] = ym.split('-').map(Number)
  return `${MESES_CURTOS[mes - 1]}/${String(ano).slice(2)}`
}

/** Percentual para exibição; `null` (indisponível) vira "—". */
export function formatarPercentual(valor: number | null, casas = 0): string {
  if (valor === null) return '—'
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
}

/** Cores para fatias sem cor própria (instituições). Ciclam se houver mais fatias que cores. */
const PALETA = [
  'var(--color-restrita)',
  'var(--color-livre)',
  'var(--color-aviso)',
  'var(--color-alerta)',
  'var(--color-ink-soft)',
  '#7A3E9D',
  '#0E7C86',
]

export function corDaPaleta(indice: number): string {
  return PALETA[indice % PALETA.length]
}
