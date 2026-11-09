# Changelog

Cada milestone sobe a versão **minor** e ganha uma entrada aqui, no mesmo commit. Ajuste sem spec sobe a **patch**. A versão exibida no menu vem do `package.json`.

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
