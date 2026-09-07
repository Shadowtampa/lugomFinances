import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import MoneyInput from '../../components/ui/MoneyInput'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import type { ApiError } from '../../lib/erros'
import { mensagemDoErro } from '../../lib/erros'
import { formatBRL } from '../../lib/money'
import { atualizarSaida, criarSaida } from '../../services/saidas'
import type { Categoria, Saida, SaldoCategoria } from '../../types/domain'
import { avaliarFonte, type FonteComSaldo } from './elegibilidade'

interface SaidaFormModalProps {
  aberto: boolean
  saida?: Saida
  duplicarDe?: Saida
  fontes: FonteComSaldo[]
  categorias: Categoria[]
  saldosCategorias: SaldoCategoria[]
  onFechar(): void
  onSalvo(): void
}

type LinhaSplit = { fonteId: string; valorCentavos: number }

function hojeISO(): string {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const dia = String(hoje.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function diaDe(dataISO: string): number {
  return Number(dataISO.split('-')[2])
}

function opcaoLabel(fonte: FonteComSaldo, motivo: string | undefined): string {
  return motivo ? `${fonte.nome} — ${motivo}` : fonte.nome
}

function SaidaFormModal({
  aberto,
  saida,
  duplicarDe,
  fontes,
  categorias,
  saldosCategorias,
  onFechar,
  onSalvo,
}: SaidaFormModalProps) {
  const { showToast } = useToast()
  const tituloRef = useRef<HTMLInputElement>(null)

  const origem = saida ?? duplicarDe

  const splitsIniciais: LinhaSplit[] = origem
    ? origem.splits.map((s) => ({ fonteId: s.fonteId, valorCentavos: s.valorCentavos }))
    : []

  const [titulo, setTitulo] = useState(origem?.titulo ?? '')
  const [erroTitulo, setErroTitulo] = useState<string | null>(null)
  const [valorCentavos, setValorCentavos] = useState(origem?.valorTotalCentavos ?? 0)
  const [erroValor, setErroValor] = useState<string | null>(null)
  const [categoriaId, setCategoriaId] = useState(origem?.categoriaId ?? '')
  const [erroCategoria, setErroCategoria] = useState<string | null>(null)
  const [data, setData] = useState(origem?.data ?? hojeISO())
  const [erroData, setErroData] = useState<string | null>(null)
  const [recorrente, setRecorrente] = useState(origem?.recorrente ?? false)
  const [diaRecorrencia, setDiaRecorrencia] = useState(
    origem?.diaRecorrencia ?? diaDe(origem?.data ?? hojeISO()),
  )
  const [erroDia, setErroDia] = useState<string | null>(null)

  const [modoSplit, setModoSplit] = useState(splitsIniciais.length > 1)
  const [fonteSimples, setFonteSimples] = useState(splitsIniciais[0]?.fonteId ?? '')
  const [erroFonte, setErroFonte] = useState<string | null>(null)
  const [splits, setSplits] = useState<LinhaSplit[]>(
    splitsIniciais.length > 1 ? splitsIniciais : [],
  )
  const [erroFonteLinha, setErroFonteLinha] = useState<Record<number, string>>({})

  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    tituloRef.current?.focus()
  }, [])

  const ehTemplate = saida?.recorrente === true && saida.templateId === null

  const mapaFontes = useMemo(() => {
    const mapa = new Map<string, FonteComSaldo>()
    for (const fonte of fontes) mapa.set(fonte.id, fonte)
    return mapa
  }, [fontes])

  function opcoesFonte(valorNecessario: number, fonteIdsUsadasEmOutrasLinhas: string[]) {
    return fontes
      .filter((f) => !fonteIdsUsadasEmOutrasLinhas.includes(f.id))
      .map((f) => {
        const resultado = categoriaId
          ? avaliarFonte(f, categoriaId, categorias, valorNecessario)
          : { elegivel: true }
        return { fonte: f, ...resultado }
      })
  }

  const saldoCategoriaAtual = saldosCategorias.find((c) => c.id === categoriaId)
  const avisoEstouro = useMemo(() => {
    if (!saldoCategoriaAtual || saldoCategoriaAtual.limiteMensalCentavos === null) return null
    const disponivel = saldoCategoriaAtual.saldoDisponivelCentavos ?? 0
    if (valorCentavos <= disponivel) return null
    const excesso = valorCentavos - disponivel
    return `Isso vai deixar ${saldoCategoriaAtual.nome} ${formatBRL(excesso)} acima do limite. Você ainda pode registrar.`
  }, [saldoCategoriaAtual, valorCentavos])

  function ativarModoSplit() {
    setSplits([{ fonteId: fonteSimples, valorCentavos }])
    setModoSplit(true)
  }

  function voltarModoSimples() {
    if (splits.length !== 1) return
    setFonteSimples(splits[0].fonteId)
    setSplits([])
    setModoSplit(false)
  }

  function adicionarLinha() {
    const somaAtual = splits.reduce((s, l) => s + l.valorCentavos, 0)
    const novaLinha: LinhaSplit =
      splits.length === 1
        ? { fonteId: '', valorCentavos: Math.max(valorCentavos - somaAtual, 0) }
        : { fonteId: '', valorCentavos: 0 }
    setSplits([...splits, novaLinha])
  }

  function removerLinha(indice: number) {
    if (splits.length <= 1) return
    setSplits(splits.filter((_, i) => i !== indice))
  }

  function atualizarLinha(indice: number, campo: 'fonteId' | 'valorCentavos', valor: string | number) {
    setSplits(splits.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)))
  }

  const somaSplits = splits.reduce((s, l) => s + l.valorCentavos, 0)
  const diffSplits = valorCentavos - somaSplits

  function aplicarErroServidor(erro: ApiError) {
    const detalhe = erro.detalhe ?? ''

    if (erro.codigo === 'SALDO_INSUFICIENTE') {
      const match = detalhe.match(/fonte=(.+?) saldo=(\d+) solicitado=(\d+)/)
      if (match) {
        const [, nomeFonte, saldo] = match
        const mensagem = `${nomeFonte} tem apenas ${formatBRL(Number(saldo))}. Reduza o valor ou divida entre outras fontes.`
        setErroGeral(mensagem)
        const indiceLinha = splits.findIndex((l) => mapaFontes.get(l.fonteId)?.nome === nomeFonte)
        if (indiceLinha >= 0) {
          setErroFonteLinha({ [indiceLinha]: mensagem })
        } else if (mapaFontes.get(fonteSimples)?.nome === nomeFonte) {
          setErroFonte(mensagem)
        }
        return
      }
    }

    if (erro.codigo === 'CATEGORIA_NAO_PERMITIDA_NA_FONTE') {
      const match = detalhe.match(/fonte=(.+?) categoria=([0-9a-fA-F-]+)/)
      if (match) {
        const [, nomeFonte, catId] = match
        const nomeCategoria = categorias.find((c) => c.id === catId)?.nome ?? 'essa categoria'
        const fonte = fontes.find((f) => f.nome === nomeFonte)
        const listaPermitidas = fonte?.categoriasPermitidas
          ?.map((id) => categorias.find((c) => c.id === id)?.nome)
          .filter(Boolean)
          .join(', ')
        const mensagem = `${nomeFonte} não pode pagar ${nomeCategoria}. Essa fonte é restrita a: ${
          listaPermitidas || '—'
        }.`
        setErroGeral(mensagem)
        const indiceLinha = splits.findIndex((l) => mapaFontes.get(l.fonteId)?.nome === nomeFonte)
        if (indiceLinha >= 0) {
          setErroFonteLinha({ [indiceLinha]: mensagem })
        } else if (mapaFontes.get(fonteSimples)?.nome === nomeFonte) {
          setErroFonte(mensagem)
        }
        return
      }
    }

    const mensagensFixas: Record<string, string> = {
      SPLIT_SOMA_DIVERGENTE: 'O rateio não fecha com o valor total. Confira os valores.',
      SPLIT_VAZIO: 'Escolha ao menos uma fonte para esta saída.',
      CATEGORIA_INVALIDA: 'Esse registro não existe mais. Recarregue a página.',
      FONTE_INVALIDA: 'Esse registro não existe mais. Recarregue a página.',
    }

    setErroGeral(mensagensFixas[erro.codigo] ?? mensagemDoErro(erro))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErroGeral(null)
    setErroFonteLinha({})

    const tituloAparado = titulo.trim()
    let temErro = false

    if (tituloAparado.length < 1 || tituloAparado.length > 60) {
      setErroTitulo('Título deve ter entre 1 e 60 caracteres.')
      temErro = true
    } else {
      setErroTitulo(null)
    }

    if (valorCentavos <= 0) {
      setErroValor('Valor deve ser maior que zero.')
      temErro = true
    } else {
      setErroValor(null)
    }

    if (!categoriaId) {
      setErroCategoria('Selecione uma categoria.')
      temErro = true
    } else {
      setErroCategoria(null)
    }

    if (!data) {
      setErroData('Selecione uma data.')
      temErro = true
    } else {
      setErroData(null)
    }

    if (recorrente && (diaRecorrencia < 1 || diaRecorrencia > 31)) {
      setErroDia('Dia deve estar entre 1 e 31.')
      temErro = true
    } else {
      setErroDia(null)
    }

    let splitsFinais: LinhaSplit[]

    if (modoSplit) {
      if (splits.some((l) => !l.fonteId)) {
        setErroGeral('Selecione uma fonte para cada linha do rateio.')
        temErro = true
      }
      if (splits.some((l) => l.valorCentavos <= 0)) {
        setErroGeral('Cada divisão precisa ter um valor maior que zero.')
        temErro = true
      }
      const fonteIds = splits.map((l) => l.fonteId).filter(Boolean)
      if (new Set(fonteIds).size !== fonteIds.length) {
        setErroGeral('Cada fonte só pode aparecer uma vez no rateio.')
        temErro = true
      }
      if (diffSplits !== 0) {
        setErroGeral('O rateio não fecha com o valor total. Confira os valores.')
        temErro = true
      }
      splitsFinais = splits
    } else {
      if (!fonteSimples) {
        setErroFonte('Selecione uma fonte.')
        temErro = true
      } else {
        setErroFonte(null)
      }
      splitsFinais = [{ fonteId: fonteSimples, valorCentavos }]
    }

    if (categoriaId && !temErro) {
      for (const linha of splitsFinais) {
        const fonte = mapaFontes.get(linha.fonteId)
        if (!fonte) continue
        const resultado = avaliarFonte(fonte, categoriaId, categorias, linha.valorCentavos)
        if (!resultado.elegivel) {
          setErroGeral(`${fonte.nome} ${resultado.motivo}.`)
          temErro = true
        }
      }
    }

    if (temErro) return

    setEnviando(true)

    const dados = {
      titulo: tituloAparado,
      valorTotalCentavos: valorCentavos,
      categoriaId,
      data,
      recorrente,
      diaRecorrencia: recorrente ? diaRecorrencia : null,
      splits: splitsFinais,
    }

    try {
      if (saida) {
        await atualizarSaida(saida.id, {
          ...dados,
          recorrenciaAtiva: saida.recorrenciaAtiva,
          templateId: saida.templateId,
        })
        showToast('Saída atualizada.', 'success')
      } else {
        await criarSaida({ ...dados, recorrenciaAtiva: recorrente, templateId: null })
        showToast('Saída registrada.', 'success')
      }
      onSalvo()
      onFechar()
    } catch (e) {
      aplicarErroServidor(e as ApiError)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title={saida ? 'Editar saída' : 'Nova saída'}
      size={modoSplit ? 'xl' : 'md'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          ref={tituloRef}
          label="Título"
          value={titulo}
          onChange={(event) => setTitulo(event.target.value)}
          error={erroTitulo ?? undefined}
          maxLength={60}
          required
        />

        <MoneyInput
          label="Valor total"
          value={valorCentavos}
          onChange={setValorCentavos}
          error={erroValor ?? undefined}
        />

        <div className="flex flex-col gap-1">
          <Select
            label="Categoria"
            value={categoriaId}
            onChange={(event) => setCategoriaId(event.target.value)}
            error={erroCategoria ?? undefined}
          >
            <option value="">Selecione</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </Select>
          {avisoEstouro && <p className="text-xs text-aviso">{avisoEstouro}</p>}
        </div>

        {!modoSplit && (
          <div className="flex flex-col gap-1">
            <Select
              label="Fonte"
              value={fonteSimples}
              onChange={(event) => setFonteSimples(event.target.value)}
              error={erroFonte ?? undefined}
              disabled={!categoriaId}
            >
              <option value="">Selecione</option>
              {opcoesFonte(valorCentavos, []).map(({ fonte, elegivel, motivo }) => (
                <option key={fonte.id} value={fonte.id} disabled={!elegivel}>
                  {opcaoLabel(fonte, motivo)}
                </option>
              ))}
            </Select>
            {!categoriaId && (
              <span className="text-xs text-ink-soft">Selecione uma categoria primeiro.</span>
            )}
            <Button type="button" variant="ghost" className="self-start" onClick={ativarModoSplit}>
              Dividir entre fontes
            </Button>
          </div>
        )}

        {modoSplit && (
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-ink">
              Valor total: {formatBRL(valorCentavos)}
            </span>

            {splits.map((linha, indice) => {
              const outrasFontes = splits.filter((_, i) => i !== indice).map((l) => l.fonteId)
              const opcoes = opcoesFonte(linha.valorCentavos, outrasFontes)
              const fonteSelecionada = mapaFontes.get(linha.fonteId)

              return (
                <div key={indice} className="flex flex-col gap-1 rounded border border-line p-3 sm:flex-row sm:items-start sm:gap-2">
                  <div className="flex-1">
                    <Select
                      label={`Fonte ${indice + 1}`}
                      value={linha.fonteId}
                      onChange={(event) => atualizarLinha(indice, 'fonteId', event.target.value)}
                      error={erroFonteLinha[indice]}
                    >
                      <option value="">Selecione</option>
                      {opcoes.map(({ fonte, elegivel, motivo }) => (
                        <option key={fonte.id} value={fonte.id} disabled={!elegivel}>
                          {opcaoLabel(fonte, motivo)}
                        </option>
                      ))}
                    </Select>
                    {fonteSelecionada && (
                      <span className="text-xs text-ink-soft">
                        {formatBRL(fonteSelecionada.saldoCentavos)} disponíveis
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-2">
                    <MoneyInput
                      label="Valor"
                      value={linha.valorCentavos}
                      onChange={(centavos) => atualizarLinha(indice, 'valorCentavos', centavos)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label="Remover fonte"
                      disabled={splits.length <= 1}
                      onClick={() => removerLinha(indice)}
                    >
                      🗑
                    </Button>
                  </div>
                </div>
              )
            })}

            <Button type="button" variant="ghost" className="self-start" onClick={adicionarLinha}>
              + Adicionar fonte
            </Button>

            <div className="border-t border-line pt-2 text-sm">
              {diffSplits > 0 && (
                <span className="text-ink-soft">Faltam {formatBRL(diffSplits)}</span>
              )}
              {diffSplits === 0 && (
                <span className="text-livre">
                  Rateado: {formatBRL(somaSplits)} de {formatBRL(valorCentavos)} ✓
                </span>
              )}
              {diffSplits < 0 && (
                <span className="text-alerta">Excedeu em {formatBRL(-diffSplits)}</span>
              )}
            </div>

            {splits.length === 1 && (
              <Button type="button" variant="ghost" className="self-start" onClick={voltarModoSimples}>
                Voltar ao modo simples
              </Button>
            )}
          </div>
        )}

        <Input
          label="Data"
          type="date"
          value={data}
          onChange={(event) => setData(event.target.value)}
          error={erroData ?? undefined}
          required
        />

        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={recorrente}
            onChange={(event) => setRecorrente(event.target.checked)}
          />
          Recorrente
        </label>

        {recorrente && (
          <div className="animate-expandir flex flex-col gap-1">
            <label className="text-sm font-medium text-ink" htmlFor="dia-recorrencia-saida">
              Dia da recorrência
            </label>
            <input
              id="dia-recorrencia-saida"
              type="number"
              min={1}
              max={31}
              value={diaRecorrencia}
              onChange={(event) => setDiaRecorrencia(Number(event.target.value))}
              className={`rounded border px-3 py-2 text-base text-ink outline-none focus:ring-2 focus:ring-livre ${
                erroDia ? 'border-alerta' : 'border-line'
              }`}
            />
            {erroDia && <span className="text-xs text-alerta">{erroDia}</span>}
            {!erroDia && diaRecorrencia > 28 && (
              <span className="text-xs text-ink-soft">
                Em meses mais curtos, será sugerido o último dia do mês.
              </span>
            )}
          </div>
        )}

        {ehTemplate && (
          <p className="text-xs text-ink-soft">
            As alterações valem para os próximos lançamentos. Lançamentos já feitos não mudam.
          </p>
        )}

        {erroGeral && <p className="text-sm text-alerta">{erroGeral}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={enviando}
            disabled={enviando || (modoSplit && diffSplits !== 0)}
          >
            Salvar saída
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default SaidaFormModal
