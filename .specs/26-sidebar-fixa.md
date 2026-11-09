# M26 — Sidebar fixa, conteúdo rolável

**Issue:** [#6](https://github.com/Shadowtampa/lugomFinances/issues/6)

**Objetivo:** no desktop, a sidebar fica parada enquanto o conteúdo rola.

## Decisões (2026-11-09)

| # | Decisão |
|---|---|
| Onde | Só desktop (`md:`+). No mobile o menu já é um drawer sobreposto (M16). |
| Header | O `PageHeader` rola junto com o conteúdo. |
| Como | A `<nav>` do desktop fica `sticky top-0 h-screen overflow-y-auto`. A rolagem continua sendo a da janela, e não um container interno, para não quebrar modais, toasts e o comportamento nativo de rolagem. Se o menu for mais alto que a tela, ele rola sozinho. |

## Critérios de aceite

- [ ] No desktop, rolar uma lista longa (ex.: Saídas) mantém a sidebar inteira visível, com "Sair" e a versão no rodapé.
- [ ] O mobile não muda.
- [ ] `npx tsc -b`, `npm run lint`, `npm test` sem erros novos.
