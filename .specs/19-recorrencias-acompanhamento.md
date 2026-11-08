# M19 — Recorrências como acompanhamento

**Objetivo:** Recorrência deixa de ser um lançamento (template de Entrada/Saída que gera lançamentos) e passa a ser um **acompanhamento de contas a pagar**: um checklist mensal de "paga / não paga" que **nunca afeta saldo**. Prepara o terreno para o M20 (Pluggy), em que os lançamentos reais chegam importados e as recorrências só são conciliadas com eles.

**Pré-requisitos:** M1–M17 concluídos (M18 independente, ainda não mergeado).

**Sequência planejada:** M19 (este) → M20 Integração Pluggy → M21 Conciliação (fatura + transferência).

---

## Decisões (grill de 2026-11-08)

- Recorrência é entidade própria (`recorrencias`), fora de qualquer view de saldo.
- Só **saídas** (contas a pagar). Recorrência de entrada (Salário, VR) deixa de existir.
- Uma recorrência é marcada como paga de duas formas:
  1. **Manual:** botão "Marcar como paga" (sem lançamento ligado). Entra neste milestone.
  2. **Sugestão na importação (M20):** transação importada com valor exatamente igual (ao centavo), débito, mesma competência, recorrência ainda não paga → app sugere; várias candidatas → usuário escolhe. Regra determinística, sem IA. **Não** entra neste milestone, mas o schema já suporta (`saida_id`).
- Pendência de fatura de cartão (RN-13, M13) continua funcionando como hoje até o M21.

---

## Escopo

**Dentro:**
- Tabelas `recorrencias` e `recorrencias_pagamentos`, RLS, trigger de `user_id`.
- Migração das recorrências de saída atuais para o modelo novo, com histórico de pagamentos.
- Remoção do modelo antigo: colunas `recorrente`, `dia_recorrencia`, `recorrencia_ativa`, `template_id`, `total_parcelas` de `entradas` e `saidas`; tabela `recorrencias_ignoradas`; ramos de template da `v_recorrencias_pendentes`; parâmetros de recorrência das RPCs.
- Tela Recorrências reescrita como checklist mensal + CRUD de recorrências.
- Card no Painel com pendentes/atrasadas do mês.
- Remover o checkbox "Recorrente" dos formulários de Entrada e Saída.
- Atualizar `00-VISAO-GERAL.md` (glossário, RN-08, RN-13, modelo de dados) e `CLAUDE.md` ("There is no separate Conta entity…").

**Fora:**
- Integração Pluggy e sugestão automática (M20).
- Pagamento de fatura / transferência importados (M21).
- Recorrência de entrada.
- Notificação push/e-mail.

---

## Tarefas

### 19.1 Schema — `db/migrations/00011_recorrencias_acompanhamento.sql`

```sql
create table recorrencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,               -- trigger de user_id (00006)
  titulo text not null check (length(trim(titulo)) > 0),
  valor_previsto_centavos bigint not null check (valor_previsto_centavos > 0),
  dia smallint not null check (dia between 1 and 31),
  categoria_id uuid references categorias(id) on delete set null,
  mes_inicio date not null check (extract(day from mes_inicio) = 1),
  total_parcelas smallint check (total_parcelas is null or total_parcelas >= 1),
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

create table recorrencias_pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  recorrencia_id uuid not null references recorrencias(id) on delete cascade,
  competencia date not null check (extract(day from competencia) = 1),
  pago_em date not null,
  saida_id uuid references saidas(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (recorrencia_id, competencia)
);
```

- RLS `user_id = auth.uid()` nas duas; grants em `99999_grants.sql`.
- `saida_id on delete set null`: o M20 vai zerar todas as Saídas e o histórico de "paga" precisa sobreviver.
- **Parcela** de uma competência = meses entre `mes_inicio` e `competencia` + 1. Recorrência está **vigente** numa competência se `ativa`, `competencia >= mes_inicio` e (`total_parcelas is null` ou parcela ≤ `total_parcelas`).
- Dia além do fim do mês (ex.: 31 em fevereiro) resolve para o último dia (mesma regra de `resolverDiaRecorrencia`).

**View `v_recorrencias_mes`** (`security_invoker = true`), parametrizada pelo front via filtro `competencia=eq.YYYY-MM-01`: uma linha por recorrência vigente × competência (gerar competências de `mes_inicio` até o mês atual + 12 com `generate_series`), com `parcela`, `total_parcelas`, `pagamento_id`, `pago_em`, `saida_id`, `valor_pago_centavos` (do `saidas.valor_total_centavos` ligado, se houver). Status **não** é calculado na view (depende de "hoje" do cliente) — o front deriva.

**Fatura de cartão:** extrair o ramo `fatura_cartao` da `v_recorrencias_pendentes` antiga para uma view `v_faturas_pendentes` com o mesmo comportamento; a `v_recorrencias_pendentes` é dropada.

### 19.2 Migração de dados (mesma migration, antes dos drops)

Para cada `saidas` com `recorrente = true` (template):
- `recorrencias`: `titulo`, `valor_previsto_centavos = valor_total_centavos`, `dia = dia_recorrencia`, `categoria_id`, `mes_inicio = date_trunc('month', data)`, `total_parcelas`, `ativa = recorrencia_ativa`.
- `recorrencias_pagamentos`: uma linha para o mês do próprio template e uma para cada Saída com `template_id` = template, com `competencia = date_trunc('month', data)`, `pago_em = data`, `saida_id = id`. Duplicadas na mesma competência → fica a mais antiga.

Entradas com `recorrente = true` (Salário, VR) **não** são migradas: viram Entradas comuns (só perdem as colunas).

Recorrências parceladas já encerradas (todas as parcelas pagas) migram normalmente; simplesmente não aparecem como vigentes nos meses seguintes.

Depois: drop das colunas antigas, de `recorrencias_ignoradas`, de `v_recorrencias_pendentes`; recriar `criar_saida`, `editar_saida` (00004) e a RPC de Entrada sem os parâmetros `p_recorrente`, `p_dia_recorrencia`, `p_template_id`, `p_total_parcelas`. Views de saldo não mudam.

Atualizar `db/seed.sql` para o modelo novo.

### 19.3 Camada de dados

- `types/api.ts`: `RecorrenciaRow`, `RecorrenciaMesRow`, `FaturaPendenteRow`; remover campos de recorrência de `EntradaRow`/`SaidaRow`.
- `types/domain.ts`: `Recorrencia`, `RecorrenciaDoMes` (+ `status: 'paga' | 'pendente' | 'atrasada'` derivado), `FaturaPendente`.
- `services/mappers.ts`: mapeadores novos; remover os antigos.
- `services/recorrencias.ts` reescrito:
  - `listarRecorrencias()`, `criarRecorrencia()`, `atualizarRecorrencia()`, `definirRecorrenciaAtiva()`, `excluirRecorrencia()`
  - `listarRecorrenciasDoMes(competencia: 'YYYY-MM')`
  - `marcarComoPaga(recorrenciaId, competencia, pagoEm)` / `desmarcarPagamento(pagamentoId)`
  - `listarFaturasPendentes()`, `confirmarFaturaCartao()` (comportamento do M13 inalterado)
- `lib/recorrencias.ts` (puro, testado): `statusDaRecorrencia(item, hoje)`:
  - `paga` se tem pagamento;
  - `atrasada` se não paga e `hoje > dia resolvido da competência`;
  - `pendente` caso contrário (inclui meses futuros).
- Remover de `services/entradas.ts` e `services/saidas.ts` tudo que é recorrência (`definirRecorrenciaAtivaSaida`, campos nos payloads).

### 19.4 Tela Recorrências (`/recorrencias`)

- Navegação de mês (padrão `?mes=YYYY-MM` das outras telas), default mês atual.
- Topo: **"Pago R$ X de R$ Y · falta R$ Z"** (Y = Σ valor previsto das vigentes; X = Σ valor pago — real se houver Saída ligada, senão previsto).
- Seção **Faturas de cartão** (se houver pendência): como hoje (M13).
- Lista ordenada por dia: título, dia, categoria, `parcela/total` se parcelada, valor previsto (e valor real se diferente), badge de status (**Paga** verde / **Pendente** neutro / **Atrasada** `text-alerta`).
- Ações por linha: **Marcar como paga** (data default hoje, editável) / **Desmarcar**; menu Editar / Desativar / Excluir (com confirmação).
- Botão **Nova recorrência**: modal com título, valor previsto, dia, categoria (opcional), parcelas (opcional), mês de início (default mês atual).
- Empty state quando não há recorrências.

### 19.5 Formulários de Entrada e Saída

Remover o checkbox "Recorrente" e campos derivados (dia, parcelas) de `EntradaFormModal` e `SaidaFormModal`, e qualquer indicação de "recorrente" nas listas de Entradas/Saídas.

### 19.6 Card no Painel

Abaixo do resumo: "Recorrências de {mês}: N pendentes, M atrasadas — R$ Z a pagar", com link para `/recorrencias`. Some quando tudo do mês está pago ou não há recorrências.

### 19.7 Documentação

- `00-VISAO-GERAL.md`: glossário (Recorrência = conta a pagar acompanhada, não lançamento), RN-08 reescrita, RN-13 apontando para `v_faturas_pendentes`, modelo de dados.
- `CLAUDE.md`: trocar "There is no separate Conta entity — a recurring fixed bill is just a Saída with `recorrente = true`" pela regra nova; atualizar lista de views.
- `10-recorrencias.md`: nota no topo "Substituído pelo M19".

---

## Critérios de aceite

- [ ] Migration aplica limpo sobre o banco atual; as 12 recorrências de saída existentes aparecem em `recorrencias` com histórico de pagamentos dos meses já lançados.
- [ ] Salário e VR continuam como Entradas comuns; saldos de todas as Fontes **idênticos** antes e depois da migration.
- [ ] Nenhuma view de saldo lê `recorrencias*`.
- [ ] Recorrências → mês atual: lista com status correto; marcar/desmarcar atualiza o topo.
- [ ] Recorrência parcelada some depois da última parcela; desativada some dos meses seguintes.
- [ ] Pendência de fatura de cartão continua aparecendo e confirmando como no M13.
- [ ] Formulários de Entrada/Saída sem campo de recorrência; criar/editar Saída continua passando por `criar_saida`/`editar_saida`.
- [ ] Card do Painel mostra pendentes/atrasadas do mês.
- [ ] Testes: `statusDaRecorrencia` (paga, pendente antes do dia, atrasada depois do dia, dia 31 em mês de 30, mês futuro), mappers novos.
- [ ] `npm run build`, `npm run lint`, `npm test` sem novos erros/warnings.
- [ ] `00-VISAO-GERAL.md`, `CLAUDE.md` e `10-recorrencias.md` atualizados.

## Definition of Done

Backup (`pg_dump`) feito, migration aplicada no homelab, saldos conferidos iguais aos de antes. Em Recorrências, o mês atual mostra as contas fixas com status; marcar "Internet" como paga muda o badge para **Paga** e o topo para "Pago R$ … de R$ …". No Painel, o card mostra o que falta pagar.
