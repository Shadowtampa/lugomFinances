// Página temporária do M4 — prova que services + supabase-js funcionam ponta a
// ponta. Remover no início do M5.
import { PageHeader } from '../components/layout/AppShell'
import Money from '../components/ui/Money'
import Spinner from '../components/ui/Spinner'
import { useAsync } from '../hooks/useAsync'
import { listarCategorias } from '../services/categorias'
import { listarFontes, listarSaldosFontes } from '../services/fontes'

function DebugPage() {
  const fontes = useAsync(listarFontes, [])
  const saldos = useAsync(listarSaldosFontes, [])
  const categorias = useAsync(listarCategorias, [])

  return (
    <>
      <PageHeader title="Debug (M4)" />

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-ink-soft">Fontes</h2>
        {fontes.isLoading && <Spinner />}
        {fontes.erro && <p className="text-alerta">{fontes.erro.mensagem}</p>}
        <ul className="flex flex-col gap-1">
          {fontes.data?.map((fonte) => (
            <li key={fonte.id}>
              {fonte.nome} ({fonte.tipo})
              {fonte.categoriasPermitidas ? ` — ${fonte.categoriasPermitidas.length} categorias` : ''}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-ink-soft">Saldos por fonte</h2>
        {saldos.isLoading && <Spinner />}
        {saldos.erro && <p className="text-alerta">{saldos.erro.mensagem}</p>}
        <ul className="flex flex-col gap-1">
          {saldos.data?.map((saldo) => (
            <li key={saldo.id}>
              {saldo.nome}: <Money centavos={saldo.saldoCentavos} sinal />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-ink-soft">Categorias</h2>
        {categorias.isLoading && <Spinner />}
        {categorias.erro && <p className="text-alerta">{categorias.erro.mensagem}</p>}
        <ul className="flex flex-col gap-1">
          {categorias.data?.map((categoria) => (
            <li key={categoria.id}>{categoria.nome}</li>
          ))}
        </ul>
      </section>
    </>
  )
}

export default DebugPage
