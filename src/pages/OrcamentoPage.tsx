import { Link } from 'react-router'
import { PageHeader } from '../components/layout/AppShell'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import BarraMeta from '../features/orcamento/BarraMeta'
import { avaliarAdesao } from '../features/orcamento/adesao'
import { useAsync } from '../hooks/useAsync'
import { mesAtual, nomeDoMes } from '../lib/date'
import { formatBRL } from '../lib/money'
import { obterAdesaoMetodo } from '../services/orcamento'

function OrcamentoPage() {
  const adesao = useAsync(obterAdesaoMetodo, [])

  return (
    <>
      <PageHeader title="Método 50-15-35" />

      {adesao.isLoading && <Spinner />}

      {adesao.erro && (
        <p className="text-sm text-alerta">
          Não foi possível carregar.{' '}
          <button type="button" className="underline" onClick={adesao.recarregar}>
            Tentar de novo
          </button>
        </p>
      )}

      {!adesao.isLoading && !adesao.erro && adesao.data === null && (
        <EmptyState
          titulo="Nenhuma entrada neste mês"
          texto="Registre as entradas deste mês para ver sua aderência ao método."
          acao={
            <Link to="/entradas" className="text-sm font-medium text-livre underline">
              Ir para entradas
            </Link>
          }
        />
      )}

      {!adesao.isLoading && adesao.data && (
        <section className="max-w-2xl">
          <p className="text-sm text-ink-soft">
            Renda de {nomeDoMes(mesAtual())}:{' '}
            <span className="font-money text-ink">
              {formatBRL(adesao.data.totalEntradasMesCentavos)}
            </span>
          </p>

          <div className="mt-2">
            {avaliarAdesao(adesao.data).map((avaliacao) => (
              <BarraMeta key={avaliacao.grupo} avaliacao={avaliacao} />
            ))}
          </div>

          {adesao.data.gastoNaoClassificadoCentavos > 0 && (
            <p className="mt-4 text-sm text-ink-soft">
              <span className="font-money text-ink">
                {formatBRL(adesao.data.gastoNaoClassificadoCentavos)}
              </span>{' '}
              em categorias não classificadas —{' '}
              <Link to="/categorias" className="text-livre underline">
                classifique em Categorias
              </Link>{' '}
              para incluir no cálculo.
            </p>
          )}
        </section>
      )}
    </>
  )
}

export default OrcamentoPage
