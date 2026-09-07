# M11 — Layout Mobile

**Objetivo:** o sistema inteiro é genuinamente usável num celular, não apenas
"não quebrado" nele. Isto **não** é um app mobile separado — é uma passada de
responsividade sobre as telas já construídas (M5–M10), corrigindo os pontos que
cada milestone individual não tinha contexto suficiente para pegar sozinho.

**Pré-requisitos:** M1–M10 concluídos. Todas as telas (Categorias, Fontes,
Entradas, Saídas, Dashboard, Recorrências) existem e funcionam em desktop.

---

## Escopo

**Dentro:** auditoria e ajuste de responsividade em todas as telas existentes —
listas de lançamento, formulários em modal, navegação, alvos de toque. Sem tela
nova, sem funcionalidade nova.

**Fora:** app nativo, PWA/instalável, gestos de swipe, orientação landscape
dedicada, breakpoint de tablet dedicado (o layout já funciona em 2-3 colunas a
partir de `sm`/`lg`; o alvo aqui é o extremo estreito, ~320–414px).

---

## Por que isto é um milestone à parte

Cada spec anterior já pediu "usável em 375px" como critério de aceite pontual, e o
`AppShell` do M1 já tem sidebar em desktop e barra inferior em mobile. Isso cobriu o
caso fácil (grades de cartão, formulários simples). O que ficou pra trás é o que só
aparece quando as telas são todas comparadas lado a lado:

- Linhas de lançamento (Entradas, Saídas, Categorias) foram desenhadas como uma
  única linha `flex` com colunas de largura fixa (data, título, fonte/categoria,
  valor, ações) — isso é a forma certa em desktop e **quebra ou trunca mal** em
  320–375px, porque não sobra espaço para todas as colunas ao mesmo tempo.
- O menu `⋯` de cada linha (Editar/Duplicar/Excluir) foi feito para hover em
  desktop com um fallback "sempre visível abaixo de `sm`" — precisa ser conferido
  em toque real, não só em DevTools com mouse emulado.
- O modo split de Saídas (M8) alarga o modal para `max-w-2xl` — precisa ser
  reconferido junto com os outros ajustes desta milestone, não isoladamente.
- Nenhuma tela foi comparada **entre si** para consistência de breakpoint — cada
  uma pode ter escolhido um ponto de quebra ligeiramente diferente.

---

## Tarefas

### 11.1 Linhas de lançamento — Entradas, Saídas, Categorias

As três listas (`EntradasPage`, `SaidasPage`, `CategoriasPage`) usam o mesmo
padrão de linha `flex` com spans de largura fixa. Abaixo de `sm` (640px), cada
linha empilha em duas sub-linhas em vez de comprimir:

```
05/09  Salário setembro                    ↻
       Conta Corrente          R$ 5.000,00
```

- Linha 1: data + título (título pode truncar com `...`), ícone de recorrência se
  houver.
- Linha 2: indicador de fonte/categoria (ponto colorido + nome) à esquerda, valor
  à direita, alinhado com `font-money`.
- O botão `⋯` continua no canto superior direito da linha inteira (`absolute` ou
  `self-start` conforme o layout empilhado pedir), sempre visível abaixo de `sm`
  (já é o comportamento atual — só reconferir que sobrevive à reestruturação).
- Acima de `sm`, mantém o layout de colunas atual — nenhuma mudança visual em
  desktop.
- Aplicar o mesmo padrão às saídas com múltiplas fontes (rótulo "VR + Conta" ou
  "N fontes") e à expansão inline de splits — o texto expandido também precisa
  caber em 320px sem overflow horizontal.

### 11.2 Menus de ação (`⋯`) em toque real

Testar em um dispositivo real ou emulação de touch (não apenas DevTools com mouse)
que:
- O botão `⋯` é sempre alcançável sem hover (já deveria ser o caso via
  `sm:opacity-0 sm:group-hover:opacity-100`, que só se aplica a partir de `sm`).
- A área de toque do botão e de cada item do menu tem pelo menos 44×44px
  (diretriz comum de acessibilidade de toque) — hoje o botão usa `px-2 py-1`, que
  pode ficar pequeno demais; ajustar padding se necessário.
- O overlay que fecha o menu ao tocar fora (`fixed inset-0`) não interfere com o
  scroll da lista por trás.

### 11.3 Formulários em modal

Revisar `Modal` (`src/components/ui/Modal.tsx`) e os formulários que ele hospeda
(Categoria, Fonte, Entrada, Saída — incluindo o modo split `size="xl"`) em
320–375px:
- `max-h-[90vh] overflow-y-auto` já existe — confirmar que o teclado virtual do
  celular (que reduz a altura visível) não esconde o botão "Salvar" sem permitir
  rolagem até ele.
- Campos lado a lado (ex: cada linha de split — select de fonte + `MoneyInput` +
  lixeira) já empilham em `flex-col` abaixo de `sm` (feito no M8) — reconferir com
  o restante do polimento desta milestone, especialmente o botão de lixeira, que
  hoje fica levemente deslocado fora do fluxo em telas estreitas.
- Botões "Cancelar"/"Salvar" no rodapé do formulário: em telas muito estreitas,
  considerar empilhá-los (`flex-col` abaixo de um breakpoint bem pequeno) se o
  texto do botão principal for longo ("Salvar entrada", "Salvar saída") e
  espremer demais ao lado de "Cancelar".

### 11.4 Navegação (`AppShell`)

- Confirmar que a barra inferior fixa (mobile) não sobrepõe conteúdo ao final de
  listas longas — checar `padding-bottom` do `<main>` para compensar a altura da
  barra.
- Considerar `env(safe-area-inset-bottom)` na barra inferior para iPhones com
  home indicator, evitando que os ícones fiquem colados na borda física.
- Item ativo continua destacado via `NavLink` (já existe) — sem mudança aqui além
  de confirmar visualmente em mobile.

### 11.5 Ação primária em mobile

O M9 (Dashboard) já especifica um botão flutuante único de "Registrar saída" em
mobile. Estender essa mesma ideia de forma consistente: nas páginas de Entradas e
Saídas, o botão de "Registrar" no cabeçalho (`PageHeader`) precisa continuar
alcançável com o polegar — se o cabeçalho ficar muito comprimido ao lado do título
da página em telas estreitas, mover a ação para um botão flutuante nessas duas
páginas também, pelo mesmo motivo do dashboard.

### 11.6 Auditoria final

Percorrer cada rota (`/`, `/entradas`, `/saidas`, `/fontes`, `/categorias`,
`/recorrencias`) em 320px, 375px e 414px de largura e listar qualquer overflow
horizontal, texto cortado sem reticências, ou alvo de toque menor que 44px.
Corrigir o que for encontrado antes de fechar o milestone.

---

## Critérios de aceite

- [ ] Nenhuma rota tem overflow horizontal em 320px (sem scroll lateral)
- [ ] Linhas de Entradas/Saídas/Categorias empilham em duas sub-linhas abaixo de
      `sm`, sem truncar o valor nem a data
- [ ] Menu `⋯` alcançável e utilizável por toque em todas as listas, sem depender
      de hover
- [ ] Alvos de toque (botão `⋯`, itens de menu, botões de formulário) ≥ 44×44px
- [ ] Modo split de Saídas usável em 375px — linhas empilhadas, lixeira alinhada
- [ ] Teclado virtual não esconde o botão de salvar em nenhum formulário, ou a
      área rola até ele
- [ ] Barra de navegação inferior não sobrepõe o fim das listas nem fica colada
      na borda física em iPhones com home indicator
- [ ] Botão de ação primária (Registrar entrada/saída) alcançável com o polegar
      em telas de 375–414px

## Definition of Done

Alguém consegue registrar uma entrada, uma saída simples e uma saída com split,
do início ao fim, usando só o polegar, num aparelho de 375px de largura, sem dar
zoom e sem rolar na horizontal em nenhum momento.
