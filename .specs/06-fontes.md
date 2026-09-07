# M6 — Fontes (Envelopes)

**Objetivo:** cadastrar as origens de dinheiro e configurar quais são livres e quais
são restritas a determinadas categorias. É aqui que a regra "VR não paga Uber" é
configurada.

**Pré-requisitos:** M1–M5 concluídos (precisa de categorias existentes para vincular).

---

## Escopo

**Dentro:** lista com saldos, criar, editar, arquivar, configuração de restrição por
categoria.

**Fora:** transferência de saldo entre fontes, integração bancária, extrato.

---

## Regras aplicáveis

- **RN-03** — fonte restrita só aceita saídas de categorias vinculadas
- **RN-04** — saldo acumula indefinidamente, sem fechamento de mês
- **RN-09** — saldo nunca é armazenado, vem de `v_saldo_fontes`
- Nome único por usuário
- Fonte `livre` ignora completamente a tabela `fonte_categorias`

---

## Tarefas

### 6.1 Página de lista — `/fontes`

Aqui **cartões são justificáveis**, porque cada fonte é literalmente um envelope e o
saldo precisa de destaque. Grade responsiva: 1 coluna em mobile, 2 em tablet, 3 em
desktop.

```
┌─────────────────────────┐  ┌─────────────────────────┐
│▌ Conta Corrente         │  │▌ VR Flash               │
│▌                        │  │▌                        │
│▌ R$ 3.978,00            │  │▌ R$ 855,00              │
│▌                        │  │▌                        │
│▌ livre                  │  │▌ só Alimentação,        │
│▌                        │  │▌ Supermercado           │
└─────────────────────────┘  └─────────────────────────┘
     faixa verde                    faixa azul
```

- Faixa esquerda de 3px: `--color-livre` (verde) para livre, `--color-restrita`
  (azul) para restrita. É o sinal visual primário — dá pra distinguir sem ler.
- Valor em Geist Mono, tamanho 28, peso 600.
- Fonte restrita lista as categorias permitidas em texto secundário. Se forem mais
  de 3, mostrar "Alimentação, Supermercado e mais 2".
- Saldo zerado: valor em `--color-ink-soft` em vez de verde, e nota "sem saldo
  disponível".
- Saldo negativo **não deve existir** (RN-02 impede). Se aparecer, é bug — renderizar
  em `--color-alerta` com o rótulo "inconsistência" para ficar evidente.
- Ordenação: livres primeiro, depois restritas, cada grupo por nome.

Estado vazio: "Nenhuma fonte cadastrada. Uma fonte é de onde o dinheiro sai — sua
conta corrente, seu vale-refeição, sua carteira." + "Criar fonte".

### 6.2 Formulário (modal)

| Campo | Tipo | Validação |
|---|---|---|
| Nome | texto | obrigatório, 1–40 caracteres, único |
| Tipo | radio: Livre / Restrita | obrigatório, default Livre |
| Categorias permitidas | multiselect | obrigatório **se** tipo = Restrita, mín. 1 |
| Cor | seletor | obrigatório |

**Comportamento do campo Tipo:**

O radio precisa explicar a diferença ali mesmo, não em tooltip:

- **Livre** — "Pode pagar qualquer categoria de gasto."
- **Restrita** — "Só pode pagar as categorias que você escolher. Use para
  vale-refeição, vale-alimentação e afins."

Ao marcar "Restrita", o multiselect de categorias aparece abaixo com uma animação de
expansão curta (essa é motion respondendo a uma ação do usuário — bem-vinda).

Ao mudar de Restrita para Livre num modal de edição, avisar: "As restrições de
categoria serão removidas."

**Multiselect de categorias:** lista com checkbox, só categorias não arquivadas,
busca por texto se houver mais de 10. Não usar `<select multiple>` nativo — é ruim em
mobile.

### 6.3 Criação com categorias (limitação conhecida)

Criar uma fonte restrita são dois requests (fonte, depois vínculos), sem transação
via REST. Implementar o rollback manual descrito no M4: se o insert de
`fonte_categorias` falhar, deletar a fonte recém-criada e mostrar erro.

Se preferir robustez, criar um RPC `criar_fonte(p_nome, p_tipo, p_cor,
p_categoria_ids uuid[])` no banco que faz tudo numa transação. **Recomendado** — é
uma função curta e elimina uma classe inteira de estado inconsistente.

### 6.4 Edição

Mesmo modal. Editar as categorias permitidas de uma fonte restrita **não afeta
lançamentos passados** — saídas já gravadas continuam como estão, mesmo que a
categoria delas deixe de ser permitida. Isso é intencional: o histórico é imutável.

Adicionar nota no modal ao editar restrições: "Lançamentos já registrados não são
alterados."

### 6.5 Arquivar

Confirmação com o saldo atual em destaque: "Arquivar 'Carteira'? Ela tem R$ 120,00 de
saldo e deixará de aparecer nos lançamentos."

Se o saldo for maior que zero, exigir uma segunda confirmação — arquivar uma fonte
com dinheiro dentro esconde saldo do resumo geral, e o usuário precisa perceber isso.

Fonte arquivada:
- some do seletor de fonte em entradas e saídas
- some da grade padrão e do cálculo de `v_resumo_geral`
- continua nos lançamentos históricos
- pode ser reativada

### 6.6 Detalhe da fonte (opcional, se sobrar tempo)

Clicar num cartão abre `/fontes/:id` com os últimos 20 lançamentos que entraram e
saíram dela. Útil para auditar de onde veio o saldo. Marcar como *nice to have* — não
bloqueia o milestone.

---

## Critérios de aceite

- [ ] Criar fonte livre → cartão com faixa verde, sem lista de categorias
- [ ] Criar fonte restrita com 2 categorias → faixa azul, categorias listadas
- [ ] Tentar salvar fonte restrita sem nenhuma categoria → erro de validação no campo
- [ ] Nome duplicado mostra erro no campo
- [ ] Saldos batem exatamente com `select * from v_saldo_fontes` no SQL Editor
- [ ] Mudar de Restrita para Livre remove os vínculos no banco
- [ ] Arquivar fonte com saldo > 0 pede confirmação dupla
- [ ] Fonte arquivada some do resumo geral
- [ ] Se um dos dois requests de criação falhar, não sobra fonte órfã no banco
- [ ] Grade responsiva de 1 a 3 colunas sem quebrar

## Definition of Done

O cenário completo do problema original está configurável: uma fonte livre (Conta
Corrente) e uma restrita (VR Flash → Alimentação, Supermercado), com saldos corretos.
