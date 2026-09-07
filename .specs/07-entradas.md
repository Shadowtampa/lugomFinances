# M7 — Entradas

**Objetivo:** registrar dinheiro entrando em uma fonte. É o milestone que dá saldo ao
sistema — sem ele, nenhuma saída pode ser testada.

**Pré-requisitos:** M1–M6 concluídos.

---

## Escopo

**Dentro:** lista mensal, criar, editar, excluir, marcação de recorrência.

**Fora:** o lançamento automático de recorrências (é o M10 — aqui só se *marca* como
recorrente), split de entrada entre fontes, anexos.

---

## Regras aplicáveis

- Toda entrada pertence a **exatamente uma** fonte (sem split na entrada — split só
  existe na saída)
- Valor > 0
- **RN-08** — marcar `recorrente = true` cria um template; ele não gera nada sozinho
- Excluir uma entrada reduz o saldo da fonte. Se isso deixaria o saldo negativo
  (porque já há saídas em cima), a exclusão precisa ser **bloqueada** — ver 7.5

---

## Tarefas

### 7.1 Página de lista — `/entradas`

Cabeçalho com **navegador de mês**: `‹ setembro de 2026 ›` + botão "Hoje" quando não
estiver no mês corrente. O mês selecionado vive na URL (`?mes=2026-09`) para que
recarregar e compartilhar link funcione.

Abaixo, o total do mês: "R$ 5.800,00 entraram em setembro".

Lista de linhas planas:

```
05/09  Salário setembro          Conta Corrente     R$ 5.000,00  ↻
01/09  VR setembro               VR Flash             R$ 900,00  ↻
22/09  Freelance landing page    Conta Corrente       R$ 800,00
```

- Data, título, fonte (com um ponto na cor da fonte antes do nome), valor à direita
  em mono, alinhado.
- `↻` marca recorrente. Tooltip: "Recorrente, todo dia 5".
- Valores em `--color-livre`.
- Ordenação: data decrescente.
- Clique na linha abre o modal de edição. Ações de excluir num menu `⋯` no hover /
  toque longo.

Estado vazio do mês: "Nenhuma entrada em setembro." + "Registrar entrada".
Estado vazio absoluto (nenhuma entrada jamais): explicar o conceito antes de pedir
ação — "Toda saída precisa sair de algum lugar. Comece registrando seu salário ou
outro dinheiro que você recebeu."

### 7.2 Formulário (modal)

| Campo | Tipo | Validação |
|---|---|---|
| Título | texto | obrigatório, 1–60 caracteres |
| Valor | `MoneyInput` | obrigatório, > 0 |
| Fonte | select | obrigatório, só não arquivadas |
| Data | date | obrigatório, default hoje |
| Recorrente | checkbox | — |
| Dia da recorrência | number 1–31 | obrigatório se recorrente, default = dia da data |

Ordem de foco: Título → Valor → Fonte → Data. Autofoco no Título ao abrir.

**Se não houver nenhuma fonte cadastrada**, o modal não deve abrir. Em vez disso,
mostrar um estado que direciona: "Você precisa de uma fonte antes de registrar uma
entrada." + botão "Criar fonte" que leva a `/fontes`.

**Sobre dia da recorrência 29, 30, 31:** meses curtos não têm esses dias. Ao escolher
um valor > 28, mostrar aviso inline: "Em meses mais curtos, será sugerido o último dia
do mês." A regra de resolução fica no M10.

### 7.3 Feedback ao salvar

Toast de sucesso mostrando o **novo saldo da fonte** — mesma filosofia da RN-07,
aplicada à entrada:

> **Entrada registrada.** Conta Corrente agora tem R$ 8.978,00.

Buscar o saldo atualizado após o insert (chamar `listarSaldosFontes()` ou filtrar por
`fonte_id`). Não calcular no cliente somando — sempre ler a view, para que a tela
reflita a verdade do banco.

### 7.4 Edição

Mesmo modal, pré-preenchido. Editar valor ou fonte recalcula os saldos.

**Cuidado:** reduzir o valor de uma entrada pode deixar a fonte com saldo negativo se
já houver saídas maiores. Antes de salvar, calcular no cliente
`saldoAtual − valorAntigo + valorNovo`; se der negativo, bloquear com mensagem:

> Não é possível reduzir para R$ 200,00. Isso deixaria Conta Corrente com saldo
> negativo de R$ 1.300,00. Remova ou ajuste saídas antes.

Se um template recorrente for editado, avisar: "As alterações valem para os próximos
lançamentos. Lançamentos já feitos não mudam."

### 7.5 Exclusão

Mesma verificação de saldo negativo. Se a exclusão for possível, confirmar mostrando
o impacto:

> Excluir "Freelance landing page"? O saldo de Conta Corrente cai para R$ 3.178,00.

Se não for possível, explicar por quê e apontar o caminho — nunca só "não é possível".

Excluir um template recorrente: perguntar se deve excluir também as recorrências já
lançadas a partir dele. Default: **não** (só o template, encerrando a recorrência).

### 7.6 Filtro por fonte

Um select secundário no topo, ao lado do navegador de mês, para filtrar por fonte.
Vai para a URL também (`?mes=2026-09&fonte=<id>`).

---

## Critérios de aceite

- [ ] Criar entrada de R$ 1.000 na Conta Corrente → saldo da fonte sobe R$ 1.000 em
      `/fontes` e no dashboard
- [ ] Toast pós-criação mostra o saldo novo correto
- [ ] Navegador de mês funciona e persiste na URL após F5
- [ ] Mês sem entradas mostra estado vazio, não lista quebrada
- [ ] Sem fontes cadastradas, o botão de nova entrada leva a `/fontes`
- [ ] Marcar recorrente exige dia; dia fora de 1–31 é rejeitado
- [ ] Editar valor para um número que deixaria a fonte negativa é bloqueado com
      mensagem explicativa
- [ ] Excluir entrada mostra o impacto no saldo antes de confirmar
- [ ] Aviso ao escolher dia 29–31
- [ ] Valores alinham verticalmente na coluna da direita (tabular-nums funcionando)

## Definition of Done

É possível montar o cenário do caso de uso original: salário de R$ 5.000 na Conta
Corrente e R$ 900 de VR no VR Flash, com saldos batendo.
