# M27 — Meio de pagamento previsto na recorrência

**Issue:** [#8](https://github.com/Shadowtampa/lugomFinances/issues/8)

**Objetivo:** indicar em cada recorrência de qual Fonte (ou combinação de Fontes) ela deve ser paga. Serve só para autocontrole: não cria lançamento, não reserva saldo e não muda nenhum saldo.

**Pré-requisitos:** M19, M24.

---

## Decisões (grill de 2026-11-09)

| # | Decisão |
|---|---|
| Armazenamento | Tabela de ligação `recorrencias_fontes` (`recorrencia_id`, `fonte_id`, `user_id`), PK composta, chave estrangeira com `on delete cascade`, RLS. |
| Escrita | `definir_fontes_recorrencia(p_recorrencia_id, p_fonte_ids uuid[])` troca o conjunto inteiro; lista vazia remove. Erros: `RECORRENCIA_INVALIDA` e `FONTE_INVALIDA` (Fonte de outro usuário ou inexistente). |
| Leitura | `v_recorrencias_mes.fontes_previstas` (ids em ordem de nome, `{}` quando vazio); `obterRecorrencia` embute `recorrencias_fontes(fonte_id)`. |
| Valores | Só quais Fontes, sem valor por Fonte. |
| Obrigatório | Não. |
| Fontes elegíveis | Qualquer Fonte não arquivada, cartão incluso. Fonte arquivada depois continua ligada e aparece com "(arquivada)". |
| RN-03 | Fonte restrita sem a Categoria da recorrência na allowlist → aviso no formulário, sem bloquear. |
| Onde aparece | Formulário (checkboxes de Fontes); linha da lista ("Inter + VR"; com 3 ou mais, "3 fontes"); "Previsto: …" no modal "Marcar como paga". |
| Fora | Total a pagar por Fonte no resumo do mês. |

## Tarefas

- Migration `db/migrations/00017_recorrencias_fontes.sql`.
- Tipos/mappers: `Recorrencia.fontesPrevistas`, `RecorrenciaDoMes.fontesPrevistas`; service `definirFontesRecorrencia`; `erros.ts`: `RECORRENCIA_INVALIDA`.
- `features/recorrencias/FontesPrevistasSelect.tsx` + `lib/recorrencias.ts` (`rotuloFontesPrevistas`, `avisosFontesPrevistas`, com teste).
- `RecorrenciaFormModal` e `RecorrenciasPage` (lista + modal "Marcar como paga").

## Critérios de aceite

- [ ] Escolher 1 ou mais Fontes no formulário, salvar e ver os nomes na lista.
- [ ] Editar a recorrência troca o conjunto de Fontes.
- [ ] Fonte restrita sem a Categoria mostra o aviso e deixa salvar.
- [ ] Nenhum saldo muda.
- [ ] `npx tsc -b`, `npm run lint`, `npm test` sem erros novos.
