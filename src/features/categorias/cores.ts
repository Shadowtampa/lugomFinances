// Paleta fixa para categorias. Deliberadamente evita verde/azul/vermelho — essas
// cores são semânticas (fonte livre/restrita, bloqueio) em 00-VISAO-GERAL.md.
export const CORES_CATEGORIA = [
  '#5C6B64', // cinza — default do banco
  '#B8630F', // laranja
  '#C9A227', // mostarda
  '#6B4226', // marrom
  '#8E44AD', // roxo
  '#C2578D', // rosa
  '#4A4E69', // ardósia
  '#7A7A3A', // oliva
] as const

export function corAleatoria(): string {
  return CORES_CATEGORIA[Math.floor(Math.random() * CORES_CATEGORIA.length)]
}
