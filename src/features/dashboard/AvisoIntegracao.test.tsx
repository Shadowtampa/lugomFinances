import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import AvisoIntegracao from './AvisoIntegracao'
import type { StatusIntegracao } from '../../types/domain'

const AGORA = new Date(2026, 10, 20, 10)
const base: StatusIntegracao = {
  totalItens: 1,
  ultimaSincronizacaoEm: new Date(2026, 10, 20, 8).toISOString(),
  ultimaSincronizacaoSucesso: true,
  ultimaSincronizacaoErro: null,
  ultimaSincronizacaoImportadas: 2,
  ultimaSincronizacaoOkEm: new Date(2026, 10, 20, 8).toISOString(),
  itensComProblema: [],
}

function renderizar(status: StatusIntegracao | null) {
  return render(
    <MemoryRouter>
      <AvisoIntegracao status={status} agora={AGORA} onSincronizar={async () => {}} />
    </MemoryRouter>,
  )
}

describe('AvisoIntegracao', () => {
  it('não renderiza com integração saudável', () => {
    const { container } = renderizar(base)
    expect(container).toBeEmptyDOMElement()
  })
  it('mostra falha com botão de tentar de novo', () => {
    renderizar({ ...base, ultimaSincronizacaoSucesso: false, ultimaSincronizacaoErro: 'PLUGGY_INDISPONIVEL' })
    expect(screen.getByRole('alert')).toHaveTextContent('A última sincronização falhou em 20/11/2026 (Pluggy indisponível).')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })
  it('mostra reconexão sem botão de sincronizar', () => {
    renderizar({ ...base, itensComProblema: [{ itemId: 'i', nome: 'Mercado Pago', status: 'LOGIN_ERROR' }] })
    expect(screen.getByRole('alert')).toHaveTextContent('Reconecte Mercado Pago no Meu Pluggy.')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
