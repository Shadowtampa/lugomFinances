# M21 — Importação retroativa + conciliação de cartão

**Objetivo:** escolher desde quando cada conta da Pluggy importa transações (não só "depois do vínculo"), conciliar o pagamento de fatura (débito na conta + crédito no cartão viram um lançamento só) e avisar quando o saldo do app não bate com o da Pluggy.

**Pré-requisitos:** M20 em produção.

---

## Decisões (grill de 2026-11-09)

| # | Decisão |
|---|---|
| Corte retroativo | A conta vinculada tem um **"importar desde"** (= `data_corte + 1`) editável. O padrão no vínculo é o dia 1º do mês corrente. Nesta virada: Inter, GOLD e Mercado Pago desde **01/11/2026**. |
| Saldo inicial | Recalculado em duas etapas. (1) Mudar o corte apaga o saldo inicial antigo e marca a conta como `saldo_inicial_pendente_desde = now()`. (2) Depois de uma sincronização bem-sucedida iniciada depois dessa marca, `aplicar_saldos_iniciais_pendentes()` lança o novo saldo inicial em `data_corte` = saldo Pluggy − Σ(efeito de **todas** as importadas da conta com data > corte, em qualquer estado). O worker continua sem acesso a `entradas`/`saidas`. |
| Bloqueio | Mudar o corte falha com `CORTE_COM_CONFIRMADAS` se houver importada **confirmada** com `data <= novo corte`, porque o lançamento dela ficaria fora da janela e seria contado em dobro. Importadas pendentes/ignoradas fora da nova janela são apagadas. |
| Pagamento de fatura | Uma Saída pendente numa conta `BANK` e uma Entrada pendente num cartão `CREDIT`, com o mesmo valor e a mesma data (±3 dias), formam um **par**. Ele aparece como um card só em Importadas e é confirmado com `confirmar_pagamento_fatura` (usa `confirmar_fatura_cartao`, M13). Não gera gasto em Categoria. |
| Parcelas | Uma parcela cuja compra é anterior ao corte (`data_compra <= data_corte`) já está dentro do saldo inicial (a Pluggy conta o limite usado). Ela chega com a sugestão "Ignorar: já contada no saldo inicial" e fica fora do "Confirmar todas". Parcela de compra nova vira uma Saída por parcela, na data em que lança. |
| Redundância | `v_conciliacao_contas` compara, por conta vinculada, o saldo Pluggy com o **saldo esperado do app** = saldo da Fonte + efeito das importadas pendentes. Se divergir, aparece um aviso com os dois valores em Conexões e no card da Fonte. Nunca ajusta sozinho. |

## Fatos da API Pluggy (conferidos em 2026-11-09)

- O `balance` do cartão é o limite usado (inclui parcelas futuras ainda não lançadas). Ele pode ficar defasado em relação às transações por minutos: no dia 09/11 o sync das 13:28 gravou 294,31 e a Pluggy mudou para 13,25 às 13:35.
- O pagamento da fatura aparece duas vezes: na conta, como `DEBIT POSTED` ("Pagamento efetuado - Pagamento Fatura"); no cartão, com `amount < 0` (`PENDING` até a fatura fechar).
- Parcela futura não existe como transação até lançar. `creditCardMetadata.purchaseDate` traz a data da compra original, e `installmentNumber`/`totalInstallments` o número da parcela.

---

## Escopo

**Dentro:** migration 00013, campo `data_compra` no worker, tela Conexões (vincular com "importar desde", alterar corte, aviso de divergência), tela Importadas (pares de pagamento, sugestão de ignorar parcela), aviso no card da Fonte.

**Fora:** transferência entre contas próprias (Inter ↔ Mercado Pago), Bills API, tratar status `LOGIN_ERROR`/`OUTDATED` no worker.

---

## Tarefas

### 21.1 Migration `db/migrations/00013_importacao_retroativa.sql`

- `pluggy_contas` ganha `saldo_inicial_entrada_id uuid references entradas on delete set null`, `saldo_inicial_saida_id uuid references saidas on delete set null` e `saldo_inicial_pendente_desde timestamptz`. Backfill: ligar os saldos iniciais que já existem (título "Saldo inicial" / "Fatura em aberto (saldo inicial)", na Fonte da conta, com `data = data_corte`).
- `transacoes_importadas` ganha `data_compra date` (a data da compra quando é parcela).
- `vincular_conta_pluggy(..., p_data_inicio date default null)`: `data_corte = coalesce(p_data_inicio, 1º do mês) − 1`. Não lança mais o saldo inicial na hora; só marca `saldo_inicial_pendente_desde`.
- `alterar_corte_conta(p_pluggy_account_id, p_data_inicio)`. Erros: `CONTA_NAO_VINCULADA`, `CORTE_INVALIDO` (início no futuro), `CORTE_COM_CONFIRMADAS`. Apaga o saldo inicial antigo e as importadas não confirmadas fora da janela, e marca como pendente.
- `aplicar_saldos_iniciais_pendentes()` → int (quantas aplicou). Saldo inicial no padrão do app: cartão = −dívida. Resultado > 0 → Entrada "Saldo inicial"; < 0 em cartão → Saída "Fatura em aberto (saldo inicial)" via `criar_saida` (Categoria "Ajuste de saldo"); < 0 em conta → não lança (RN-02), e a conciliação mostra a diferença.
- `v_importadas_pendentes` ganha `sugerir_ignorar_parcela`.
- `v_pares_pagamento_fatura` (`banco_id`, `cartao_id`, `valor_centavos`, `data`, Fontes) e `confirmar_pagamento_fatura(p_banco_id, p_cartao_id)` → erro `PAR_INVALIDO`. Marca as duas importadas como confirmadas (`saida_id` no banco, `entrada_id` no cartão).
- `v_conciliacao_contas` (`fonte_id`, `saldo_app_centavos`, `pendentes_centavos`, `saldo_pluggy_centavos`, `saldo_inicial_pendente`). A diferença (`pluggy − app − pendentes`) é calculada no mapper.

### 21.2 Worker

- `normalizarTransacao` devolve `dataCompra` (`purchaseDate` no fuso de SP, só quando é parcela) e o upsert grava `data_compra`. Teste novo em `normalizar.test.ts`.

### 21.3 Front

- Tipos, mappers e services: `alterarCorteConta`, `aplicarSaldosIniciaisPendentes`, `listarParesPagamentoFatura`, `confirmarPagamentoFatura`, `listarConciliacao`; `vincularConta` aceita `dataInicio`. `sincronizarAgora` chama `aplicarSaldosIniciaisPendentes` depois de uma sincronização com sucesso.
- Conexões: o modal de vínculo tem "Importar desde" (padrão 1º do mês). Conta vinculada mostra "desde DD/MM" + botão **Alterar** (modal com data, salva → sincroniza). Divergência e "saldo inicial aguardando sincronização" aparecem por conta.
- Importadas: seção **Pagamentos de fatura** no topo (um card por par, botão Confirmar). As importadas de um par saem da lista comum. Parcela com `sugerirIgnorarParcela` mostra o selo e um botão Ignorar em destaque, e fica fora do lote.
- Fontes: card de Fonte da Pluggy com divergência mostra "Pluggy: R$ X".

### 21.4 Documentação

- `00-VISAO-GERAL.md`: a RN-15 passa a falar em "importar desde"; RN-16 (conciliação de pagamento de fatura e parcelas anteriores ao corte); views novas; roadmap.

## Critérios de aceite

- [ ] Mudar "importar desde" para 01/11 e sincronizar traz as transações de novembro, e o saldo inicial é recriado em 31/10.
- [ ] Depois de confirmar tudo (com o par de pagamento conciliado e a parcela anterior ignorada), o saldo de cada Fonte é igual ao saldo Pluggy, e a conciliação não mostra divergência.
- [ ] O par Inter −281,06 / GOLD +281,06 aparece como um card só; ao confirmar, a Inter cai 281,06 e o GOLD sobe 281,06, sem gasto em Categoria.
- [ ] `CORTE_COM_CONFIRMADAS` bloqueia a mudança quando há confirmada fora da nova janela.
- [ ] `npm run build`, `npm run lint`, `npm test` sem erros novos.

## Definition of Done

Em produção: GOLD mostra R$13,25 usado; Inter bate com o saldo do banco; Importadas lista novembro inteiro.
