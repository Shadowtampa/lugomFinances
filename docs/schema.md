# Schema — Supabase

Referência rápida do banco criado em `supabase/migrations/`. Domínio completo e regras
de negócio (RN-01 a RN-11) em `.specs/00-VISAO-GERAL.md`.

## Tabelas

Todas com RLS habilitada, escopadas por `user_id = auth.uid()` (join no pai para
`fonte_categorias` e `saida_splits`, que não têm `user_id` próprio).

| Tabela | Campos-chave | Observação |
|---|---|---|
| `categorias` | `nome`, `limite_mensal_centavos` (null = sem limite), `vigencia_inicio` | `unique (user_id, nome)` |
| `fontes` | `nome`, `tipo` (`livre`\|`restrita`), `cor` | `unique (user_id, nome)` |
| `fonte_categorias` | `fonte_id`, `categoria_id` | N:N, só relevante p/ fontes restritas |
| `entradas` | `fonte_id`, `valor_centavos`, `data`, `recorrente`, `dia_recorrencia`, `template_id` | insert direto via PostgREST (sem RPC) |
| `saidas` | `categoria_id`, `valor_total_centavos`, `data`, `recorrente`, `template_id` | **nunca** insert direto — sempre via `criar_saida` |
| `saida_splits` | `saida_id`, `fonte_id`, `valor_centavos` | `unique (saida_id, fonte_id)` |

Todo valor monetário é `bigint` em centavos. Nenhum `numeric`/`float`.

## Views (`security_invoker = true`)

- **`v_saldo_fontes`** — saldo acumulado por fonte (RN-04): `Σ entradas − Σ splits`.
- **`v_saldo_categorias`** — saldo por categoria (RN-05): limite acumula mês a mês
  (`limite_mensal × meses_ativos − Σ saídas`). Estourar não bloqueia (RN-06).
- **`v_resumo_geral`** — saldo total/livre/restrito por usuário. `saldo_livre` exclui
  fontes restritas — é a resposta ao problema central do app.
- **`v_recorrencias_pendentes`** — templates recorrentes ainda não lançados no mês
  corrente (RN-08).

## RPCs

### `criar_saida(...)` → `jsonb`

Único caminho para gravar uma saída. Transacional: valida tudo antes de inserir
qualquer linha. Devolve saldos pós-lançamento (RN-07): saldo de cada fonte envolvida
+ saldo da categoria.

### `excluir_saida(p_saida_id uuid)` → `void`

Remove a saída (splits caem por `on delete cascade`).

### `atualizar_saida(...)` → `jsonb`

Implementado como `excluir_saida` + `criar_saida` na mesma transação — reaproveita
toda a validação de `criar_saida`.

## Códigos de erro

Toda exceção das RPCs começa com um prefixo `SCREAMING_SNAKE_CASE` antes de `:`. O
frontend faz o parsing desse prefixo — nunca mostra a mensagem crua do Postgres.

| Código | Quando |
|---|---|
| `AUTH_REQUIRED` | sem sessão (`auth.uid()` nulo) |
| `CATEGORIA_INVALIDA` | categoria não existe ou não pertence ao usuário |
| `SPLIT_VAZIO` | nenhum split enviado |
| `SPLIT_SOMA_DIVERGENTE` | `Σ splits ≠ valor_total` (RN-01) |
| `FONTE_INVALIDA` | fonte não existe ou não pertence ao usuário |
| `CATEGORIA_NAO_PERMITIDA_NA_FONTE` | fonte restrita, categoria fora do allowlist (RN-03) — bloqueante |
| `SALDO_INSUFICIENTE` | split deixaria a fonte negativa (RN-02) — bloqueante |
| `SAIDA_INVALIDA` | `excluir_saida` chamado com id que não existe / não é do usuário |

## Trigger

`before insert` em `categorias`, `fontes`, `entradas`, `saidas`: se `user_id` vier
nulo, preenche com `auth.uid()`. O frontend não precisa (nem deve) mandar `user_id`.

## Seed

`supabase/seed.sql` popula um cenário completo (categorias, fontes, entradas, saídas
via `criar_saida`) para o **primeiro usuário encontrado em `auth.users`**. No-op com
aviso se não houver nenhum usuário ainda — rode depois do M3 (primeiro signup).
