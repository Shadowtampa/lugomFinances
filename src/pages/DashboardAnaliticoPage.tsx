import { Navigate, useParams } from 'react-router'
import { PageHeader } from '../components/layout/AppShell'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import AbasDashboard from '../features/dashboard/AbasDashboard'
import CategoriasAnalise from '../features/dashboard/CategoriasAnalise'
import { carregarDadosAnaliticos } from '../features/dashboard/dadosAnaliticos'
import FiltroPeriodo from '../features/dashboard/FiltroPeriodo'
import { usePeriodo } from '../features/dashboard/usePeriodo'
import VisaoGeral from '../features/dashboard/VisaoGeral'
import { useAsync } from '../hooks/useAsync'

const ABAS_VALIDAS = ['visao-geral', 'categorias']

function Conteudo({ aba }: { aba: string }) {
  const { preset, periodo, anterior, hoje, definirPreset, definirCustom } = usePeriodo()
  const dados = useAsync(
    () => carregarDadosAnaliticos(periodo, anterior),
    [periodo.de, periodo.ate, anterior.de],
  )

  return (
    <>
      <PageHeader title="Painel" />
      <AbasDashboard />
      <FiltroPeriodo
        preset={preset}
        periodo={periodo}
        anterior={anterior}
        onPreset={definirPreset}
        onCustom={definirCustom}
      />

      {dados.isLoading && !dados.data && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}
      {dados.erro && (
        <div role="alert" className="rounded-lg border border-line bg-surface p-4 text-sm">
          <p className="text-alerta">Não foi possível carregar os indicadores.</p>
          <Button variant="secondary" className="mt-2" onClick={dados.recarregar}>
            Tentar de novo
          </Button>
        </div>
      )}
      {dados.data && aba === 'visao-geral' && <VisaoGeral dados={dados.data} periodo={periodo} anterior={anterior} />}
      {dados.data && aba === 'categorias' && (
        <CategoriasAnalise dados={dados.data} periodo={periodo} anterior={anterior} preset={preset} hoje={hoje} />
      )}
    </>
  )
}

/** Abas analíticas do Dashboard (M31): /dashboard/visao-geral e /dashboard/categorias. */
function DashboardAnaliticoPage() {
  const { aba } = useParams()
  if (!aba || !ABAS_VALIDAS.includes(aba)) return <Navigate to="/" replace />
  return <Conteudo aba={aba} />
}

export default DashboardAnaliticoPage
