import Button from './Button'

interface PaginationProps {
  pagina: number
  totalPaginas: number
  onMudarPagina: (pagina: number) => void
}

function Pagination({ pagina, totalPaginas, onMudarPagina }: PaginationProps) {
  if (totalPaginas <= 1) return null

  return (
    <nav
      className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4"
      aria-label="Paginação"
    >
      <Button
        variant="secondary"
        className="px-3 py-2 text-sm"
        onClick={() => onMudarPagina(pagina - 1)}
        disabled={pagina <= 1}
      >
        ‹ Anterior
      </Button>
      <span className="text-sm text-ink-soft">
        Página {pagina} de {totalPaginas}
      </span>
      <Button
        variant="secondary"
        className="px-3 py-2 text-sm"
        onClick={() => onMudarPagina(pagina + 1)}
        disabled={pagina >= totalPaginas}
      >
        Próxima ›
      </Button>
    </nav>
  )
}

export default Pagination
