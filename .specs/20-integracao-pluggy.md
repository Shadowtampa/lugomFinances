# M20 — Integração Pluggy

**Objetivo:** as transações das contas e cartões (Inter, Mercado Pago) passam a chegar sozinhas via Pluggy (Open Finance). Elas caem numa caixa de entrada (**Importadas**), onde o usuário escolhe a Categoria e confirma. Só então elas viram Entrada ou Saída. O app recomeça do zero, com um saldo inicial vindo da Pluggy.

**Pré-requisitos:** M19 em produção (Recorrência fora do saldo). O M18 é reaproveitado no aviso de integração (20.8).

**Sequência:** M19 → **M20** → M21 (importação retroativa + pagamento de fatura; ver `21-importacao-retroativa.md`). Transferência entre contas próprias continua fora.

---

## Decisões (grill de 2026-11-08)

| # | Decisão |
|---|---|
| Fonte da verdade | A Pluggy é a fonte da verdade para contas e cartões conectados. O Flash (VR Flash) continua manual (`fontes.origem = 'manual'`). |
| Recomeço | Apagar **todas** as Entradas e Saídas (inclusive as do Flash) e todas as Fontes, **exceto a VR Flash**, que fica com saldo zero. Categorias e Recorrências ficam. |
| Saldo inicial | Ao ligar uma conta da Pluggy a uma Fonte, o app cria um lançamento de saldo inicial com o saldo atual na Pluggy. Só entram transações com `data` posterior à **data de corte** da conta. Sem histórico. |
| Caixa de entrada | Nada vira lançamento sem confirmação. A Categoria sugerida é a da última confirmação com a mesma descrição. A Fonte é fixa (a da conta). |
| Recorrência | Uma Saída importada com valor **exatamente igual** (ao centavo) ao de uma recorrência vigente, não paga e da mesma competência gera a sugestão "É a {recorrência} de {mês}?". Com mais de uma candidata, o usuário escolhe. Sem IA. |
| Pendentes | Conta: só `POSTED`. Cartão: `PENDING` também, exceto parcelas futuras (`data > hoje`). Uma transação que some da Pluggy é removida da caixa de entrada se estiver pendente de revisão, ou marcada como `divergente` se já tiver sido confirmada. |
| Worker | Node 22 + TS em `worker/`, um Deployment no k8s (hostPath, sem registry), timer de **6h** + `POST /sync` (botão "Sincronizar agora"). Conecta direto no Postgres com o role `pluggy_worker`. |
| Credenciais | `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` só no Secret do k8s. Os Item IDs ficam no banco e são cadastrados na tela Conexões. |
| Confirmação em lote | Em ordem de data, Entradas antes de Saídas no mesmo dia. Para no primeiro bloqueio (RN-02/RN-03) e mostra o motivo. |
| Aviso | O aviso do M18 (`created_at`) dá lugar a um **aviso de integração**: última sincronização falhou, item pedindo reautenticação, ou nenhuma sincronização bem-sucedida há 3 dias ou mais. |

---

## Fatos da API Pluggy (conferidos em 2026-11-08)

- `POST https://api.pluggy.ai/auth` `{clientId, clientSecret}` → `{apiKey}`, válida por **2h**. Header `X-API-KEY`.
- Não há endpoint para listar todos os items do cliente: os Item IDs vêm do Meu Pluggy ("Copiar Item ID" no app demo do Dashboard).
- `GET /items/{id}` → `status` (`UPDATED`, `UPDATING`, `LOGIN_ERROR`, `OUTDATED`, `WAITING_USER_INPUT`), `executionStatus`, `updatedAt`. A Pluggy sincroniza o item com o banco **1x/dia**.
- `GET /accounts?itemId=` → contas (`type` `BANK` | `CREDIT`, `balance`, `name`, `number`, `creditData`).
- `GET /v2/transactions?accountId=&dateFrom=|createdAtFrom=&after=` → `{results, next}` (cursor, 500 por página).
- Sinal: no **cartão**, `amount > 0` = compra e `< 0` = pagamento/estorno. Na **conta**, usar `type` (`DEBIT` = saída, `CREDIT` = entrada). Guardamos sempre `valor_centavos > 0` + `direcao`.
- `status` `PENDING`/`POSTED`. O `id` costuma ser preservado ao virar `POSTED`, mas pode ser apagado e recriado.
- `creditCardMetadata.installmentNumber/totalInstallments` para parcelas. `category` exige o plano Pro (pode vir `null`).
- Novas conexões no Meu Pluggy exigem o trial da pluggy.ai ativo. As conexões existentes continuam funcionando.

---

## Escopo

**Dentro:** schema de integração, script de recomeço, worker (timer + `/sync`), telas **Conexões** e **Importadas**, confirmação individual e em lote, sugestão de Categoria e de Recorrência, aviso de integração no Painel, deploy do worker.

**Fora:** pagamento de fatura e transferência entre contas próprias (M21; até lá, o usuário ignora ou lança como Saída comum); webhooks da Pluggy; forçar o banco a atualizar (`PATCH /items`); cheque especial / saldo negativo real; categorização por IA; criar conexão no Meu Pluggy pelo app.

---

## Tarefas

### 20.1 Schema — `db/migrations/00012_integracao_pluggy.sql`

```sql
alter table fontes
  add column origem text not null default 'manual' check (origem in ('manual', 'pluggy')),
  add column pluggy_account_id text unique;

create table pluggy_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null unique,
  nome text,                         -- nome do conector (ex.: "Banco Inter")
  status text,                       -- status do item na Pluggy
  execution_status text,
  atualizado_na_pluggy_em timestamptz,
  created_at timestamptz not null default now()
);

create table pluggy_contas (
  pluggy_account_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references pluggy_itens(item_id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('BANK', 'CREDIT')),
  numero text,
  saldo_centavos bigint not null,    -- como a Pluggy informa (cartão: dívida > 0)
  data_corte date,                   -- preenchida ao vincular; só importa data > data_corte
  updated_at timestamptz not null default now()
);

create table transacoes_importadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pluggy_transaction_id text not null unique,
  pluggy_account_id text not null references pluggy_contas(pluggy_account_id) on delete cascade,
  data date not null,
  descricao text not null,
  valor_centavos bigint not null check (valor_centavos > 0),
  direcao text not null check (direcao in ('entrada', 'saida')),
  status_pluggy text not null,       -- PENDING | POSTED
  categoria_pluggy text,
  parcela smallint,
  total_parcelas smallint,
  estado text not null default 'pendente'
    check (estado in ('pendente', 'confirmada', 'ignorada', 'divergente')),
  entrada_id uuid references entradas(id) on delete set null,
  saida_id uuid references saidas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sincronizacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origem text not null check (origem in ('timer', 'manual')),
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz,
  sucesso boolean,
  importadas int not null default 0,
  erro text                          -- mensagem tratada, nunca o stack/segredo
);
```

- RLS `user_id = auth.uid()` em todas. Por convenção o front só **lê** `pluggy_contas`, `transacoes_importadas` e `sincronizacoes` e escreve via RPC (abaixo); o grant padrão do `authenticated` não é restringido (app de usuário único, RLS já isola).
- Role `pluggy_worker` (`login`, senha no Secret, `bypassrls`), com `select/insert/update/delete` só em `pluggy_itens`, `pluggy_contas`, `transacoes_importadas` e `sincronizacoes`, e `select` em `fontes`. Sem acesso a `entradas`/`saidas`.
- Índices: `transacoes_importadas (user_id, estado, data)`, `sincronizacoes (user_id, iniciada_em desc)`.

**Views** (`security_invoker = true`):
- `v_importadas_pendentes`: transações com `estado = 'pendente'`, mais `fonte_id` (via `fontes.pluggy_account_id`) e `categoria_sugerida_id` (a Categoria da Saída da última transação **confirmada** com a mesma `descricao`; `null` se não houver).
- `v_sugestoes_recorrencia`: para cada transação pendente de `direcao = 'saida'`, as recorrências de `v_recorrencias_mes` com `competencia = date_trunc('month', data)`, `pagamento_id is null` e `valor_previsto_centavos = valor_centavos`.
- `v_status_integracao`: uma linha por usuário com a última sincronização (`iniciada_em`, `sucesso`, `erro`), a última sincronização bem-sucedida e os itens com `status in ('LOGIN_ERROR', 'OUTDATED', 'WAITING_USER_INPUT')`.

**RPCs** (`security invoker`, erros `SCREAMING_SNAKE_CASE`):
- Item: insert/delete direto em `pluggy_itens` pelo PostgREST (trigger preenche `user_id`; RLS). Sem RPC.
- `vincular_conta_pluggy(p_pluggy_account_id text, p_fonte_id uuid default null, p_nova_fonte jsonb default null)`: liga a conta a uma Fonte existente ou cria uma (`origem = 'pluggy'`; `BANK` → `livre`; `CREDIT` → cartão M13, com `limite_centavos` e `dia_fatura` vindos de `p_nova_fonte`). Grava `data_corte = current_date` e cria o saldo inicial na mesma transação:
  - `BANK` com saldo > 0 → Entrada "Saldo inicial" em `data_corte`.
  - `CREDIT` com dívida > 0 → Saída via `criar_saida`, título "Fatura em aberto (saldo inicial)", Categoria **"Ajuste de saldo"** (criada se não existir).
  - Erros: `CONTA_JA_VINCULADA`, `FONTE_JA_VINCULADA`, `FONTE_INVALIDA`.
- `confirmar_importada(p_id uuid, p_categoria_id uuid default null, p_recorrencia_id uuid default null)`:
  - `entrada` → insere a Entrada (Fonte da conta, `titulo = descricao`, `data`, `valor`).
  - `saida` → `criar_saida` (split único na Fonte da conta). `p_categoria_id` é obrigatório: `CATEGORIA_OBRIGATORIA`.
  - `p_recorrencia_id` presente → insere `recorrencias_pagamentos (competencia = mês da data, pago_em = data, saida_id)`. Falha com `RECORRENCIA_JA_PAGA` se já houver pagamento.
  - Marca `estado = 'confirmada'` e `entrada_id`/`saida_id`. Erros: `IMPORTADA_NAO_PENDENTE`, `CONTA_NAO_VINCULADA`, além dos da `criar_saida` (RN-02/RN-03).
- `ignorar_importada(p_id uuid)` / `desfazer_ignorar_importada(p_id uuid)`.

### 20.2 Recomeço — `deploy/recomecar-do-zero.sql` (roda uma vez, à mão)

Não é migration: operação de dados única e destrutiva. Precisa de `pg_dump` antes (README).

1. Em transação: `delete from saida_splits; delete from saidas; delete from entradas;` (os `recorrencias_pagamentos.saida_id` viram `null`, e o histórico de "paga" fica).
2. `delete from fonte_categorias where fonte_id <> {VR Flash}; delete from fontes where nome <> 'VR Flash';` (identificar por nome, confirmando que só existe uma).
3. `update fontes set origem = 'manual' where nome = 'VR Flash';`
4. Conferir: `v_saldo_fontes` mostra uma única Fonte (VR Flash) com saldo 0, e `recorrencias` continua com o mesmo número de linhas.

### 20.3 Worker — `worker/`

- `worker/package.json` (deps: só `pg`; JWT HS256 validado com `node:crypto`; HTTP com `node:http`, sem framework), `worker/src/*.ts` executado com `node --experimental-strip-types` (Node 22.6+), sem etapa de build.
- Config por env: `DATABASE_URL` (role `pluggy_worker`), `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `JWT_SECRET` (o mesmo do PostgREST), `INTERVALO_HORAS=6`.
- **Ciclo de sincronização** (um por vez, com lock em memória; um `/sync` durante a execução devolve `409 SINCRONIZACAO_EM_ANDAMENTO`):
  1. Abre uma linha em `sincronizacoes`.
  2. `POST /auth` (reusa a apiKey por até 1h50).
  3. Para cada `pluggy_itens`: `GET /items/{id}` → atualiza `status`, `execution_status`, `atualizado_na_pluggy_em`.
  4. `GET /accounts?itemId=` → upsert de `pluggy_contas` (nome, tipo, número, saldo). Conta nova fica sem vínculo até o usuário ligar.
  5. Para cada conta **vinculada** (tem Fonte + `data_corte`): `GET /v2/transactions?accountId=&dateFrom={data_corte + 1}` paginando com `after`. Para cada transação:
     - Ignora `PENDING` em `BANK` e `PENDING` com `date > hoje` em `CREDIT`.
     - Normaliza: `valor_centavos = round(abs(amount) * 100)`; `direcao` = `CREDIT`: `amount > 0 → saida`; `BANK`: `type = 'DEBIT' → saida`. `data` = `date` convertida para o fuso America/Sao_Paulo.
     - Upsert por `pluggy_transaction_id`: insere como `pendente`; se já existe e está `pendente`, atualiza data/descrição/valor/status; se está confirmada ou ignorada, não mexe.
  6. **Sumidas:** transações da janela da conta que estão no banco com `status_pluggy = 'PENDING'` mas não vieram nesta busca → `pendente` é apagada, `confirmada` vira `divergente`.
  7. Fecha a sincronização (`sucesso`, `importadas`, `erro` tratado: `PLUGGY_AUTH_FALHOU`, `PLUGGY_INDISPONIVEL`, `ITEM_NAO_ENCONTRADO: …`).
- **HTTP** (porta 8080): `POST /sync` com `Authorization: Bearer <jwt do login>` validado com `JWT_SECRET` (`role = authenticated`) → roda o ciclo (`origem = 'manual'`) e devolve o resumo; `GET /health`.
- **Timer:** um ciclo `origem = 'timer'` ao subir e depois a cada `INTERVALO_HORAS`.
- Logs sem segredos (nunca logar apiKey, clientSecret nem o JWT).
- Testes (vitest, no mesmo `npm test`): normalização de transação (sinal cartão/conta, centavos, fuso, filtro de pendentes) e a decisão das "sumidas", como funções puras com fixtures JSON.

### 20.4 Deploy

- `deploy/k8s/40-worker.yaml`: Deployment `worker` (`node:22-alpine`, `hostPath` → `worker/`, `command: npm ci --omit=dev && node --experimental-strip-types src/main.ts`) e Service `worker:8080`.
- Secret `lugom-financas` ganha `pluggy-client-id`, `pluggy-client-secret` e `pluggy-worker-password` (o `subir.sh` pede os dois primeiros se faltarem; nunca entram no git).
- `nginx.conf`: `location /sync { proxy_pass http://worker:8080/sync; }`.
- `subir.sh`: aplica `40-worker.yaml` e reinicia o worker.
- README: passos do Meu Pluggy (criar a Application → Client ID/Secret; copiar os Item IDs) e o recomeço (backup → `recomecar-do-zero.sql`).

### 20.5 Camada de dados (front)

- `types/api.ts` / `types/domain.ts` / `mappers.ts`: `PluggyItem`, `PluggyConta`, `TransacaoImportada` (+ `categoriaSugeridaId`), `SugestaoRecorrencia`, `StatusIntegracao`; `Fonte` ganha `origem` e `pluggyAccountId`.
- `services/integracao.ts`: `listarItens`, `cadastrarItem`, `removerItem`, `listarContasPluggy`, `vincularConta`, `listarImportadasPendentes`, `listarSugestoesRecorrencia`, `confirmarImportada`, `ignorarImportada`, `desfazerIgnorarImportada`, `obterStatusIntegracao`, `sincronizarAgora()`. Esta última é a única chamada fora do PostgREST: `fetch('/sync', {Authorization})`, no service, usando o token de `lib/auth.ts`.

### 20.6 Tela Conexões (`/conexoes`)

- Lista de items: nome, status (badge: Atualizado / Erro / Reconectar no Meu Pluggy) e data da última atualização na Pluggy. Botão remover (com confirmação).
- "Adicionar conexão": campo Item ID + texto de ajuda de onde copiar.
- Contas de cada item: nome, tipo, saldo e **Fonte vinculada**. Conta sem vínculo mostra o botão "Vincular", que abre um modal: usar uma Fonte existente (só as sem vínculo e `origem = 'pluggy'` ou novas) ou criar nova (nome sugerido = nome da conta; cartão pede limite e dia da fatura, pré-preenchidos se a Pluggy informar). O aviso no modal diz: "Será criado um saldo inicial de R$ X em {data}. Só transações depois de hoje serão importadas."
- Botão "Sincronizar agora" + "Última sincronização: há 2h (12 importadas)".

### 20.7 Tela Importadas (`/importadas`)

- Item novo no menu, com badge da contagem de pendentes.
- Lista ordenada por data: data, descrição, Fonte (fixa), valor (verde se entrada), selo `pendente no cartão` se `status_pluggy = PENDING`, parcela `n/t` se houver.
- Saída: select de Categoria pré-preenchido com a sugestão. Se houver sugestão de recorrência, mostra "É **Internet** de nov/2026?" (com várias candidatas, um select), marcada por padrão e desmarcável.
- Ações por linha: **Confirmar** / **Ignorar** (desfazer via toast).
- "Confirmar todas com sugestão": confirma em ordem de data (Entradas antes de Saídas no mesmo dia) só as linhas que têm Categoria (ou são Entradas), para no primeiro erro e mostra quantas foram e o motivo traduzido.
- Seção recolhida **Divergentes**: transações confirmadas que sumiram da Pluggy, com link para o lançamento, para o usuário revisar à mão. O botão "Ok" marca como `ignorada`.
- Empty state: "Nada para revisar. Última sincronização há X."

### 20.8 Aviso de integração no Painel

Componente `src/features/dashboard/AvisoIntegracao.tsx` (substitui o `AvisoDadosDesatualizados` do M18, que não foi mergeado; reaproveita `diasDesde`), alimentado por `v_status_integracao`:
- Última sincronização com `sucesso = false` → "A última sincronização falhou em DD/MM ({erro traduzido})." + botão "Tentar de novo" (`sincronizarAgora`).
- Item com `LOGIN_ERROR`/`OUTDATED`/`WAITING_USER_INPUT` → "Reconecte o {nome} no Meu Pluggy."
- Última sincronização bem-sucedida há **3 dias ou mais** (ou nenhuma, existindo item cadastrado) → "Faz N dias que a sincronização não roda."
- Nada disso → não mostra nada. O aviso por `created_at` do M18 **não** entra.

### 20.9 Documentação

- `00-VISAO-GERAL.md`: glossário (Importada, Conexão, origem da Fonte), RN nova sobre a caixa de entrada e a data de corte, modelo de dados, roadmap.
- `CLAUDE.md`: worker em `worker/` (única peça fora do PostgREST, só para a Pluggy), `/sync`, e o Secret.

---

## Ordem de implementação (checkpoints)

1. Migration 00012 + RPCs, testadas numa cópia do banco.
2. Worker + testes de normalização, rodado localmente contra a Pluggy real (só leitura).
3. Telas Conexões e Importadas + aviso + docs.
4. Produção: backup → 00012 → deploy worker → `recomecar-do-zero.sql` → cadastrar items → vincular contas.

## Critérios de aceite

- [ ] Depois do recomeço: só a VR Flash existe, com saldo 0; `recorrencias` intacta.
- [ ] Vincular uma conta cria a Fonte + saldo inicial igual ao saldo da Pluggy, e `v_saldo_fontes` bate com o banco.
- [ ] A sincronização importa só transações depois da data de corte; rodar duas vezes não duplica nada.
- [ ] Pendente de conta não entra; compra pendente no cartão entra; parcela futura não entra.
- [ ] Confirmar uma Saída com sugestão de recorrência marca a recorrência como paga, com `saida_id`.
- [ ] Confirmar todas respeita a ordem e para no primeiro bloqueio com mensagem traduzida.
- [ ] "Sincronizar agora" funciona pelo botão; um segundo clique durante a execução mostra "Sincronização em andamento".
- [ ] O Painel mostra o aviso quando a última sincronização falhou e quando um item pede reautenticação.
- [ ] Nenhum segredo da Pluggy no front, no banco ou no git; o worker não loga segredos.
- [ ] `npm run build`, `npm run lint`, `npm test` (incluindo os testes do worker) sem novos erros/warnings.

## Definition of Done

Em produção: Inter e Mercado Pago aparecem em Conexões como **Atualizado**, com as contas vinculadas a Fontes e saldos iguais aos dos bancos. Uma compra feita no cartão aparece em Importadas depois do próximo "Sincronizar agora" (respeitando o atraso de até 1 dia da Pluggy) e, confirmada com Categoria, vira Saída e reduz o limite disponível do cartão.
