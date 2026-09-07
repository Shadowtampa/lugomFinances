import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  titulo: string
  texto: string
  acao?: ReactNode
}

function EmptyState({ icon, titulo, texto, acao }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      {icon && <div className="text-ink-soft">{icon}</div>}
      <h3 className="text-lg font-medium text-ink">{titulo}</h3>
      <p className="max-w-sm text-sm text-ink-soft">{texto}</p>
      {acao}
    </div>
  )
}

export default EmptyState
