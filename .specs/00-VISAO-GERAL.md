# Lugom Financial Manager — Visão Geral

> **Como usar este documento:** leia este arquivo primeiro e mantenha ele aberto como
> contexto permanente. Cada milestone tem seu próprio arquivo de spec. Trabalhe uma
> spec por vez, do início ao fim, e só passe para a próxima quando os critérios de
> aceite estiverem 100% atendidos.

---

## 1. O que é

Um gerenciador financeiro pessoal, de usuário único, baseado no conceito de
**orçamento por envelope** (envelope budgeting). O diferencial em relação a um app
de finanças comum é que **dinheiro não é fungível aqui**: R$ 500 de vale-refeição
não podem pagar um Uber, mesmo que o saldo total da conta cubra o valor.

## 2. O problema central que o sistema resolve

O usuário recebe dinheiro de origens com regras diferentes:

| Origem | Pode pagar o quê |
|---|---|
| Salário (conta corrente) | qualquer coisa |
| VR Flash | só alimentação / supermercado |
| Freelance avulso | qualquer coisa |

Um app tradicional somaria tudo num "saldo total" e permitiria gastar VR com Uber.
Aqui não. A modelagem separa **de onde o dinheiro veio** (Fonte) de **no que ele foi
gasto** (Categoria), e valida as duas dimensões em toda saída.

## 3. Conceitos do domínio (glossário)

Este vocabulário é obrigatório em código, banco e UI. Não invente sinônimos.

- **Fonte** — o "envelope"/carteira de onde o dinheiro sai. Ex: `Conta Corrente`,
  `VR Flash`, `Carteira`. Tem um saldo que acumula indefinidamente.
  - `tipo = 'livre'` → aceita saída de qualquer categoria.
  - `tipo = 'restrita'` → só aceita saídas de categorias explicitamente permitidas.
- **Entrada** — um lançamento de dinheiro *entrando* numa Fonte. Ex: "Salário
  Outubro, R$ 5.000, na fonte Conta Corrente". Pode ser recorrente.
- **Saída** — um lançamento de dinheiro *saindo*. Tem uma Categoria e é rateada
  entre uma ou mais Fontes (split). Pode ser recorrente.
- **Split** — a parcela de uma Saída atribuída a uma Fonte específica. A soma dos
  splits sempre é igual ao valor total da Saída.
- **Categoria** — a natureza do gasto. Ex: `Transporte`, `Alimentação`, `Moradia`.
  Tem um limite mensal opcional que acumula.
- **Conta** — não é uma entidade separada. "Conta" (gasto fixo mensal, ex: aluguel,
  internet) é apenas uma **Saída com `recorrente = true`**. A UI pode chamar de
  "Conta fixa", mas o banco tem uma única tabela `saidas`.

### Por que "Fonte" e não "Entrada" como origem da Saída

Na conversa original o requisito foi "uma saída sai de uma entrada". Se a Saída
apontasse para um *lançamento* de entrada específico, o requisito de **acumular
saldo entre meses** viraria um pesadelo: gastar R$ 520 de VR em novembro exigiria
ratear entre o lançamento de outubro (R$ 50 que sobraram) e o de novembro (R$ 500).

Apontando o split para a **Fonte**, o acúmulo é automático e o caso de uso descrito
continua funcionando idêntico:

> "Cadastrei meu salário → subiu R$ 1.000 na fonte Conta Corrente. Cadastrei uma
> saída de R$ 100 (Uber) saindo da Conta Corrente → sobrou R$ 900."

## 4. Regras de negócio (imutáveis)

**RN-01** — Toda Saída deve ter pelo menos um split, e `Σ splits = valor_total`.
Tolerância de arredondamento: R$ 0,00 (usar inteiros de centavos, ver RN-10).

**RN-02** — Uma Saída **nunca** pode deixar o saldo de uma Fonte negativo. Se algum
split exceder o saldo disponível da sua Fonte, a operação inteira é **bloqueada** e
nada é gravado.

**RN-03** — Se a Fonte é `restrita`, a Categoria da Saída precisa estar na lista de
categorias permitidas daquela Fonte. Senão, bloqueia. *(É esta regra que impede o
Uber de sair do VR.)*

**RN-04** — Saldo de Fonte acumula indefinidamente:
`saldo = Σ entradas da fonte − Σ splits da fonte`. Não existe "fechamento de mês".

**RN-05** — Limite de Categoria também acumula:
`limite_acumulado = limite_mensal × meses_ativos`, onde `meses_ativos` é a contagem
de meses (inclusiva) entre `vigencia_inicio` e o mês corrente.
`saldo_categoria = limite_acumulado − Σ saídas da categoria`.

**RN-06** — Estourar o limite de uma Categoria **não bloqueia** a saída. Gera apenas
um aviso visual (saldo negativo em vermelho). Só a RN-02 e a RN-03 bloqueiam.

**RN-07** — Ao gravar uma Saída com sucesso, o sistema devolve e exibe:
1. o saldo restante de **cada Fonte** envolvida no split;
2. o saldo restante da **Categoria** da saída.

**RN-08** — Recorrência é **assistida, nunca automática**. Um lançamento marcado como
recorrente vira um *template*. Todo mês o sistema lista os templates que ainda não
foram lançados no mês corrente e o usuário confirma um a um (podendo editar o valor).

**RN-09** — Saldo nunca é armazenado. É sempre derivado por view SQL a partir dos
lançamentos. Isso elimina dessincronização.

**RN-10** — Todo valor monetário é armazenado como `BIGINT` em **centavos**.
Nunca `float`. A conversão para reais acontece só na borda da UI.

**RN-11** — Todo dado é escopo do usuário logado. RLS obrigatório em todas as tabelas.

## 5. Stack

| Camada | Escolha | Observação |
|---|---|---|
| Build | Vite | SPA, sem SSR |
| UI | React 19 | |
| Estilo | Tailwind CSS v4 | |
| Rotas | **React Router v7** | ~12M downloads/semana, contra 1.2M do TanStack Router. Modo `declarative` (SPA), sem framework mode |
| HTTP | axios | consome a REST API do Supabase (PostgREST) |
| Auth | `@supabase/supabase-js` | **só** para autenticação/sessão/refresh token |
| Backend | Supabase (Postgres + PostgREST + Auth + RLS) | |
| Deploy | Vercel | |

### Sobre axios + Supabase

O requisito é usar axios, então **todos os dados** passam por axios direto no
PostgREST (`/rest/v1/...`), com o JWT da sessão no header. O `supabase-js` entra
apenas para gerenciar login, sessão e refresh de token — reimplementar refresh token
à mão é fonte garantida de bug e não agrega nada ao projeto. Essa é a única
responsabilidade dele.

## 6. Modelo de dados (resumo)

```
auth.users (Supabase)
   │
   ├── fontes ──────────────┐
   │     id, user_id, nome, tipo, cor, arquivada
   │                        │
   │                  fonte_categorias  (N:N, só p/ fontes restritas)
   │                        │
   ├── categorias ──────────┘
   │     id, user_id, nome, limite_mensal_centavos, vigencia_inicio, cor, arquivada
   │
   ├── entradas
   │     id, user_id, fonte_id, titulo, valor_centavos, data,
   │     recorrente, dia_recorrencia, recorrencia_ativa, template_id
   │
   └── saidas
         id, user_id, categoria_id, titulo, valor_total_centavos, data,
         recorrente, dia_recorrencia, recorrencia_ativa, template_id
            │
            └── saida_splits
                  id, saida_id, fonte_id, valor_centavos
```

**Views:** `v_saldo_fontes`, `v_saldo_categorias`, `v_resumo_geral`,
`v_recorrencias_pendentes`.

**RPC:** `criar_saida(...)` — grava saída + splits numa transação, aplicando RN-02,
RN-03 e RN-07.

## 7. Roadmap de milestones

Cada linha é um arquivo de spec. Ordem obrigatória — cada milestone assume que o
anterior está pronto e funcionando.

| # | Spec | Entrega |
|---|---|---|
| M1 | `01-setup-fundacao.md` | Projeto Vite+React+Tailwind+Router+axios rodando, design tokens, deploy na Vercel |
| M2 | `02-supabase-schema.md` | Banco completo: tabelas, views, RPC, RLS, seed |
| M3 | `03-auth.md` | Login, sessão persistida, rotas protegidas |
| M4 | `04-camada-dados.md` | Cliente axios, interceptors, camada de serviços tipada |
| M5 | `05-categorias.md` | CRUD de Categorias com limite mensal |
| M6 | `06-fontes.md` | CRUD de Fontes, incluindo fontes restritas e suas categorias |
| M7 | `07-entradas.md` | CRUD de Entradas |
| M8 | `08-saidas.md` | Saída com split multi-fonte + validação bloqueante (o coração do sistema) |
| M9 | `09-notificacoes-saldo.md` | Feedback de saldo pós-lançamento (RN-07) |
| M10 | `10-dashboard.md` | Tela inicial: saldo geral, por fonte, por categoria |
| M11 | `11-recorrencias.md` | Painel de pendências do mês e confirmação manual |

**Ordem de dependência:** Categorias antes de Fontes (fonte restrita referencia
categorias). Fontes antes de Entradas. Entradas antes de Saídas (precisa ter saldo
para testar o bloqueio).

## 8. Convenções de código

- **Idioma:** domínio em português (`fontes`, `saidas`, `valorCentavos`), termos
  técnicos em inglês (`useState`, `handleSubmit`, `isLoading`).
- **Banco:** `snake_case`. **Frontend:** `camelCase`. A camada de serviço (M4) faz a
  tradução — nenhum componente React toca em `snake_case`.
- **Dinheiro no frontend:** sempre `number` em centavos. Formatação só via helper
  `formatBRL(centavos)`. Parsing de input só via `parseBRL(string): number`.
- **Datas:** `YYYY-MM-DD` (string) no banco e no transporte. Nunca `Date` serializado.
- **Componentes:** função nomeada + export default no fim do arquivo.
- **Sem TypeScript no MVP?** Não — **use TypeScript**. Com vibe coding, os tipos são
  a rede de segurança que evita o agente inventar campo que não existe.
- **Sem biblioteca de state global.** React Router loaders + `useState` local +
  um `AuthContext`. Se precisar de cache, `TanStack Query` fica para pós-MVP.

## 9. Estrutura de pastas alvo

```
src/
  main.tsx
  App.tsx
  routes.tsx
  lib/
    supabase.ts        # cliente supabase-js (só auth)
    api.ts             # instância axios + interceptors
    money.ts           # formatBRL / parseBRL
    date.ts            # helpers de mês/competência
  contexts/
    AuthContext.tsx
  services/
    categorias.ts
    fontes.ts
    entradas.ts
    saidas.ts
    resumo.ts
    recorrencias.ts
  types/
    domain.ts          # tipos do domínio
    api.ts             # tipos crus do PostgREST (snake_case)
  components/
    ui/                # Button, Input, Select, Modal, Toast, Money, EmptyState
    layout/            # AppShell, Sidebar, PageHeader
  features/
    categorias/
    fontes/
    entradas/
    saidas/
    dashboard/
    recorrencias/
  pages/
    LoginPage.tsx
    DashboardPage.tsx
    ...
```

## 10. Fora do escopo do MVP

Anote e não implemente: gráficos, relatórios históricos, exportação CSV, multi-usuário,
transferência entre fontes, metas de economia, anexo de comprovante, importação de
extrato bancário, app mobile, PWA offline, parcelamento de compras, moeda estrangeira.
