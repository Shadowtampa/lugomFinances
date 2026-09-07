import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  isLoading: boolean
  entrar(email: string, senha: string): Promise<void>
  sair(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function traduzirErroLogin(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'Invalid login credentials') {
      return 'E-mail ou senha incorretos.'
    }
    if (error.message === 'Failed to fetch') {
      return 'Não foi possível conectar. Verifique sua internet.'
    }
  }
  return 'Não foi possível entrar. Tente novamente.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const saindoRef = useRef(false)
  const { showToast } = useToast()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, novaSessao) => {
      setSession(novaSessao)

      if (event === 'SIGNED_OUT' && !saindoRef.current) {
        showToast('Sua sessão expirou. Entre novamente.', 'error')
      }

      saindoRef.current = false
    })

    return () => subscription.subscription.unsubscribe()
  }, [showToast])

  async function entrar(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      throw new Error(traduzirErroLogin(error))
    }
  }

  async function sair() {
    saindoRef.current = true
    await supabase.auth.signOut()
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
