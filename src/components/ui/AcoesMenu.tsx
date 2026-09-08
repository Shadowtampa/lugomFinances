import type { ReactNode } from 'react'

interface ItemAcaoMenu {
  label: string
  onClick: () => void
  perigo?: boolean
  icon?: ReactNode
}

interface AcoesMenuProps {
  aberto: boolean
  onToggle: () => void
  onFechar: () => void
  itens: ItemAcaoMenu[]
}

function AcoesMenu({ aberto, onToggle, onFechar, itens }: AcoesMenuProps) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="Mais ações"
        className="flex h-11 w-11 items-center justify-center rounded text-ink-soft opacity-100 hover:bg-base sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
      >
        ⋯
      </button>
      {aberto && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={(event) => {
              event.stopPropagation()
              onFechar()
            }}
          />
          <div className="absolute right-0 top-full z-20 mt-1 rounded border border-line bg-surface shadow-lg">
            {itens.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`flex w-full items-center gap-2 whitespace-nowrap px-4 py-3 text-left text-sm hover:bg-base ${
                  item.perigo ? 'text-alerta' : 'text-ink'
                }`}
                onClick={(event) => {
                  event.stopPropagation()
                  item.onClick()
                }}
              >
                {item.icon && (
                  <span className="h-4 w-4 shrink-0" aria-hidden="true">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default AcoesMenu
