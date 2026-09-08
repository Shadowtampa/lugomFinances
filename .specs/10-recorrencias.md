# M10 — Recorrências (Contas Fixas)

**Objetivo:** transformar os templates recorrentes em lançamentos reais do mês, com
confirmação manual. É aqui que "Cadastrar Contas — registrar meus gastos fixos mês a
mês" vira realidade.

**Pré-requisitos:** M1–M9 concluídos.

---

## Escopo

**Dentro:** painel de pendências, confirmação individual, edição de valor no momento
da confirmação, ignorar mês, encerrar recorrência, resolução de dia inválido,
parcelamento com número fixo de parcelas.

**Fora:** lançamento automático por cron, notificação push de vencimento.

---

## Regras aplicáveis

- **RN-08** — recorrência é assistida. O sistema **nunca** cria lançamento sozinho.
- Um lançamento com `recorrente = true` é o **template**. Ele conta como o lançamento
  do mês em que foi criado.
- Lançamentos gerados têm `recorrente = false` e `template_id` apontando ao template.
- A view `v_recorrencias_pendentes` (M2) já resolve "o que falta lançar neste mês".
- Confirmar uma saída recorrente passa por `criar_saida` e **está sujeita a todos os
  bloqueios da RN-02 e RN-03**. Aluguel só entra se houver saldo.

---

## Tarefas

### 10.1 Página — `/recorrencias`

Duas seções: **Pendentes neste mês** e **Todas as recorrências**.

**Pendentes:**

```
Pendentes em setembro

┌──────────────────────────────────────────────────────────┐
│  dia 5   Salário                      entrada            │
│          Conta Corrente               R$ 5.000,00        │
│                              [Ignorar]  [Lançar]         │
├──────────────────────────────────────────────────────────┤
│  dia 5   Aluguel                      saída · Moradia    │
│          Conta Corrente               R$ 1.800,00        │
│                              [Ignorar]  [Lançar]         │
└──────────────────────────────────────────────────────────┘

                        [Lançar todas]
```

- Ordenar por dia da recorrência.
- Entradas e saídas na mesma lista, diferenciadas pelo rótulo e pela cor do valor.
- Item vencido (dia já passou no mês corrente) recebe um marcador discreto: `atrasado`
  em `--color-alerta`. Nada mais chamativo — atraso aqui não é emergência.
- Vazio: "Tudo lançado em setembro." Estado positivo, não um vazio triste.

**Todas as recorrências:** lista dos templates ativos e inativos, com ação de
editar (leva ao modal do M7/M8) e de encerrar.

### 10.2 Lançar uma pendência

Clicar em "Lançar" abre um modal de confirmação **pré-preenchido**, não grava direto:

| Campo | Comportamento |
|---|---|
| Título | do template, editável |
| Valor | do template, editável — **este é o ponto principal** |
| Data | resolvida (ver 10.4), editável |
| Fonte / Split | do template, editável |
| Categoria (saída) | do template, editável |

O valor precisa ser editável porque contas fixas raramente são fixas de verdade: a
conta de luz varia todo mês. O template guarda o último valor como sugestão.

Ao confirmar:
- Entrada → `POST /rest/v1/entradas` com `template_id` preenchido
- Saída → RPC `criar_saida` com `p_template_id` preenchido

Mostrar um toast simples com o novo saldo após o sucesso (mesma filosofia da RN-07
usada nas confirmações de M7/M8) — não depender de um `PainelSaldo` dedicado, pois
notificações (M12) ainda não existe neste ponto do roadmap. Quando M12 for feito,
unificar essa confirmação com o `PainelSaldo` de lá.

**Se a saída for bloqueada** (sem saldo), a pendência continua pendente e a mensagem
explica: "Não há saldo em Conta Corrente para o aluguel de R$ 1.800,00. Registre uma
entrada ou divida entre outras fontes." Com um botão que leva direto ao formulário de
entrada.

### 10.3 "Lançar todas"

Processa em sequência, **parando no primeiro erro**. Ao fim, mostra um resumo:

> 3 lançamentos feitos. 1 bloqueado: Aluguel (sem saldo em Conta Corrente).

Não use `Promise.all` aqui — os lançamentos consomem saldo uns dos outros, e a ordem
importa. Sequencial, na ordem do dia de recorrência.

Antes de executar, mostrar um resumo do que será lançado e pedir confirmação.

### 10.4 Resolução de data

O template tem `dia_recorrencia`. A data do lançamento no mês corrente é:

```
dia_efetivo = min(dia_recorrencia, ultimo_dia_do_mes)
data = <ano>-<mes>-<dia_efetivo>
```

Assim, dia 31 vira 28 em fevereiro (ou 29 em bissexto). Implementar em
`lib/date.ts` como `resolverDiaRecorrencia(ym: string, dia: number): string`, com
testes cobrindo fevereiro comum, fevereiro bissexto, e meses de 30 dias.

### 10.5 Ignorar neste mês

"Ignorar" faz a pendência sumir da lista **apenas do mês corrente**, sem criar
lançamento. Ex: mês em que o freelance não veio.

Implementação — adicionar tabela:

```sql
create table recorrencias_ignoradas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null,
  tipo_lancamento text not null check (tipo_lancamento in ('entrada','saida')),
  competencia date not null,   -- primeiro dia do mês ignorado
  created_at timestamptz not null default now(),
  unique (template_id, tipo_lancamento, competencia)
);
```

Com RLS e um `not exists` adicional na view `v_recorrencias_pendentes`.

Ação desfazível: após ignorar, o toast oferece "Desfazer" por 8 segundos.

### 10.6 Encerrar recorrência

`PATCH` com `recorrencia_ativa = false`. O template para de gerar pendências mas
continua no histórico como um lançamento normal.

Confirmação: "Encerrar a recorrência de 'Academia'? Ela não aparecerá mais nas
pendências mensais. Os lançamentos já feitos permanecem."

Recorrências encerradas ficam na seção "Todas", em estado reduzido, com ação de
"Reativar".

### 10.7 Indicador global

Badge com a contagem de pendências no item "Recorrências" da navegação. Se houver
pendências atrasadas, o badge usa `--color-alerta`; senão, neutro.

No dashboard, quando houver pendências, um bloco discreto acima dos últimos
lançamentos: "2 lançamentos recorrentes pendentes em setembro." + link. Não um banner
grande — é um lembrete, não um alarme.

### 10.8 Parcelamento (recorrência finita)

Uma recorrência pode ter um número fixo de parcelas em vez de repetir para
sempre. Ex.: uma compra parcelada em 4x — o template criado agora é a parcela
1/4, e o sistema permite lançar só mais 3 vezes antes de encerrar sozinho.

- Campo opcional no formulário de Entrada/Saída (M7/M8), visível só quando
  "Recorrente" está marcado: **"Repetir por quantas vezes"**. Vazio = repete
  indefinidamente (comportamento atual, inalterado). Quando preenchido, o
  número **inclui** o lançamento que está sendo criado agora — uma compra "4x"
  é `total_parcelas = 4`.
- Coluna `total_parcelas` (nullable, `>= 1`, exige `recorrente = true`) em
  `entradas` e `saidas`.
- `v_recorrencias_pendentes` para de listar uma pendência assim que o número de
  lançamentos já feitos a partir do template (incluindo o próprio template)
  atingir `total_parcelas` — **independente** do valor de `recorrencia_ativa`,
  para que reativar manualmente uma recorrência esgotada não volte a gerar
  pendência.
- Ao confirmar a última parcela, o sistema marca a recorrência como encerrada
  automaticamente (`recorrencia_ativa = false`) — isso não viola a RN-08
  ("nunca cria lançamento sozinho"): o lançamento em si continua exigindo
  confirmação manual, só o status do template é atualizado.
- Na seção "Todas as recorrências", uma recorrência que atingiu o total de
  parcelas aparece como **"Concluída"** (não "Encerrada") e sem a ação
  "Reativar" — reativá-la não teria efeito, já que a view não voltaria a
  gerá-la como pendente.

---

## Critérios de aceite

- [ ] Template criado em agosto aparece como pendente em setembro
- [ ] Template criado em setembro **não** aparece como pendente em setembro
- [ ] Após lançar, a pendência some e o lançamento aparece na lista do mês com
      `template_id` preenchido
- [ ] Valor editado na confirmação é o que é gravado, e o template mantém o valor
      original
- [ ] Saída recorrente sem saldo é bloqueada e continua pendente
- [ ] "Lançar todas" processa em ordem e para no primeiro erro, com resumo
- [ ] Recorrência de dia 31 lança em 28/02 num ano comum e 29/02 num bissexto
- [ ] "Ignorar" some a pendência só do mês corrente; no mês seguinte ela volta
- [ ] "Desfazer" após ignorar restaura a pendência
- [ ] Encerrar recorrência para de gerar pendências e mantém o histórico
- [ ] Badge de contagem correto na navegação
- [ ] Testes de `resolverDiaRecorrencia` passando para os 3 casos de borda
- [ ] Template de 4 parcelas some das pendências após a 4ª confirmação, mesmo
      que reativado manualmente em seguida
- [ ] Template de 4 parcelas aparece como "4/4 · Concluída" em "Todas as
      recorrências", sem ação "Reativar"

## Definition of Done

O MVP está completo. As três funcionalidades pedidas — cadastrar Entradas, cadastrar
Saídas e cadastrar Contas (gastos fixos mês a mês) — funcionam ponta a ponta, com a
regra de envelopes garantida pelo banco.
