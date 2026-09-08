# M14 — Lançamentos Futuros

**Objetivo:** permitir cadastrar uma Entrada ou Saída com data no futuro. Ela
fica visível no sistema desde já, mas **não conta em nenhum saldo** (Fonte,
Categoria, resumo geral) até o dia chegar — a partir daí, conta sozinha, sem
nenhuma ação manual.

**Pré-requisitos:** M1–M13 concluídos.

---

## O caso de uso original

> "Hoje é dia 1 e eu quero criar um lançamento de entrada acima de dia 15.
> Esse registro não vai ser adicionado ali à minha fonte, ele só vai ficar ali
> no sistema. A partir do dia 15, aí sim vai ser lançado direto na fonte."

Diferente de uma Recorrência (M10) — que é um *template* reaproveitado mês a
mês e sempre exige confirmação manual (RN-08) — um lançamento futuro é um
lançamento **normal**, único, só que com a data adiantada. Ele não precisa de
confirmação quando o dia chega: o próprio efeito de saldo é uma consequência
de a data já ter passado, e isso é automático toda vez que a tela é aberta,
sem nenhum job/cron.

Se esse lançamento também for marcado `recorrente = true`, ele passa a ser um
template normal (RN-08) assim que sua própria data chega — antes disso ele
também não gera pendência em Recorrências, pelo mesmo motivo: sua própria
ocorrência ainda não "aconteceu".

---

## Modelo mental: filtro de data nas views de saldo, não um status novo

A tentação seria adicionar uma coluna `status` ou `lancado boolean` que
alguma rotina vira de `false` para `true` quando o dia chega. Isso exigiria
um cron (fora do escopo do projeto, ver `00-VISAO-GERAL.md` §5). A alternativa
mais simples: as views de saldo (`v_saldo_fontes`, `v_saldo_categorias`,
`v_resumo_geral`) somam **apenas** lançamentos com `data <= hoje`. Assim,
"lançar" um lançamento futuro não é uma ação — é a data virar ontem. A tabela
nunca muda; só o que a view enxerga muda, sozinho, à meia-noite de verdade
(sem job nenhum: é só uma comparação de data recalculada a cada consulta).

Isso também resolve a recorrência de graça: quando a data de um template
futuro chega, ele passa a contar no saldo daquele mês exatamente como qualquer
lançamento normal — e a partir do mês seguinte, `v_recorrencias_pendentes` (já
existente, sem mudança) passa a gerar pendência do jeito que já gera hoje.

---

## Escopo

**Dentro:** Entradas e Saídas com `data` no futuro deixam de contar no saldo
de Fonte, no saldo/limite de Categoria e no resumo geral, até a data chegar;
indicação visual de "agendado" nas listas de Entradas/Saídas; exclusão desses
lançamentos da lista "Últimos lançamentos" do Dashboard (que representa o que
já aconteceu).

**Fora:** notificação quando um lançamento agendado é "lançado", painel
dedicado de agendados, edição em lote, cron/job para qualquer coisa — a
mudança de saldo é sempre um efeito de consulta, nunca uma escrita.

---

## Regras de negócio novas

**RN-14** — Uma Entrada ou Saída com `data` maior que a data de hoje é um
**lançamento futuro**: não conta em `v_saldo_fontes`, `v_saldo_categorias` nem
`v_resumo_geral` enquanto `data > hoje`. Ao chegar o dia (`data <= hoje`),
passa a contar automaticamente, sem nenhuma ação do usuário ou job agendado.

**Nota sobre RN-02 (bloqueio de saldo):** o bloqueio de uma Saída — futura ou
não — é sempre avaliado contra o saldo **atual** da Fonte (RN-04, que já
exclui lançamentos futuros por força da RN-14), nunca contra um saldo
"projetado" na data futura. Isso significa que um lançamento futuro
aprovado hoje pode, em tese, deixar o saldo negativo quando sua data chegar,
se o saldo da Fonte cair nesse meio-tempo por outros lançamentos — o sistema
**não** bloqueia isso retroativamente (limitação conhecida e aceita; um
lançamento futuro se comporta como um cheque pré-datado). Uma notificação
avisando desse risco fica fora de escopo aqui, é uma extensão natural futura
sobre o M12.

---

## Modelo de dados

Nenhuma coluna nova — só as três views de saldo ganham o filtro de data.

```sql
-- v_saldo_fontes: soma só entradas/splits com data já chegada
create or replace view v_saldo_fontes as
select
  f.id as fonte_id, f.user_id, f.nome, f.tipo, f.cor, f.arquivada,
  coalesce(e.total, 0) as total_entradas_centavos,
  coalesce(s.total, 0) as total_saidas_centavos,
  coalesce(e.total, 0) - coalesce(s.total, 0) as saldo_centavos,
  f.eh_cartao, f.limite_centavos, f.dia_fatura
from fontes f
left join (
  select fonte_id, sum(valor_centavos) as total
  from entradas where data <= current_date group by fonte_id
) e on e.fonte_id = f.id
left join (
  select sp.fonte_id, sum(sp.valor_centavos) as total
  from saida_splits sp
  join saidas sa on sa.id = sp.saida_id
  where sa.data <= current_date
  group by sp.fonte_id
) s on s.fonte_id = f.id;

-- v_saldo_categorias: mesma ideia na subquery de gasto
-- (troca o left join de "saidas" por "where data <= current_date")

-- v_resumo_geral: sem mudança própria — já soma v_saldo_fontes.saldo_centavos,
-- que já vem correto.
```

`v_recorrencias_pendentes` **não muda** — ela já só olha `saidas`/`entradas`
com `recorrente = true`, comparando `date_trunc('month', t.data) <
date_trunc('month', current_date))`; um template futuro só passa a ser
elegível a gerar pendência a partir do mês seguinte ao da sua própria data,
que é exatamente o comportamento desejado.

`criar_saida`/`avaliarFonte` (bloqueio de RN-02/RN-03 e o preview do M12) não
mudam — já leem `saldo_centavos` de `v_saldo_fontes`, que passa a vir correto
automaticamente.

---

## Tarefas

### 14.1 Migration
`create or replace view` nas três views acima, com o filtro de data. Rodar
via `mcp__supabase__apply_migration` como nas milestones anteriores.

### 14.2 `EntradasPage` / `SaidasPage` — indicação visual
Uma linha cuja `data > hoje` ganha um rótulo discreto "agendado" (mesmo peso
visual do ícone `↻` de recorrência, ex. `text-ink-soft`, sem cor de alerta —
não é um problema, é uma informação). Tooltip: "Só conta no saldo a partir de
`<data>`."

### 14.3 `DashboardPage` — "Últimos lançamentos"
`carregarLancamentos` (que já busca via `listarEntradas`/`listarSaidas`)
passa a excluir lançamentos com `data > hoje` dessa lista — ela representa o
que já aconteceu, não uma fila de agendados.

---

## Critérios de aceite

- [ ] Uma Entrada com data futura não altera o saldo da Fonte nem o
      "Disponível para gastar" do Dashboard
- [ ] Uma Saída com data futura não altera o saldo da Fonte nem o gasto da
      Categoria (nem no total acumulado, nem no "neste mês")
- [ ] No dia em que a data chega, o saldo passa a refletir o lançamento sem
      nenhuma ação do usuário — só reabrir a tela
- [ ] Uma Saída futura ainda é bloqueada por RN-02/RN-03 se o saldo **atual**
      da Fonte for insuficiente hoje
- [ ] Lançamentos futuros aparecem nas listas de Entradas/Saídas do mês
      correspondente, marcados como "agendado"
- [ ] Lançamentos futuros não aparecem em "Últimos lançamentos" no Dashboard
- [ ] Um lançamento futuro recorrente só passa a gerar pendência em
      Recorrências a partir do mês seguinte à sua própria data

## Definition of Done

Alguém cria hoje (dia 1) uma Entrada de salário com data 15 — ela some do
saldo da Conta Corrente e do "Disponível para gastar" até lá. No dia 15,
sem fazer nada, o saldo já reflete o valor.
