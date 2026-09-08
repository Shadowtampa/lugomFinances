# M13 — Cartão de Crédito

**Objetivo:** permitir cadastrar um cartão de crédito e lançar Saídas nele. Um
cartão é uma Fonte especial: não tem saldo disponível, tem **limite**, e no
**dia da fatura** gera uma pendência de recorrência para pagar a dívida
acumulada a partir de uma fonte real.

**Pré-requisitos:** M1–M12 concluídos.

---

## Os casos de uso originais

> "Eu crio a fonte, defino o limite, defino a data da fatura; será uma
> cobrança recorrente."

> "Quero cadastrar uma assinatura. Ela vai ser lançada no cartão de crédito.
> Eu abro a tela de Saídas, seleciono o cartão. Se eu tiver limite, consigo
> cadastrar. Se eu não tivesse limite, não conseguiria cadastrar."

Dois fluxos, nenhuma tela nova além da já existente de Fontes/Saídas:

1. **Cadastrar o cartão** — é criar uma Fonte, só que com dois campos a mais
   (`limite`, `dia da fatura`) e sem saldo inicial.
2. **Gastar no cartão** — é uma Saída normal (M8), que já pede Categoria e
   Fonte. O cartão aparece na lista de Fontes como qualquer outra. A única
   mudança é a regra de bloqueio: em vez de "saldo insuficiente" (RN-02), é
   "limite excedido".

A fatura em si — "no dia, gera uma saída com o valor acumulado" — é tratada
como uma recorrência (M10): assistida, aparece em Recorrências, o usuário
escolhe de qual fonte sai o pagamento e confirma.

---

## Modelo mental: cartão é uma Fonte com saldo negativo por natureza

Hoje, `saldo = Σ entradas − Σ splits` (RN-04) e a RN-02 bloqueia qualquer
Saída que deixaria esse saldo negativo. Um cartão inverte a leitura: ele
**só recebe splits** (as compras) e nunca começa com saldo — então seu saldo
é sempre `≤ 0`, e esse número negativo **é a dívida atual**, não um erro.

A fórmula de saldo (RN-04) não muda uma linha — `v_saldo_fontes` já calcula
isso certo. O que muda é:

- **A regra de bloqueio.** Para uma Fonte comum, bloqueia se o saldo ficaria
  negativo. Para um cartão, bloqueia se a dívida (que já é negativa)
  ultrapassaria o limite.
- **A leitura na UI.** Saldo negativo de cartão não é vermelho/erro — é o
  estado normal. Mostrar como "usado" de um limite, no mesmo espírito da
  `BarraLimite` que Categorias (M5) já usa.
- **O que fecha a dívida.** Não existe "fechamento de mês" nem histórico de
  faturas separadas (RN-04 já diz isso: saldo acumula indefinidamente, sem
  fechamento). O cartão tem uma dívida corrente única. Confirmar o pagamento
  da fatura lança uma Entrada no próprio cartão pelo valor pago — que, pela
  mesma fórmula RN-04, zera (ou reduz) a dívida — e uma Saída normal saindo
  da fonte que pagou, na categoria **"Fatura de cartão"**.

Essa Saída de pagamento conta como gasto na categoria "Fatura de cartão" —
**sim, o valor já apareceu antes na categoria real da compra** (ex.:
Assinaturas) **e aparece de novo aqui**. É uma escolha deliberada (mais
simples que criar uma categoria nula/isenta): o usuário decidiu que "quanto
saiu da conta pra pagar cartão" também é uma informação útil de acompanhar
por si só.

---

## Escopo

**Dentro:** campo "é cartão de crédito" no cadastro de Fonte (com limite e
dia da fatura), bloqueio de Saída por limite excedido em vez de saldo
insuficiente, pendência de fatura em Recorrências, confirmação de pagamento
(Entrada no cartão + Saída na fonte pagadora), exibição do cartão (limite
usado) em Fontes e Dashboard.

**Fora:** múltiplas faturas em aberto simultaneamente / parcelamento de
compra no cartão (já existe parcelamento de Saída via M10, não é o mesmo
conceito), pagamento parcial de fatura, juros e multa por atraso, fatura
internacional/multi-moeda, limite compartilhado entre cartões, cartão
adicional/multiusuário.

---

## Regras de negócio novas

**RN-12** — Uma Fonte pode ser um cartão de crédito (`eh_cartao = true`), com
`limite_centavos` e `dia_fatura` obrigatórios nesse caso. O saldo de um
cartão é sempre `≤ 0` e representa a dívida atual. A RN-02 é adaptada para
cartões: uma Saída não bloqueia por deixar o saldo negativo (isso é
esperado), e sim se `dívida_atual + valor_do_split > limite_centavos`.

**RN-13** — Quando um cartão tem dívida em aberto (`saldo < 0`) e o
`dia_fatura` do mês corrente já passou, uma pendência aparece em
Recorrências, seguindo a mesma filosofia assistida da RN-08 (nunca lança
sozinho). Confirmar o pagamento gera, atomicamente: (1) uma Entrada no
próprio cartão pelo valor confirmado, e (2) uma Saída normal, na categoria
"Fatura de cartão", saindo da fonte pagadora escolhida pelo usuário — essa
Saída está sujeita à RN-02/RN-03 normais para a fonte pagadora.

---

## Modelo de dados

```sql
alter table fontes
  add column eh_cartao boolean not null default false,
  add column limite_centavos bigint,
  add column dia_fatura smallint,
  add constraint fontes_cartao_tem_limite_e_dia check (
    not eh_cartao or (limite_centavos is not null and limite_centavos > 0
      and dia_fatura between 1 and 31)
  ),
  add constraint fontes_nao_cartao_sem_limite check (
    eh_cartao or (limite_centavos is null and dia_fatura is null)
  );

alter table entradas
  add column eh_pagamento_fatura boolean not null default false;

alter table saidas
  add column eh_pagamento_fatura boolean not null default false;
```

`eh_pagamento_fatura` existe só para a view de pendências reconhecer "já foi
pago este mês" sem depender de comparar título ou categoria por texto — mais
robusto que casar string.

**Views:**

- `v_saldo_fontes` — sem mudança. A fórmula já funciona pra saldo negativo.
- `v_recorrencias_pendentes` — ganha uma terceira união (além de entradas e
  saídas recorrentes): para cada Fonte com `eh_cartao = true` e saldo
  negativo, se o `dia_fatura` do mês corrente já passou e não existe uma
  Entrada com `eh_pagamento_fatura = true` nesse cartão neste mês, é uma
  pendência com `tipo_lancamento = 'fatura_cartao'`, `valor_sugerido_centavos
  = -saldo_atual` (a dívida, positiva), `fonte_id = <id do cartão>`.

**RPC:**

`confirmar_fatura_cartao(p_cartao_fonte_id uuid, p_fonte_pagadora_id uuid,
p_valor_centavos bigint, p_data date) returns jsonb` — transacional:

1. Valida que `p_cartao_fonte_id` pertence ao usuário e tem `eh_cartao = true`.
2. Garante que existe a categoria "Fatura de cartão" para o usuário (cria se
   não existir, sem limite mensal — mesmo padrão de "Usar sugestões" do M5).
3. Chama `criar_saida` internamente com essa categoria, um único split
   `{fonte_id: p_fonte_pagadora_id, valor_centavos: p_valor_centavos}`, e
   marca `eh_pagamento_fatura = true` na saída — sujeito à RN-02/RN-03
   normais da fonte pagadora (se ela não tem saldo, a operação inteira
   falha e nada é gravado).
4. Insere uma Entrada em `p_cartao_fonte_id`, valor `p_valor_centavos`,
   título `Pagamento fatura <nome do cartão>`, `eh_pagamento_fatura = true`.
5. Retorna o mesmo formato de `ResultadoCriarSaida` (fontes + categoria)
   para alimentar o `PainelSaldo` (M12) já existente.

---

## Tarefas

### 13.1 Schema

Migration com as tabelas/colunas acima. Atualizar `types/api.ts` (`FonteRow`
ganha `eh_cartao`, `limite_centavos`, `dia_fatura`; `EntradaRow`/`SaidaRow`
ganham `eh_pagamento_fatura`) e `types/domain.ts` (`Fonte` ganha `ehCartao`,
`limiteCentavos`, `diaFatura`; mapeamento em `mappers.ts`).

### 13.2 RPC `criar_saida` — bloqueio por limite

Adaptar a checagem de saldo insuficiente: se a fonte do split tem
`eh_cartao = true`, a condição de bloqueio vira `dívida_atual +
valor_do_split > limite_centavos`, com um novo código de erro
`LIMITE_CARTAO_EXCEDIDO` (mesmo formato de detalhe do `SALDO_INSUFICIENTE`,
pra reaproveitar o parsing que `SaidaFormModal.aplicarErroServidor` já faz).
Fontes normais continuam com a checagem de saldo de sempre.

### 13.3 RPC `confirmar_fatura_cartao`

Implementar conforme o modelo de dados acima.

### 13.4 View `v_recorrencias_pendentes`

Adicionar a união de faturas de cartão pendentes.

### 13.5 `FonteFormModal` — cadastro do cartão

Checkbox "É um cartão de crédito". Quando marcado, mostra `MoneyInput`
"Limite" e um campo numérico "Dia da fatura" (1–31), no mesmo padrão visual
do "Dia da recorrência" que `EntradaFormModal`/`SaidaFormModal` já usam.
Quando é edição de uma fonte já usada em Saídas, não permitir desmarcar
"é cartão" (evita saldo negativo órfão sem sentido) — mensagem explicando.

### 13.6 `SaidaFormModal` / `elegibilidade.ts` — limite em vez de saldo

`avaliarFonte` ganha o mesmo tipo de checagem client-side que já existe pra
Fonte restrita (RN-03): se a fonte é cartão e `dívida_atual +
valorNecessario > limite`, marcar como não elegível no `<select>`, com
motivo `"limite insuficiente"`. O preview de saldo do M12 ("Fonte: atual →
projetado") já funciona sem mudança — `saldoCentavos` de um cartão já é
negativo, então o texto vira algo como "Nubank: -R$ 450,00 → -R$ 550,00";
ok deixar assim, é literal e correto.

### 13.7 Exibição do cartão — Fontes e Dashboard

Em `FontesPage`, o card de um cartão mostra uma barra "usado/limite" em vez
do valor de saldo cru — visual equivalente à `BarraLimite` de Categorias,
mas usando `limite_centavos` fixo (não acumulado por mês). Em
`DashboardPage`, o agregado "Disponível para gastar" **não soma** o saldo de
cartões (dívida não é dinheiro disponível); cartões aparecem numa seção
própria "Cartões de crédito" com o mesmo indicador de uso.

### 13.8 `RecorrenciasPage` — pendência de fatura

Novo ramo de UI para `tipo_lancamento = 'fatura_cartao'`: mostra o cartão, a
dívida atual, e ao confirmar pede a fonte pagadora (`<Select>` só com fontes
não-cartão) e o valor (pré-preenchido com a dívida, editável — mesma
filosofia de RN-08). Confirmar chama `confirmar_fatura_cartao` e mostra o
`PainelSaldo` (M12) com o resultado.

---

## Critérios de aceite

- [ ] Criar uma Fonte marcando "é cartão de crédito" exige limite e dia da
      fatura; sem marcar, esses campos não aparecem
- [ ] Uma Saída lançada num cartão não verifica saldo — verifica limite
- [ ] Saída que excede o limite do cartão é bloqueada com mensagem clara,
      nada é gravado
- [ ] Cartão aparece em Fontes com "usado/limite", nunca como saldo negativo
      "de erro"
- [ ] Dashboard não soma dívida de cartão em "Disponível para gastar"
- [ ] No dia da fatura, com dívida em aberto, a pendência aparece em
      Recorrências
- [ ] Confirmar a fatura gera uma Entrada no cartão (dívida zera ou reduz) e
      uma Saída na categoria "Fatura de cartão" saindo da fonte escolhida
- [ ] Pagamento da fatura respeita RN-02 da fonte pagadora — sem saldo lá,
      nada é gravado e a pendência continua
- [ ] Categoria "Fatura de cartão" é criada automaticamente na primeira
      confirmação, se ainda não existir
- [ ] Depois de paga, a fatura não aparece de novo como pendente no mesmo mês

## Definition of Done

Alguém cadastra um cartão com limite e dia de fatura, lança uma assinatura
nele (bloqueada corretamente se estourar o limite), e no dia da fatura vê a
pendência em Recorrências — confirma escolhendo a Conta Corrente como
pagadora e a dívida do cartão zera, com o valor aparecendo como saída de
"Fatura de cartão" saindo da conta.
