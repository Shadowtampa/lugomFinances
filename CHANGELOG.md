# Changelog

Cada milestone sobe a versão **minor** e ganha uma entrada aqui, no mesmo commit. Ajuste sem spec sobe a **patch**. A versão exibida no menu vem do `package.json`.

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
