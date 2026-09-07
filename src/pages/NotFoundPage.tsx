import { Link } from 'react-router'

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base">
      <h1 className="text-2xl font-semibold text-ink">Página não encontrada</h1>
      <Link to="/" className="text-livre underline">
        Voltar para o painel
      </Link>
    </div>
  )
}

export default NotFoundPage
