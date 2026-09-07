# M4 — Camada de Dados (supabase-js)

**Objetivo:** uma camada de serviços tipada que isola completamente o resto do app do
formato do Supabase. Nenhum componente React vai conhecer `snake_case`, o client do
`supabase-js` ou o formato de erro do Postgres.

**Pré-requisitos:** M1, M2 e M3 concluídos.

---

## Escopo

**Dentro:** normalização de erro sobre o cliente `supabase-js` já existente (M3),
tipos do domínio, mappers, funções de serviço para todas as entidades, hook genérico
de fetch.

**Fora:** UI, telas, formulários.

---

## Como o cliente acessa o Postgres (referência rápida)

Não existe camada HTTP própria — `supabase-js` já fala PostgREST/RPC por baixo,
injeta `apikey` e o `access_token` da sessão atual (com refresh automático) em toda
chamada. A API é sempre `{ data, error, status }`, nunca lança exceção sozinha:

| Operação | Chamada |
|---|---|
| Listar | `supabase.from('fontes').select('*').order('nome')` |
| Filtrar | `supabase.from('saidas').select('*').gte('data', ini).lte('data', fim)` |
| Inserir | `supabase.from('entradas').insert(dados).select().single()` |
| Atualizar | `supabase.from('entradas').update(dados).eq('id', id).select().single()` |
| Excluir | `supabase.from('entradas').delete().eq('id', id)` |
| RPC | `supabase.rpc('criar_saida', { p_titulo: ..., p_splits: ... })` |
| Embed | `supabase.from('saidas').select('*, saida_splits(*), categorias(nome)')` |

`.select()` depois de `insert`/`update` é o equivalente ao antigo
`Prefer: return=representation` — sem ele o retorno vem vazio.

---

## Tarefas

### 4.1 Normalização de erro

Todo `{ data, error }` do `supabase-js` passa por um helper único antes de chegar nos
serviços — sem isso cada `services/*.ts` reimplementaria o parsing de erro na mão.

`src/lib/erros.ts`:

```ts
export type ApiError = {
  codigo: string        // 'SALDO_INSUFICIENTE' | 'NETWORK' | 'UNAUTHORIZED' | 'UNKNOWN' ...
  mensagem: string      // já pronta para exibir ao usuário
  detalhe?: string      // texto cru, só para log
  status?: number
}

export function unwrap<T>(resultado: { data: T | null; error: PostgrestError | null; status?: number }): T
export function mensagemDoErro(e: unknown): string
```

`unwrap` lança um `ApiError` (via `throw`) quando `error` não é nulo; senão devolve
`data`. Todo serviço em 4.4 chama `unwrap(await supabase.from(...)...)`.

Regras de normalização (aplicadas dentro de `unwrap`):

- **401 / 403**, ou código Postgres `PGRST301`/JWT expirado → `codigo: 'UNAUTHORIZED'`,
  dispara `supabase.auth.signOut()` e mensagem "Sua sessão expirou. Entre novamente."
- **Erro de rede** (`error.message` contém `Failed to fetch` ou é uma
  `TypeError`/`AuthRetryableFetchError`) → `codigo: 'NETWORK'`, "Não foi possível
  conectar. Verifique sua internet."
- **Erro do RPC** (`criar_saida` e afins): a mensagem vem como
  `"CODIGO: detalhe"` (ver M2). Extrair o prefixo antes do `:` — se bater com um dos
  códigos conhecidos do M2, usar como `codigo`. Senão `UNKNOWN`.
- **Código Postgres `23505`** (violação de unique) → `codigo: 'DUPLICADO'`, "Já existe
  um registro com esse nome."
- Qualquer outro → `UNKNOWN`, "Algo deu errado. Tente novamente."

Criar também um mapa `codigo → mensagem` e a função `mensagemDoErro(e: unknown): string`
usada pela UI, assim as mensagens ficam num lugar só e não espalhadas por componentes.

**Nunca** exponha `detalhe` na UI. Ele vai só para `console.error` em dev.

### 4.2 Tipos

`src/types/api.ts` — o formato **cru** do PostgREST, em `snake_case`. Espelha
exatamente o schema do M2.

`src/types/domain.ts` — o formato usado no app, em `camelCase`:

```ts
export type FonteTipo = 'livre' | 'restrita'

export type Fonte = {
  id: string
  nome: string
  tipo: FonteTipo
  cor: string
  arquivada: boolean
  categoriasPermitidas?: string[]   // ids, só quando tipo === 'restrita'
}

export type SaldoFonte = Fonte & {
  totalEntradasCentavos: number
  totalSaidasCentavos: number
  saldoCentavos: number
}

export type Categoria = {
  id: string
  nome: string
  limiteMensalCentavos: number | null
  vigenciaInicio: string
  cor: string
  arquivada: boolean
}

export type SaldoCategoria = Categoria & {
  mesesAtivos: number | null
  limiteAcumuladoCentavos: number | null
  totalGastoCentavos: number
  gastoMesAtualCentavos: number
  saldoDisponivelCentavos: number | null
}

export type Entrada = {
  id: string
  fonteId: string
  titulo: string
  valorCentavos: number
  data: string
  recorrente: boolean
  diaRecorrencia: number | null
  recorrenciaAtiva: boolean
  templateId: string | null
}

export type SaidaSplit = {
  fonteId: string
  valorCentavos: number
}

export type Saida = {
  id: string
  categoriaId: string
  titulo: string
  valorTotalCentavos: number
  data: string
  recorrente: boolean
  diaRecorrencia: number | null
  recorrenciaAtiva: boolean
  templateId: string | null
  splits: SaidaSplit[]
}

export type ResumoGeral = {
  saldoTotalCentavos: number
  saldoLivreCentavos: number
  saldoRestritoCentavos: number
}

export type ResultadoCriarSaida = {
  saidaId: string
  fontes: { fonteId: string; nome: string; tipo: FonteTipo; saldoCentavos: number }[]
  categoria: {
    categoriaId: string
    nome: string
    limiteMensalCentavos: number | null
    saldoDisponivelCentavos: number | null
    gastoMesAtualCentavos: number
  } | null
}
```

### 4.3 Mappers

`src/services/mappers.ts` — funções puras `paraFonte(raw)`, `paraSaida(raw)`, etc.,
e as inversas `deSaida(dominio)` para envio. Escrever teste unitário de pelo menos
`paraSaida` (a que tem estrutura aninhada).

Regra: **a tradução acontece exatamente uma vez, aqui**. Se um componente precisar
tocar em `valor_total_centavos`, o mapper está incompleto.

### 4.4 Serviços

Um arquivo por entidade em `src/services/`. Assinaturas:

```ts
// categorias.ts
listarCategorias(opts?: { incluirArquivadas?: boolean }): Promise<Categoria[]>
criarCategoria(dados: Omit<Categoria,'id'|'arquivada'>): Promise<Categoria>
atualizarCategoria(id: string, dados: Partial<Categoria>): Promise<Categoria>
arquivarCategoria(id: string): Promise<void>
listarSaldosCategorias(): Promise<SaldoCategoria[]>

// fontes.ts
listarFontes(opts?): Promise<Fonte[]>
criarFonte(dados, categoriasPermitidas: string[]): Promise<Fonte>
atualizarFonte(id, dados, categoriasPermitidas?): Promise<Fonte>
arquivarFonte(id): Promise<void>
listarSaldosFontes(): Promise<SaldoFonte[]>

// entradas.ts
listarEntradas(filtro?: { mes?: string; fonteId?: string }): Promise<Entrada[]>
criarEntrada(dados): Promise<Entrada>
atualizarEntrada(id, dados): Promise<Entrada>
excluirEntrada(id): Promise<void>

// saidas.ts
listarSaidas(filtro?: { mes?: string; categoriaId?: string; fonteId?: string }): Promise<Saida[]>
criarSaida(dados): Promise<ResultadoCriarSaida>   // via RPC
atualizarSaida(id, dados): Promise<ResultadoCriarSaida>
excluirSaida(id): Promise<void>

// resumo.ts
obterResumoGeral(): Promise<ResumoGeral>

// recorrencias.ts
listarPendentes(): Promise<RecorrenciaPendente[]>
confirmarEntradaRecorrente(templateId, valorCentavos, data): Promise<Entrada>
confirmarSaidaRecorrente(templateId, valorCentavos, data, splits): Promise<ResultadoCriarSaida>
```

Detalhes de implementação:

- `criarFonte` com categorias permitidas: dois requests (insert em `fontes`, depois
  insert em `fonte_categorias`). Como não há transação via REST, se o segundo falhar,
  **desfazer** o primeiro com um DELETE. Registrar isso como limitação conhecida.
- `listarSaidas` usa embed: `select=*,saida_splits(fonte_id,valor_centavos)`
- Filtro por mês: `data=gte.<primeiroDia>&data=lte.<ultimoDia>` usando os helpers de
  `lib/date.ts`
- `arquivar*` é `PATCH` com `arquivada: true`. **Não use DELETE** em categorias e
  fontes — há FKs `on delete restrict` e apagar reescreveria o histórico.

### 4.5 Hook de fetch

`src/hooks/useAsync.ts` — genérico, sem lib externa:

```ts
function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): {
  data: T | undefined
  isLoading: boolean
  erro: ApiError | null
  recarregar(): void
}
```

Cuidado: cancelar/ignorar o resultado se o componente desmontar ou se as deps
mudarem antes da resposta chegar (flag `cancelado` no cleanup). Sem isso, dá warning
e race condition ao trocar de mês rápido.

---

## Critérios de aceite

- [ ] Uma chamada real a `listarSaldosFontes()` autenticado retorna os dados do seed
      já em `camelCase`
- [ ] Nenhuma chamada funciona sem sessão (retorna `UNAUTHORIZED`)
- [ ] Forçar erro no RPC (`SALDO_INSUFICIENTE`) e confirmar que `ApiError.codigo`
      vem exatamente `'SALDO_INSUFICIENTE'`
- [ ] Desligar a internet e confirmar `codigo: 'NETWORK'` com mensagem amigável
- [ ] Buscar nas fontes do projeto por `_centavos` e `snake_case` — só pode aparecer
      em `types/api.ts` e `services/`
- [ ] Teste unitário de `paraSaida` passando
- [ ] `useAsync` não dispara warning de setState em componente desmontado

## Definition of Done

Uma página de debug temporária (`/debug`, removida depois) que lista fontes,
categorias e saldos usando os serviços — prova de que a camada inteira funciona
ponta a ponta.
