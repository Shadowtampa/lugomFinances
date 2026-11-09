# M22 — Apelidos de estabelecimento

**Objetivo:** dar um nome reconhecível a um estabelecimento que chega da Pluggy com um nome ilegível (`Compra no débito - Esthneygomesguima Santarem Bra` → "Açaí do Lester"). O apelido aparece em toda importada e em todo lançamento vindo da Pluggy com o mesmo estabelecimento, inclusive nos já confirmados.

**Pré-requisitos:** M21 em produção.

---

## Decisões (grill de 2026-11-09)

| # | Decisão |
|---|---|
| Chave | `chave_estabelecimento(descricao)` deriva a chave da descrição da Pluggy: minúsculas, sem o prefixo até o primeiro ` - ` (`Compra no débito - `, `Pix enviado  - `, `Pagamento de Título - `…), cortada no primeiro trecho de 2+ espaços (cidade e país do cartão) e com espaços colapsados. Se sobrar vazio, usa a descrição inteira em minúsculas. O casamento é **exato** pela chave; não há regra "contém". |
| Tabela própria | `apelidos_estabelecimento` (`user_id`, `chave` única por usuário, `apelido`). O apelido **não é gravado** em lugar nenhum: é aplicado na leitura. Criar, editar ou apagar um apelido muda na hora todas as linhas com aquela chave. |
| Onde aparece | Importadas pendentes; Saídas e Entradas confirmadas a partir de uma importada (via `transacoes_importadas.saida_id` / `entrada_id`). O apelido é o texto principal e a descrição original aparece pequena embaixo. |
| Título editado vence | Numa Saída/Entrada confirmada, o apelido só aparece se o título salvo ainda for a descrição original da importada. Se o usuário editou o título, o título dele vence. |
| Não mexe em mais nada | O apelido não muda Categoria, Fonte, título salvo nem forma de pagamento. Lançamentos manuais não têm chave e não recebem apelido. |
| Onde criar | Botão "Dar apelido" no card da importada; ação "Dar apelido" no menu da linha de Saídas e Entradas vindas da Pluggy; lista com editar e excluir em Conexões → Apelidos. |

---

## Escopo

**Dentro:** migration 00014, campos computados para Saída/Entrada, apelido na view de importadas, modal de apelido, telas Importadas, Saídas, Entradas e Conexões.

**Fora:** regra "contém", apelido para lançamento manual, sugestão de Categoria pela chave, apelidos no Dashboard.

---

## Tarefas

### 22.1 Migration `db/migrations/00014_apelidos_estabelecimento.sql`

- `chave_estabelecimento(text) returns text`, `immutable`.
- Tabela `apelidos_estabelecimento` (`id`, `user_id`, `chave`, `apelido`, `created_at`, `updated_at`), `unique (user_id, chave)`, checks de tamanho (`apelido` com 1–60 caracteres sem espaços nas pontas). Tem RLS própria e trigger `set_user_id_from_auth`.
- `definir_apelido(p_chave text, p_apelido text)`: faz upsert; apelido vazio ou `null` apaga. Erro `APELIDO_INVALIDO` (chave vazia ou apelido com mais de 60 caracteres).
- Campos computados do PostgREST (funções `stable`, `security invoker`), sobrecarregados por `saidas` e `entradas`:
  - `chave_estabelecimento(saidas|entradas)`: chave da importada ligada, ou `null` se o lançamento for manual.
  - `apelido_estabelecimento(saidas|entradas)`: apelido da chave, só se `titulo = descricao` da importada; senão `null`.
  - `descricao_pluggy(saidas|entradas)`: descrição original da importada, ou `null`.
- `v_importadas_pendentes` ganha `chave_estabelecimento` e `apelido`.

### 22.2 Front

- Tipos: `ApelidoEstabelecimentoRow`/`ApelidoEstabelecimento`. `Saida`/`Entrada` ganham os campos opcionais `chaveEstabelecimento`, `apelido` e `descricaoPluggy`, e `TransacaoImportada` ganha `chaveEstabelecimento`/`apelido`. Os mappers fazem a tradução.
- Service `src/services/apelidos.ts`: `listarApelidos`, `definirApelido(chave, apelido)`, `removerApelido(chave)`. `listarSaidas`/`obterSaida`/`listarEntradas`/`obterEntrada` pedem os campos computados.
- `features/apelidos/ApelidoModal.tsx` (campo com o apelido, mostra a descrição de exemplo e a chave; salvar e remover) e `TituloComApelido` (apelido em cima, original pequeno embaixo).
- Importadas: "Dar apelido" / "Editar apelido" no card; a linha mostra o apelido.
- Saídas e Entradas: a linha mostra o apelido. O menu ganha "Dar apelido" quando há chave.
- Conexões: seção **Apelidos** (chave → apelido, editar, excluir).
- `erros.ts`: `APELIDO_INVALIDO`.

### 22.3 Documentação

- `00-VISAO-GERAL.md`: glossário (Apelido de estabelecimento), RN-17, tabela nova, roadmap.

## Critérios de aceite

- [ ] Dar o apelido "Açaí do Lester" à importada `Compra no débito - Esthneygomesguima…` faz a Saída já confirmada com essa descrição aparecer como "Açaí do Lester" em Saídas, com a descrição original embaixo.
- [ ] Uma nova importada do mesmo estabelecimento já chega com o apelido.
- [ ] Editar o título de uma Saída faz o apelido sumir dela; as outras continuam com o apelido.
- [ ] Apagar o apelido em Conexões volta todas as linhas para a descrição original.
- [ ] Categoria, Fonte e título salvo não mudam ao criar, editar ou apagar um apelido.
- [ ] `npm run build`, `npm run lint`, `npm test` sem erros novos.
