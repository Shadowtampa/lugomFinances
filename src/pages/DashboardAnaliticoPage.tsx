import { Navigate, useParams } from 'react-router'
import { PageHeader } from '../components/layout/AppShell'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import AbasDashboard from '../features/dashboard/AbasDashboard'
import CartoesAnalise from '../features/dashboard/CartoesAnalise'
import CategoriasAnalise from '../features/dashboard/CategoriasAnalise'
import { carregarDadosAnaliticos } from '../features/dashboard/dadosAnaliticos'
import { carregarDadosCartoes } from '../features/dashboard/dadosCartoes'
import FiltroPeriodo from '../features/dashboard/FiltroPeriodo'
import { usePeriodo } from '../features/dashboard/usePeriodo'
import VisaoGeral from '../features/dashboard/VisaoGeral'
import { useAsync } from '../hooks/useAsync'
import type { Periodo, PresetPeriodo } from '../lib/indicadores'

const ABAS_VALIDAS = ['visao-geral', 'categorias', 'cartoes']

type Contexto = { preset: PresetPeriodo; periodo: Periodo; anterior: Periodo; hoje: string }

function Carregando({ erro, vazio, recarregar }: { erro: boolean; vazio: boolean; recarregar(): void }) {
  return (
    <>
      {vazio && !erro && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}
      {erro && (
        <div role="alert" className="rounded-lg border border-line bg-surface p-4 text-sm">
          <p className="text-alerta">Não foi possível carregar os indicadores.</p>
          <Button variant="secondary" className="mt-2" onClick={recarregar}>
            Tentar de novo
          </Button>
        </div>
      )}
    </>
  )
}

function AbaGeral({ aba, ctx }: { aba: string; ctx: Contexto }) {
  const { preset, periodo, anterior, hoje } = ctx
  const dados = useAsync(() => carregarDadosAnaliticos(periodo, anterior), [periodo.de, periodo.ate, anterior.de])
  return (
    <>
      <Carregando erro={Boolean(dados.erro)} vazio={!dados.data} recarregar={dados.recarregar} />
      {dados.data && aba === 'visao-geral' && <VisaoGeral dados={dados.data} periodo={periodo} anterior={anterior} />}
      {dados.data && aba === 'categorias' && (
        <CategoriasAnalise dados={dados.data} periodo={periodo} anterior={anterior} preset={preset} hoje={hoje} />
      )}
    </>
  )
}

function AbaCartoes({ ctx }: { ctx: Contexto }) {
  const { periodo, anterior } = ctx
  const dados = useAsync(() => carregarDadosCartoes(periodo, anterior), [periodo.de, periodo.ate, anterior.de])
  return (
    <>
      <Carregando erro={Boolean(dados.erro)} vazio={!dados.data} recarregar={dados.recarregar} />
      {dados.data && <CartoesAnalise dados={dados.data} periodo={periodo} anterior={anterior} />}
    </>
  )
}

function Conteudo({ aba }: { aba: string }) {
  const { preset, periodo, anterior, hoje, definirPreset, definirCustom } = usePeriodo()
  const ctx: Contexto = { preset, periodo, anterior, hoje }
  return (
    <>
      <PageHeader title="Painel" />
      <AbasDashboard />
      <FiltroPeriodo preset={preset} periodo={periodo} anterior={anterior} onPreset={definirPreset} onCustom={definirCustom} />
      {aba === 'cartoes' ? <AbaCartoes ctx={ctx} /> : <AbaGeral aba={aba} ctx={ctx} />}
    </>
  )
}

/** Abas analíticas do Dashboard: /dashboard/visao-geral, /categorias (M31) e /cartoes (M32). */
function DashboardAnaliticoPage() {
  const { aba } = useParams()
  if (!aba || !ABAS_VALIDAS.includes(aba)) return <Navigate to="/" replace />
  return <Conteudo aba={aba} />
}

export default DashboardAnaliticoPage
