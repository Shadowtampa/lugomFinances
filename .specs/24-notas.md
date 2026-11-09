# M24 — Notas

**Issue:** [#4](https://github.com/Shadowtampa/lugomFinances/issues/4)

**Objetivo:** escrever uma observação livre em Saídas, Entradas e Recorrências.

**Pré-requisitos:** M19, M22.

---

## Decisões (grill de 2026-11-09)

| # | Decisão |
|---|---|
| Armazenamento | Coluna `nota text` (opcional, 1–500 caracteres) em `entradas`, `saidas` e `recorrencias`. Não é tabela genérica, porque cada nota pertence a um registro só. |
| Recorrência | Nota **fixa** na recorrência (vale para todos os meses). Para algo de um mês específico, usar a nota da Saída que pagou. `v_recorrencias_mes` expõe `nota`. |
| Saída | Nota gravada pela RPC `definir_nota_saida(p_saida_id, p_nota)`, que não passa por `criar_saida`/`atualizar_saida`. Ela não toca em valor, data, Categoria nem splits. Erros: `NOTA_INVALIDA` (> 500) e `SAIDA_INVALIDA` (inexistente). Vazia remove. |
| Entrada / Recorrência | Nota gravada junto com o formulário (update direto na tabela, como os outros campos). |
| UI | Campo "Nota (opcional)" (textarea, contador a partir de 450) nos formulários. Na lista, ícone 📝 nas linhas com nota; clique ou toque mostra o texto. |
| Importadas | "+ Nota" abre um campo no card individual; a nota é gravada no lançamento criado ao clicar em Confirmar. O "Confirmar todas" ignora notas. |
| Fora | Busca por texto da nota. |

## Tarefas

- Migration `db/migrations/00015_notas.sql`: colunas, `definir_nota_saida` e `v_recorrencias_mes` com `nota`.
- Tipos, mappers (`nota` em Entrada/Saída/Recorrência/RecorrenciaDoMes; `deEntrada`/`deRecorrencia` enviam `nota`), `definirNotaSaida`. `confirmarImportada` devolve `saidaId`/`entradaId`.
- `features/notas/CampoNota.tsx`, `IndicadorNota.tsx`, `limites.ts`.
- Formulários de Saída, Entrada e Recorrência; listas de Saídas, Entradas e Recorrências; card de Importadas.
- `erros.ts`: `NOTA_INVALIDA`.

## Critérios de aceite

- [ ] Criar e editar uma nota em Entrada, Saída e Recorrência.
- [ ] O ícone aparece só nas linhas com nota, e o texto abre no clique ou toque.
- [ ] Editar a nota de uma Saída não altera saldo nem splits.
- [ ] Nota com mais de 500 caracteres é recusada com mensagem amigável.
- [ ] `npx tsc -b`, `npm run lint`, `npm test` sem erros novos.
