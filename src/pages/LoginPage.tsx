import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useAuth } from '../contexts/AuthContext'

function LoginPage() {
  const { session, isLoading, entrar } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!isLoading && session) {
    const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from
    return <Navigate to={from ? `${from.pathname}${from.search}` : '/'} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await entrar(email, senha)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center bg-base px-6">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="mb-8 text-2xl font-semibold text-ink">Lugom</h1>

        {erro && (
          <p className="mb-4 rounded border border-alerta/30 bg-alerta/10 px-3 py-2 text-sm text-alerta">
            {erro}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
          />
          <Button type="submit" loading={enviando} disabled={enviando}>
            Entrar
          </Button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
