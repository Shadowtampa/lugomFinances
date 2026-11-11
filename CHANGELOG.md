# Changelog

Cada milestone sobe a versão **minor** e ganha uma entrada aqui, no mesmo commit. Ajuste sem spec sobe a **patch**. A versão exibida no menu vem do `package.json`.

## 2.13.0 — 2026-11-10

**M33: Dashboard — Comportamento financeiro e calendário de calor** (#19, épico #11)

- Nova aba **Comportamento** no Painel (`/dashboard/comportamento`), com o mesmo filtro de período.
- Ticket médio, gasto médio diário, frequência de compras, dia de maior gasto e crescimento das Saídas contra o período anterior.
- Gráficos: evolução dos gastos diários, **calendário de calor**, Saídas por mês, gasto por dia da semana (total e média por dia) e evolução do ticket médio.
- Ranking dos 10 estabelecimentos que mais receberam, com o apelido do estabelecimento aplicado.
- Dias decorridos contam até hoje; sem Saídas ou sem base, o indicador mostra "—". Gastos recorrentes ficam no Planejamento Financeiro.
- Banco: migration `00023_indicadores_comportamento.sql` (view `v_saidas_lancamento`, só leitura).

## 2.12.0 — 2026-11-10

**M32: Dashboard — Cartões e meios de pagamento** (#18, épico #11)

- Nova aba **Cartões** no Painel (`/dashboard/cartoes`), com o mesmo filtro de período.
- Compras no cartão (com variação), ticket médio, maior compra e fatura média (últimos 6 meses com fatura paga).
- Utilização do limite por cartão e no total (hoje), Saídas por instituição (banco conectado; sem conexão = Manual), participação por meio de pagamento e faturas pagas por mês.
- **Compromissos futuros** por mês de vencimento (12 meses): parcelas restantes de compras no cartão (a partir do que a Pluggy já importou) + Planejamentos parcelados não pagos. Não é dívida e não entra no Patrimônio líquido.
- Pagamentos de fatura nunca entram em compras; Saída em várias Fontes é rateada pelo split.
- Banco: migration `00022_indicadores_cartoes.sql` (views `v_saidas_fonte`, `v_pagamentos_fatura_mes`, `v_parcelas_cartao_restantes`, só leitura).

## 2.11.0 — 2026-11-10

**M31: Dashboard analítico — Visão geral, Categorias e Planejado × realizado** (#17, épico #11)

- O Painel ganha abas: **Hoje** (o painel de sempre), **Visão geral** e **Categorias** (`/dashboard/visao-geral`, `/dashboard/categorias`). No mobile as abas viram chips.
- **Filtro de período** nas abas analíticas: Mês atual (padrão), Mês anterior, Últimos 3/6/12 meses, Ano atual e Personalizado. Fica na URL e acompanha a troca de aba. Todo indicador compara com o período anterior de mesmo tamanho.
- **Visão geral:** Entradas, Saídas, Saldo operacional, Taxa de economia, Comprometimento da renda e Patrimônio líquido (hoje); gráficos de Entradas × Saídas por mês, Saldo operacional e Entradas por Fonte.
- **Categorias:** rosca e ranking (total, participação, lançamentos, ticket médio, variação), concentração das 3 e 5 maiores, maior crescimento em % e em R$, evolução das 5 maiores.
- **Planejado × realizado:** limite mensal da Categoria × meses do período, com as faixas Dentro (≤70%), Atenção, Próximo do limite (>90%) e Excedido (>100%), e projeção de fechamento só no Mês atual, marcada como estimativa.
- Fora das somas: pagamento de fatura, saldo inicial da Pluggy, lançamentos futuros e Entradas em cartão. Sem Entradas ou sem base anterior, o indicador mostra "—".
- Fórmulas só em `src/lib/indicadores.ts` (testadas); gráficos com `recharts`.
- Banco: migration `00021_indicadores_dashboard.sql` (views `v_saidas_dia_categoria` e `v_entradas_dia_fonte`, só leitura).
- Glossário: Patrimônio líquido, Compromisso futuro e Transferência entre Fontes próprias.

## 2.10.3 — 2026-11-10

**Planejamento no mobile** (ajuste sem spec)

- Pago e Falta viram duas linhas empilhadas (sem porcentagem nem barra).
- "Total geral" vira um alternador: começa fechado e abre Manuais, Automáticas, Recorrentes e Parceladas.
- Filtros de Status e Duração empilhados.
- Linhas da lista sem o dia; "Marcar como paga" e "Desmarcar pagamento" vão para o menu ⋯.
- Botão "Novo planejamento" com "+" (desktop e mobile), centralizado no mobile.

## 2.10.2 — 2026-11-10

**Cards Pago / Falta mais largos** (ajuste sem spec)

- Os cards do Planejamento ganham largura e o valor não quebra mais entre "R$" e o número.

## 2.10.1 — 2026-11-10

**Filtros do Planejamento em drop-down colorido** (ajuste sem spec)

- Os filtros de Status e Duração passam de botões em pílula para drop-downs com rótulo, ponto e fundo coloridos conforme a opção (A pagar = vermelho, Pagas = verde, Recorrentes = azul, Parceladas = âmbar).

## 2.10.0 — 2026-11-10

**M30: Planejamento por Duração e Forma de pagamento** (#12)

- O Tipo de Planejamento do M29 saiu: misturava duração, forma de pagamento e natureza do gasto, e um mesmo planejamento cabia em mais de um tipo. Agora cada planejamento tem **Duração** (recorrente ou parcelado, derivada das parcelas) + **Forma de pagamento** (Manual ou Automática, campo novo) + Categoria.
- Subseções da aba: **Geral / Manuais / Automáticas** (sidebar no desktop, chips no mobile). Endereços antigos como `/recorrencias/assinaturas` voltam para a Geral.
- Novo filtro de Duração (Todas / Recorrentes / Parceladas) junto do filtro de status, aplicado no banco.
- Cards Pago / Falta centralizados, maiores, com ícone, cores e barra de progresso; seguem a subseção e o filtro de Duração.
- Geral mostra Manuais, Automáticas, Recorrentes, Parceladas e Total geral. Cada linha mostra o selo Manual/Auto e a Categoria, inclusive no mobile.
- Formulário: "Forma de pagamento" (padrão Manual) no lugar de "Tipo de planejamento".
- Banco: migration `00020_forma_pagamento.sql` (`recorrencias.forma_pagamento`, remove `tipos_planejamento`, recria `v_recorrencias_mes`, `v_sugestoes_recorrencia` e `v_planejamento_resumo`). Registros atuais: cartão previsto = Automática; o resto = Manual.

## 2.9.0 — 2026-11-10

**M29: Planejamento Financeiro** (#10)

- A aba Recorrências vira **Planejamento Financeiro**: sidebar com subseções aninhadas (Geral + Assinaturas, Transferências manuais, Compras parceladas, Dívidas, Contas) e, no mobile, chips no topo da página. Rota continua `/recorrencias`; subseções em `/recorrencias/:tipo`.
- Todo planejamento tem um **Tipo de Planejamento** obrigatório (padrão Contas, também ao criar de outra subseção). Os já existentes viram Contas. Categoria de gasto continua opcional.
- Título "Planejamento Financeiro" com subtítulo "Planejamento Financeiro - <Tipo>", dois cards Pago / Falta ao lado do título (calculados no banco para o mês e Tipo selecionados) e, na Geral, quantitativos por Tipo + total.
- Lista paginada pela API, 10 por vez, com "Carregar mais"; filtro de status passa a ser feito no banco.
- Botão "Novo planejamento"; formulário "Novo Planejamento Financeiro"; textos de UI trocam "recorrência" por "planejamento".
- Banco: migration `00019_tipos_planejamento.sql` (tabela `tipos_planejamento`, `recorrencias.tipo_planejamento_id`, `v_recorrencias_mes` com o Tipo, `v_planejamento_resumo`).

## 2.8.0 — 2026-11-09

**M28: Vincular Saída a uma Recorrência** (#9)

- Novo campo opcional "Recorrência" no formulário de Saída: lista as contas não pagas do mês da data, as atrasadas dos 3 meses anteriores e as marcadas como pagas sem lançamento. Escolher uma marca a competência como paga por essa Saída.
- Numa Saída nova, escolher a recorrência preenche título, valor previsto, Categoria e a Fonte prevista (quando há só uma), sem sobrescrever o que já foi digitado.
- Editar a Saída mantém o vínculo; limpar ou trocar o campo devolve a competência antiga para pendente. Excluir a Saída também.
- Lista de Saídas mostra "↻ Aluguel nov/2026"; na tela Recorrências, a competência paga mostra a Saída que a quitou, com link para editá-la.
- Banco: migration `00018_vincular_saida_recorrencia.sql` (vínculo 1:1, cascade, `criar_saida`/`atualizar_saida` com `p_recorrencia_id`/`p_competencia`).
- Specs passam a viver nas issues do GitHub (CLAUDE.md).

## 2.7.4 — 2026-11-09

**Editar Saída não acusa mais saldo insuficiente** (ajuste sem spec)

- Ao editar uma Saída (ex.: trocar a Categoria), o formulário comparava o valor com o saldo atual da Fonte, que já tinha essa mesma Saída descontada — a Saída "concorria com ela mesma" e era bloqueada por saldo insuficiente. Agora, na edição, cada Fonte conta com o valor do split original devolvido, igual ao que o banco já fazia em `atualizar_saida`.

## 2.7.3 — 2026-11-09

**Clique na Saída edita** (ajuste sem spec)

- Clicar numa Saída da lista abre a edição, como já acontecia em Entradas. A divisão entre Fontes de uma Saída com vários splits agora abre no botão ▸ ao lado das Fontes.

## 2.7.2 — 2026-11-09

**Identidade das Fontes nas listas** (ajuste sem spec)

- O selo da marca aparece ao lado da Fonte em Saídas (inclusive em cada split), Entradas, Recorrências (meio previsto e "Marcar como paga") e no seletor de Fontes previstas. Fontes sem identidade continuam com a bolinha de cor.
- Os cards da tela Fontes ganharam um fundo leve na cor da Fonte.

## 2.7.1 — 2026-11-09

**Identidade visual das Fontes** (ajuste sem spec)

- Inter, Cartão Inter, Mercado Pago e Flash aparecem com nome, cor da marca e um selo nos cards de Fontes e no Dashboard. A identidade fica fixa no código (`src/lib/identidadeFontes.ts`).

## 2.7.0 — 2026-11-09

**M27: Meio de pagamento previsto na recorrência** ([#8](https://github.com/Shadowtampa/lugomFinances/issues/8), `.specs/27-meio-pagamento-recorrencia.md`)

- Cada recorrência pode indicar de qual Fonte (ou combinação de Fontes) vai ser paga. É só controle: não lança nada nem reserva saldo.
- Os nomes aparecem na linha da recorrência e no "Marcar como paga".
- Aviso quando uma Fonte restrita não aceita a Categoria da recorrência.

## 2.6.0 — 2026-11-09

**M26: Sidebar fixa** ([#6](https://github.com/Shadowtampa/lugomFinances/issues/6), `.specs/26-sidebar-fixa.md`)

- No desktop a sidebar fica parada e só o conteúdo rola.

## 2.5.0 — 2026-11-09

**M25: Limite de Categoria sem acúmulo** ([#5](https://github.com/Shadowtampa/lugomFinances/issues/5), `.specs/25-categoria-sem-acumulo.md`)

- O saldo de Categoria passa a ser limite mensal − gasto do mês corrente, zerando todo dia 1º. Antes o limite se multiplicava pelos meses de vigência, e os valores apareciam triplicados.
- O campo "Início da vigência" saiu do formulário de Categoria.
- Categorias e Dashboard mostram o gasto do mês.

## 2.4.0 — 2026-11-09

**M24: Notas** ([#4](https://github.com/Shadowtampa/lugomFinances/issues/4), `.specs/24-notas.md`)

- Campo "Nota" em Saídas, Entradas e Recorrências. A nota da recorrência vale para todos os meses.
- Linhas com nota mostram 📝; clique ou toque mostra o texto.
- Em Importadas, "+ Nota" no card grava a nota no lançamento ao confirmar.

## 2.3.0 — 2026-11-09

**M23: Filtro de recorrências pagas** ([#3](https://github.com/Shadowtampa/lugomFinances/issues/3), `.specs/23-filtro-recorrencias.md`)

- Recorrências ganhou os filtros Todas · A pagar · Pagas. A tela abre em A pagar.
- O filtro fica na URL (`?status=`) e se mantém ao trocar de mês.

## 2.2.0 — 2026-11-09

**M22: Apelidos de estabelecimento** ([#2](https://github.com/Shadowtampa/lugomFinances/issues/2), `.specs/22-apelidos-estabelecimento.md`)

- Dá para dar um apelido a um estabelecimento da Pluggy (ex.: "Açaí do Lester"). Ele aparece em Importadas e em Saídas e Entradas vindas da Pluggy, com a descrição original embaixo.
- O apelido é aplicado na leitura: não muda Categoria, Fonte nem o título salvo. Um título editado à mão vence o apelido.
- A lista de apelidos fica em Conexões.

## 2.1.0 — 2026-11-09

**M21: Importação retroativa + conciliação de cartão** (`.specs/21-importacao-retroativa.md`)

- "Importar desde" editável por conta da Pluggy. O saldo inicial é recalculado depois da sincronização.
- O pagamento de fatura (débito na conta + crédito no cartão) é conciliado com um clique, sem gasto em Categoria.
- Aviso quando o saldo do app não bate com o da Pluggy.
- Parcelas de compras anteriores ao corte chegam com a sugestão de ignorar.

## 2.0 — 2026-11-09

Marco de versão depois do M20 (integração Pluggy). Versões anteriores não têm changelog; ver o histórico do git (`M<n>: …`).
