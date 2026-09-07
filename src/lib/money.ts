export function formatBRL(centavos: number): string {
  const reais = centavos / 100
  return reais
    .toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
    .replace(/ /g, ' ')
}

export function parseBRL(input: string): number {
  const digits = input.replace(/[^\d,.-]/g, '')
  const normalized = digits.replace(/\./g, '').replace(',', '.')
  const reais = parseFloat(normalized)
  if (Number.isNaN(reais)) return 0
  return Math.round(reais * 100)
}

export function centavosParaReais(centavos: number): number {
  return centavos / 100
}
