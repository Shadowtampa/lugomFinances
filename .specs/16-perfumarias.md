# M16 — Perfumarias

**Objetivo:** ajustes de polish acumulados no uso do app — nenhum deles muda regra de negócio ou schema, só a camada de UI (layout, navegação mobile, feedback visual).

**Pré-requisitos:** M1–M15 concluídos.

---

## Escopo

**Dentro:**
- Exibir a versão atual do app na UI.
- Menu mobile configurável: botão de hamburger no header da página, abrindo um modal de seleção dos itens exibidos na barra de navegação inferior.
- Ícones (em vez de texto) no menu de ações de linha (Editar/Duplicar/Excluir).
- Correção de alinhamento nas listas de Entradas e Saídas, mobile e desktop.

**Fora:**
- Refatoração de grid real das listas (fica pra uma futura milestone se o ajuste mínimo não for suficiente).
- Versionamento semver "de verdade" com changelog automatizado.
- Nova dependência npm de ícones (SVGs são vendorizados localmente).

---

## Tarefas

### 16.1 Versão do app

`package.json` → `"version": "1.16"`. Exibida como `v1.16` no rodapé do sidebar desktop (`AppShell.tsx`), abaixo do botão "Sair". Não aparece na bottom nav mobile (sem espaço).

### 16.2 Menu mobile configurável

Hoje a bottom nav mobile mostra todos os 6 itens de `NAV_ITEMS` + "Sair", apertado demais em telas pequenas.

- Um botão hamburger (`☰`) aparece no `PageHeader`, só em mobile (`md:hidden`), ao lado do título da página.
- Ao clicar, abre um modal ("Menu mobile") com um checkbox por item de navegação, permitindo escolher quais aparecem na bottom nav.
- Seleção persiste em `localStorage` (chave `lugom:nav-mobile`), padrão: Painel, Entradas, Saídas, Fontes.
- "Sair" continua sempre visível na bottom nav, fora da seleção.

### 16.3 Ícones no menu de ações

O menu de ações de cada linha (`AcoesMenu`, usado em Entradas e Saídas) trocou os rótulos de texto por ícones:
- Editar → lápis (pencil-square)
- Duplicar → documento duplicado (document-duplicate)
- Excluir → lixeira (trash)

Ícones são SVGs Solid 20x20 do heroicons.com, vendorizados como componentes locais em `src/components/ui/icons/` (sem dependência npm nova).

### 16.4 Alinhamento das listas

Nas listas de Entradas e Saídas:
- **Mobile:** cada registro continua em 2 linhas / 3 colunas visuais. A 2ª linha (fonte/categoria) agora alinha ao início, direto abaixo da data (1ª linha) — antes tinha um recuo (`pl-20`) que a deslocava.
- **Desktop:** cada registro é 1 linha com colunas alinhadas. A coluna de fonte (Entradas) / categoria (Saídas) tinha largura variável (`flex-none`, sem largura fixa) e desalinhava linha a linha; agora tem largura fixa (`w-40`), alinhando com as demais colunas (data, título, valor).

---

## Critérios de aceite

- [ ] `package.json` versão `1.16`; `v1.16` visível no rodapé do sidebar desktop.
- [ ] Botão hamburger visível só em mobile no header de cada página; abre modal de seleção de itens da bottom nav.
- [ ] Seleção de itens da bottom nav persiste após reload da página.
- [ ] "Sair" sempre visível na bottom nav, independente da seleção.
- [ ] Menu de ações (Editar/Duplicar/Excluir) exibe ícone + texto em Entradas e Saídas.
- [ ] Em mobile, a 2ª linha do registro alinha à esquerda, sob a data.
- [ ] Em desktop, a coluna de fonte/categoria alinha entre todas as linhas da lista.
- [ ] `npm run build`, `npm run lint` e `npm run test` passam sem novos erros/warnings.

## Definition of Done

Com o app rodando (`npm run dev`), abrir Entradas ou Saídas em viewport mobile (~375px): o menu de ações mostra ícones, a 2ª linha de cada registro alinha sob a data, e o hamburger no header abre um modal onde é possível trocar quais itens aparecem na barra inferior — a escolha sobrevive a um reload. Em viewport desktop, a coluna de fonte/categoria fica alinhada em todas as linhas da lista. O rodapé do sidebar mostra `v1.16`.
