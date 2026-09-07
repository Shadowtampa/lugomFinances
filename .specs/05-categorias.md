# M5 — Categorias

**Objetivo:** cadastrar, editar e arquivar categorias com limite mensal opcional, e
visualizar o consumo do limite acumulado.

**Pré-requisitos:** M1–M4 concluídos.

**Por que este é o primeiro CRUD:** fontes restritas referenciam categorias (M6), e
saídas exigem categoria (M8). Categoria é a raiz da árvore de dependências.

---

## Escopo

**Dentro:** tela de lista, criar, editar, arquivar, indicador de consumo do limite.

**Fora:** subcategorias, ícones, reordenação manual, histórico de mudanças de limite.

---

## Regras aplicáveis

- **RN-05** — limite acumula: `limite_acumulado = limite_mensal × meses_ativos`
- **RN-06** — estourar limite não bloqueia nada, só avisa
- Limite é **opcional**. Categoria sem limite (`null`) é válida e comum (ex: Moradia,
  Saúde) — nesse caso a UI mostra só o total gasto, sem barra de progresso.
- Nome é único por usuário (constraint no banco → erro `DUPLICADO`)

---

## Tarefas

### 5.1 Página de lista — `/categorias`

Layout: linhas planas separadas por hairline, **não** cartões. Cada linha:

```
┌──────────────────────────────────────────────────────────────┐
│ ▌ Alimentação                          R$ 340,00 de R$ 1.200 │
│ ▌ ████████░░░░░░░░░░░░░░░░░░░░░░  28%     restam R$ 860,00   │
├──────────────────────────────────────────────────────────────┤
│ ▌ Transporte                           R$ 380,00 de R$ 300   │
│ ▌ ██████████████████████████████ 127%   estourou R$ 80,00    │
├──────────────────────────────────────────────────────────────┤
│ ▌ Moradia                                        R$ 1.800,00 │
│ ▌ sem limite definido                                        │
└──────────────────────────────────────────────────────────────┘
```

- `▌` é uma faixa de 3px na cor da categoria.
- Barra de progresso: `--color-livre` até 100%, `--color-alerta` acima. Sem gradiente,
  sem animação de entrada.
- Os números vêm de `listarSaldosCategorias()` (view `v_saldo_categorias`).
- **O valor mostrado é o acumulado**, não o do mês. Deixar isso explícito no texto:
  "restam R$ 860,00 acumulados". Mostrar o gasto do mês corrente como linha
  secundária menor: "R$ 210,00 neste mês".
- Ordenação: por nome, ascendente. Categorias que estouraram o limite sobem para o
  topo — o que precisa de atenção aparece primeiro.
- Toggle "Mostrar arquivadas" (padrão: oculto). Arquivadas aparecem com opacidade
  reduzida e sem ações além de "Reativar".

Estado vazio: "Nenhuma categoria ainda. Categorias organizam seus gastos e definem
quanto você pretende gastar em cada coisa." + botão "Criar categoria".

### 5.2 Formulário (modal)

Campos:

| Campo | Tipo | Validação |
|---|---|---|
| Nome | texto | obrigatório, 1–40 caracteres, único |
| Limite mensal | `MoneyInput` | opcional, ≥ 0 |
| Cor | seletor de 8 cores fixas | obrigatório, default aleatório |
| Início da vigência | mês (`YYYY-MM`) | obrigatório, default = mês atual |

**Sobre "início da vigência":** é a partir de qual mês o limite começa a acumular.
Deixar um texto de ajuda: "O limite acumula a partir deste mês. Se você define R$ 300
com início em julho e estamos em setembro, você tem R$ 900 acumulados."

Esse campo é conceitualmente pesado. Escondê-lo atrás de um "Opções avançadas"
recolhido, com o default no mês atual, para não travar o fluxo comum.

Validação client-side antes de enviar. Erro de nome duplicado (vindo do servidor)
aparece no campo Nome, não em toast.

### 5.3 Edição

Mesmo modal, pré-preenchido. Alterar o limite mensal **recalcula todo o acumulado
retroativamente** — a view usa o limite atual multiplicado pelos meses. Avisar no
modal ao editar um limite existente: "Alterar o limite recalcula o saldo acumulado
desde o início da vigência."

### 5.4 Arquivar

Botão "Arquivar" com confirmação. Não é exclusão — lançamentos antigos continuam
apontando para ela.

Categoria arquivada:
- não aparece no seletor ao cadastrar uma saída
- continua aparecendo em lançamentos históricos
- pode ser reativada

Nunca oferecer "Excluir". Se o usuário insistir, o banco vai barrar com
`on delete restrict` de qualquer forma.

### 5.5 Categorias iniciais

Na primeira vez que o usuário abre a tela sem nenhuma categoria, oferecer no estado
vazio um botão secundário "Usar sugestões" que cria de uma vez: Alimentação,
Supermercado, Transporte, Moradia, Saúde, Lazer, Assinaturas, Outros — todas sem
limite, para o usuário ajustar depois.

---

## Critérios de aceite

- [ ] Criar categoria com limite → aparece na lista com barra em 0%
- [ ] Criar categoria sem limite → aparece sem barra, com texto "sem limite definido"
- [ ] Nome duplicado mostra erro no campo, não quebra a tela
- [ ] Categoria com gasto acima do limite mostra barra vermelha, percentual > 100% e
      valor de estouro, e sobe para o topo da lista
- [ ] Editar limite reflete imediatamente no acumulado (verificar contra o SQL)
- [ ] Arquivar remove da lista padrão; toggle traz de volta em estado reduzido
- [ ] Categoria arquivada não aparece no seletor de saída (validar no M8)
- [ ] "Usar sugestões" cria as 8 categorias numa tacada
- [ ] Tela usável em 375px — a barra de progresso não quebra o layout
- [ ] Navegação por teclado no modal funciona (Tab, Esc, Enter salva)

## Definition of Done

CRUD completo, com estados de loading, vazio e erro tratados em cada operação.
