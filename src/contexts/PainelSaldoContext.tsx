import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import PainelSaldo, { type PainelSaldoProps } from '../components/ui/PainelSaldo'

type DadosPainelSaldo = Omit<PainelSaldoProps, 'onFechar'>

interface PainelSaldoContextValue {
  mostrarPainelSaldo: (dados: DadosPainelSaldo) => void
}

const PainelSaldoContext = createContext<PainelSaldoContextValue | null>(null)

export function PainelSaldoProvider({ children }: { children: ReactNode }) {
  const [painel, setPainel] = useState<(DadosPainelSaldo & { id: string }) | null>(null)

  const fecharPainelSaldo = useCallback(() => {
    setPainel(null)
  }, [])

  const mostrarPainelSaldo = useCallback((dados: DadosPainelSaldo) => {
    setPainel({ ...dados, id: crypto.randomUUID() })
  }, [])

  return (
    <PainelSaldoContext.Provider value={{ mostrarPainelSaldo }}>
      {children}
      {painel && <PainelSaldo key={painel.id} {...painel} onFechar={fecharPainelSaldo} />}
    </PainelSaldoContext.Provider>
  )
}

export function usePainelSaldo() {
  const context = useContext(PainelSaldoContext)
  if (!context) {
    throw new Error('usePainelSaldo deve ser usado dentro de PainelSaldoProvider')
  }
  return context
}
