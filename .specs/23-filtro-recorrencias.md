# M23 — Filtro de recorrências pagas

**Issue:** [#3](https://github.com/Shadowtampa/lugomFinances/issues/3)

**Objetivo:** na tela Recorrências, filtrar a lista do mês por status, para ver só o que falta pagar (ou só o que já foi pago).

**Pré-requisitos:** M19.

---

## Decisões (grill de 2026-11-09)

| # | Decisão |
|---|---|
| Formato | Botões no topo da lista: **Todas · A pagar · Pagas**. "A pagar" = `pendente` + `atrasada` (`statusDaRecorrencia`). |
| Padrão | **A pagar**. |
| Resumo | "Pago X de Y / Falta Z" continua sobre o mês inteiro, sem depender do filtro. |
| URL | O filtro fica em `?status=todas|a-pagar|pagas`. Sem o parâmetro (ou com valor inválido) vale `a-pagar`. Trocar de mês preserva o filtro. |
| Lista vazia pelo filtro | Mensagem específica: "Tudo pago em {mês}." para A pagar; "Nada pago em {mês} ainda." para Pagas. |
| Faturas de cartão | A seção de faturas não é afetada pelo filtro. |

## Tarefas

- `src/lib/recorrencias.ts`: tipo `FiltroRecorrencia`, `lerFiltroRecorrencia(valor)` e `filtrarRecorrencias(itens, filtro)` (paga = tem pagamento), com teste em `recorrencias.test.ts`.
- `src/pages/RecorrenciasPage.tsx`: botões, leitura e escrita do `?status=` e mensagem de lista vazia.

## Critérios de aceite

- [ ] Abrir Recorrências mostra só as não pagas.
- [ ] "Pagas" mostra só as pagas; "Todas" mostra tudo.
- [ ] O resumo do mês não muda com o filtro.
- [ ] O filtro persiste na URL ao trocar de mês e ao recarregar.
- [ ] `npx tsc -b`, `npm run lint`, `npm test` sem erros novos.
