# M25 — Limite de Categoria sem acúmulo

**Issue:** [#5](https://github.com/Shadowtampa/lugomFinances/issues/5)

**Objetivo:** acabar com o limite acumulativo de Categoria, que multiplicava o limite pelos meses de vigência e deixava os valores inflados. O limite passa a valer só no mês corrente.

**Pré-requisitos:** M5, M14.

---

## Decisões (grill de 2026-11-09)

| # | Decisão |
|---|---|
| Regra (RN-05) | `saldo = limite mensal − gasto do mês corrente` (saídas com `data` entre o dia 1º e hoje). Zera todo dia 1º; nada passa de um mês para o outro. |
| RN-06 | Continua: estourar não bloqueia, só deixa o saldo em vermelho. |
| `vigencia_inicio` | Removido do formulário e do banco (drop da coluna). Se o acúmulo voltar com outra regra, volta junto. |
| Telas | Categorias e Dashboard mostram o gasto do mês contra o limite mensal. Categoria sem limite mostra o gasto do mês. Histórico por mês fica fora. |
| Duplicadas | Investigado: as Categorias com nome repetido pertencem a outra conta do banco (uma conta de teste, sem lançamentos). A RLS já as esconde, e a conta principal não tem nenhum nome repetido. Nada foi arquivado. |

## Tarefas

- Migration `db/migrations/00016_categoria_sem_acumulo.sql`: recria `v_saldo_categorias` só com `limite_mensal_centavos`, `gasto_mes_atual_centavos` e `saldo_disponivel_centavos` (as RPCs já liam só esses dois últimos) e faz drop de `categorias.vigencia_inicio`.
- Tipos e mappers sem `vigenciaInicio`, `mesesAtivos`, `limiteAcumuladoCentavos` e `totalGastoCentavos`.
- `BarraLimite` com `limiteMensalCentavos` + `gastoMesAtualCentavos`; Dashboard ordena pelo percentual do mês.
- `CategoriaFormModal` sem "Opções avançadas / Início da vigência".
- `00-VISAO-GERAL.md`: glossário, RN-05 e modelo de dados.

## Critérios de aceite

- [ ] Gasolina (limite R$200, gasto de R$540 no mês) mostra −R$340 em vermelho.
- [ ] O formulário de Categoria não tem mais "vigência".
- [ ] `v_saldo_categorias` não tem mais `meses_ativos` nem `limite_acumulado_centavos`.
- [ ] Criar uma Saída continua mostrando o saldo da Categoria no painel de feedback.
- [ ] `npx tsc -b`, `npm run lint`, `npm test` sem erros novos.
