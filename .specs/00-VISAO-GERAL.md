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
  Outubro, R$ 5.000, na fonte Conta Corrente".
- **Saída** — um lançamento de dinheiro *saindo*. Tem uma Categoria e é rateada
  entre uma ou mais Fontes (split).
- **Split** — a parcela de uma Saída atribuída a uma Fonte específica. A soma dos
  splits sempre é igual ao valor total da Saída.
- **Categoria** — a natureza do gasto. Ex: `Transporte`, `Alimentação`, `Moradia`.
  Tem um limite mensal opcional que acumula.
- **Importada** (M20) — uma transação que veio da Pluggy (Open Finance) e espera revisão na
  caixa de entrada (`transacoes_importadas`). Só vira Entrada ou Saída quando o usuário
  confirma (escolhendo a Categoria, se for saída). Também pode ser ignorada.
- **Conexão** (M20) — um *item* da Pluggy (um banco conectado no Meu Pluggy). Cada conta do
  item é vinculada a uma Fonte (`fontes.pluggy_account_id`, `origem = 'pluggy'`); Fontes sem
  vínculo (ex.: VR Flash) são `origem = 'manual'`.
- **Recorrência** (M19) — uma conta a pagar acompanhada mês a mês (internet, plano
  de saúde, parcelas), com valor previsto e dia de vencimento. **Não é um
  lançamento e nunca afeta saldo**: é um checklist de "paga / não paga" por
  competência (`recorrencias` + `recorrencias_pagamentos`). Um pagamento pode
  apontar para a Saída real que o quitou (`saida_id`), mas não precisa. Só existem
  recorrências de saída. (Até o M18, recorrência era uma Entrada/Saída com
  `recorrente = true` que gerava lançamentos — modelo removido no M19.)
- **Cartão de crédito** (M13) — uma Fonte com `eh_cartao = true`, sem saldo
  disponível: tem `limite_centavos` e `dia_fatura`. Seu saldo é sempre `≤ 0` e
  representa a dívida atual. No dia da fatura, uma pendência assistida (como as de
  M10) permite pagar a dívida a partir de uma fonte real.
- **Lançamento futuro** (M14) — uma Entrada ou Saída com `data` no futuro. Fica
  visível no sistema desde já, mas só passa a contar no saldo quando a data chega
  — não é um status, é um filtro de data nas views de saldo.

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
nada é gravado. *(Exceção: Fontes do tipo cartão de crédito — ver RN-12, M13 — onde
saldo negativo é o estado normal e o bloqueio é por limite, não por saldo.)*

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

**RN-08** (reescrita no M19) — Recorrência é **acompanhamento, nunca lançamento**.
Para cada competência em que está vigente (`mes_inicio` ≤ mês, dentro de
`total_parcelas`, `ativa`), a recorrência aparece como **Paga** (tem registro em
`recorrencias_pagamentos`), **Atrasada** (sem pagamento e hoje passou do dia de
vencimento resolvido no mês) ou **Pendente**. Marcar como paga não cria Saída
nem mexe em saldo.

**RN-15** (M20) — Nada que vem da Pluggy vira lançamento sem confirmação do usuário. Cada
conta vinculada tem uma **data de corte** (o dia do vínculo, quando o saldo inicial é
lançado); só transações com data posterior são importadas. Confirmar uma Saída importada
passa pela `criar_saida` (RN-02/RN-03 continuam valendo).

**RN-09** — Saldo nunca é armazenado. É sempre derivado por view SQL a partir dos
lançamentos. Isso elimina dessincronização.

**RN-10** — Todo valor monetário é armazenado como `BIGINT` em **centavos**.
Nunca `float`. A conversão para reais acontece só na borda da UI.

**RN-11** — Todo dado é escopo do usuário logado. RLS obrigatório em todas as tabelas.

**RN-12** (M13) — Uma Fonte pode ser um cartão de crédito (`eh_cartao = true`), com
`limite_centavos` e `dia_fatura` obrigatórios. Saldo de cartão é sempre `≤ 0`
(dívida). Bloqueia se `dívida_atual + valor_do_split > limite_centavos`.

**RN-13** (M13) — Com dívida em aberto e `dia_fatura` do mês já passado, uma
pendência de fatura (`v_faturas_pendentes`) aparece em Recorrências. Confirmar gera, atomicamente,
uma Entrada no cartão (reduz a dívida) e uma Saída normal (categoria "Fatura de
cartão") saindo da fonte pagadora escolhida — sujeita à RN-02/RN-03 dessa fonte.

**RN-14** (M14) — Uma Entrada ou Saída com `data` no futuro é um **lançamento
futuro**: não conta em `v_saldo_fontes`, `v_saldo_categorias` nem
`v_resumo_geral` enquanto `data > hoje`. Ao chegar o dia, passa a contar
sozinha, sem ação do usuário nem job agendado — é sempre a mesma consulta,
só que a comparação de data já muda de resultado.

## 5. Stack

| Camada | Escolha | Observação |
|---|---|---|
| Build | Vite | SPA, sem SSR |
| UI | React 19 | |
| Estilo | Tailwind CSS v4 | |
| Rotas | **React Router v7** | ~12M downloads/semana, contra 1.2M do TanStack Router. Modo `declarative` (SPA), sem framework mode |
| Dados | `@supabase/postgrest-js` | só o cliente PostgREST (`.from()`/`.rpc()`), em `src/lib/api.ts` (M17) |
| Auth | `src/lib/auth.ts` + RPC `login` | JWT HS256 emitido pelo próprio banco, sessão no `localStorage` (M17) |
| Backend | Postgres + PostgREST + RLS, local | sem Supabase desde o M17 (`db/migrations/00000_auth_local.sql`) |
| Deploy | Kubernetes do homelab | `deploy/k8s/`, porta 10070 (M17) |

### Sobre o cliente de dados

> **M17:** o Supabase saiu. O texto abaixo descreve a decisão original; hoje o cliente é
> o `PostgrestClient` de `src/lib/api.ts` e a sessão vive em `src/lib/auth.ts`. A regra
> continua: componentes não importam o cliente, só `lib/`, `AuthContext` e `services/`.

#### Decisão original (até o M16)

Só nos importamos com Supabase, então não faz sentido carregar uma lib HTTP à parte
para reimplementar o que o `supabase-js` já resolve — ele já injeta o JWT da sessão e
a `apikey` em toda chamada, e dispara refresh de token sozinho. Um único cliente
(`src/lib/supabase.ts`) serve autenticação **e** dados: componentes React nunca o
importam diretamente — só a camada de serviços (`src/services/*.ts`) e o
`AuthContext`.

## 6. Modelo de dados (resumo)

```
auth.users (local, M17)
   │
   ├── fontes ──────────────┐
   │     id, user_id, nome, tipo, cor, arquivada,
   │     eh_cartao, limite_centavos, dia_fatura (M13)
   │                        │
   │                  fonte_categorias  (N:N, só p/ fontes restritas)
   │                        │
   ├── categorias ──────────┘
   │     id, user_id, nome, limite_mensal_centavos, vigencia_inicio, cor, arquivada
   │
   ├── entradas
   │     id, user_id, fonte_id, titulo, valor_centavos, data, eh_pagamento_fatura
   │
   ├── saidas
   │     id, user_id, categoria_id, titulo, valor_total_centavos, data, eh_pagamento_fatura
   │        │
   │        └── saida_splits
   │              id, saida_id, fonte_id, valor_centavos
   │
   └── recorrencias (M19 — fora de qualquer saldo)
         id, user_id, titulo, valor_previsto_centavos, dia, categoria_id,
         mes_inicio, total_parcelas, ativa
            │
            └── recorrencias_pagamentos
                  id, recorrencia_id, competencia, pago_em, saida_id (opcional)
```

**Views:** `v_saldo_fontes`, `v_saldo_categorias`, `v_resumo_geral`,
`v_recorrencias_mes` (M19), `v_faturas_pendentes` (M13/M19), `v_importadas_pendentes`,
`v_sugestoes_recorrencia`, `v_status_integracao` (M20). Tabelas do M20: `pluggy_itens`,
`pluggy_contas`, `transacoes_importadas`, `sincronizacoes`.

**RPC:** `criar_saida(...)` — grava saída + splits numa transação, aplicando RN-02,
RN-03 e RN-07.

## 7. Roadmap de milestones

Cada linha é um arquivo de spec. Ordem obrigatória — cada milestone assume que o
anterior está pronto e funcionando.

| # | Spec | Entrega |
|---|---|---|
| M1 | `01-setup-fundacao.md` | Projeto Vite+React+Tailwind+Router rodando, design tokens, deploy na Vercel |
| M2 | `02-supabase-schema.md` | Banco completo: tabelas, views, RPC, RLS, seed |
| M3 | `03-auth.md` | Login, sessão persistida, rotas protegidas |
| M4 | `04-camada-dados.md` | Camada de serviços tipada sobre o cliente supabase-js |
| M5 | `05-categorias.md` | CRUD de Categorias com limite mensal |
| M6 | `06-fontes.md` | CRUD de Fontes, incluindo fontes restritas e suas categorias |
| M7 | `07-entradas.md` | CRUD de Entradas |
| M8 | `08-saidas.md` | Saída com split multi-fonte + validação bloqueante (o coração do sistema) |
| M9 | `09-dashboard.md` | Tela inicial: saldo geral, por fonte, por categoria |
| M10 | `10-recorrencias.md` | Painel de pendências do mês e confirmação manual |
| M11 | `11-layout-mobile.md` | Passada de responsividade sobre todas as telas existentes |
| M12 | `12-notificacoes-saldo.md` | Feedback de saldo pós-lançamento (RN-07) |
| M13 | `13-cartao-credito.md` | Cartão de crédito: Fonte com limite, bloqueio por limite, fatura assistida |
| M14 | `14-lancamentos-futuros.md` | Entrada/Saída com data futura: não conta no saldo até o dia chegar |
| M19 | `19-recorrencias-acompanhamento.md` | Recorrência vira acompanhamento de contas a pagar (paga/pendente/atrasada), fora do saldo |
| M20 | `20-integracao-pluggy.md` | Transações via Pluggy numa caixa de entrada (Importadas), worker de sincronização, Conexões |

**Ordem de dependência:** Categorias antes de Fontes (fonte restrita referencia
categorias). Fontes antes de Entradas. Entradas antes de Saídas (precisa ter saldo
para testar o bloqueio). M9 e M10 podem ser feitos em qualquer ordem entre si, mas
ambos antes de M11 (que audita todas as telas), que por sua vez vem antes de M12: só
faz sentido consolidar as notificações de saldo depois que o layout final (inclusive
mobile) estiver fechado. M13 (cartão de crédito) vem depois de M12 porque reaproveita
o `PainelSaldo` na confirmação de fatura — o MVP original terminava em M12, então M13
e M14 são extensões pós-MVP. M14 (lançamentos futuros) não depende de M13, mas fica
depois por ordem de pedido — pode ser antecipada se fizer mais sentido no momento.

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
    api.ts             # cliente PostgREST único (dados) — M17
    auth.ts            # sessão/login (RPC login) — M17
    env.ts             # VITE_API_URL (padrão /api)
    erros.ts           # normalização de erro (ApiError, mensagemDoErro)
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
