/**
 * Identidade visual das Fontes pessoais, fixa no código (pedido do usuário: não é configurável).
 * Para vestir outra Fonte, acrescente o id dela aqui. Cores aproximadas das marcas.
 */
export type IdentidadeFonte = {
  /** Nome exibido no lugar do salvo (ex.: "BANCO INTER" da Pluggy → "Inter"). */
  nome: string
  /** Cor da marca: vira a cor da Fonte em bolinhas e painéis. */
  cor: string
  /** Selo: texto curto sobre o fundo da marca. */
  sigla: string
  corTexto: string
}

const IDENTIDADES: Record<string, IdentidadeFonte> = {
  '64ef9615-d3c1-4e0d-8f13-d9ce6dd7a518': { nome: 'Inter', cor: '#FF7A00', sigla: 'inter', corTexto: '#FFFFFF' },
  '1ab27438-ee1e-4800-8401-6ea5912e366e': {
    nome: 'Cartão Inter',
    cor: '#1F1F1F',
    sigla: 'inter',
    corTexto: '#FF7A00',
  },
  'ebaed719-1b58-4593-9f6c-a80c0aa42d84': {
    nome: 'Mercado Pago',
    cor: '#00B1EA',
    sigla: 'mp',
    corTexto: '#FFFFFF',
  },
  'b480d00f-81dd-4a98-b018-8beeb1ba29a6': { nome: 'Flash', cor: '#F2295B', sigla: 'flash', corTexto: '#FFFFFF' },
}

export function identidadeDaFonte(fonteId: string): IdentidadeFonte | undefined {
  return IDENTIDADES[fonteId]
}
