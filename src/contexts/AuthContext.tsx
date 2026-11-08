import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useToast } from '../components/ui/Toast'
import * as auth from '../lib/auth'
import type { Sessao, Usuario } from '../lib/auth'

interface AuthContextValue {
  user: Usuario | null
  session: Sessao | null
  isLoading: boolean
  entrar(email: string, senha: string): Promise<void>
  sair(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function traduzirErroLogin(error: unknown): string {
  if (error instanceof auth.ErroLogin && error.message === 'INVALID_CREDENTIALS') {
    return 'E-mail ou senha incorretos.'
  }
  if (error instanceof TypeError) {
    return 'Não foi possível conectar. Verifique sua conexão.'
  }
  return 'Não foi possível entrar. Tente novamente.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Sessao | null>(() => auth.sessaoAtual())
  const isLoading = false
  const saindoRef = useRef(false)
  const { showToast } = useToast()

  useEffect(() => {
    return auth.aoMudarSessao((evento, novaSessao) => {
      setSession(novaSessao)

      if (evento === 'SIGNED_OUT' && !saindoRef.current) {
        showToast('Sua sessão expirou. Entre novamente.', 'error')
      }

      saindoRef.current = false
    })
  }, [showToast])

  async function entrar(email: string, senha: string) {
    try {
      await auth.entrar(email, senha)
    } catch (error) {
      throw new Error(traduzirErroLogin(error))
    }
  }

  async function sair() {
    saindoRef.current = true
    auth.sair()
  }

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, isLoading, entrar, sair }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
