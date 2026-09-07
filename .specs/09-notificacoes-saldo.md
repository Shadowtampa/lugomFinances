# M9 — Notificações de Saldo

**Objetivo:** implementar a RN-07 — depois de registrar uma saída, o usuário vê
imediatamente quanto sobrou em cada fonte usada e quanto ainda tem na categoria.
Este era um requisito explícito do caso de uso original.

**Pré-requisitos:** M1–M8 concluídos. O RPC já devolve os dados (M2, seção 2.4).

---

## Escopo

**Dentro:** painel de confirmação pós-lançamento, alertas contextuais durante o
preenchimento, avisos de saldo baixo.

**Fora:** notificações push, e-mail, notificações agendadas, service worker.

---

## O requisito original

> "Cadastrei uma saída de 100, um uber. Uma notificação apareceu pra mim dizendo que
> ainda tenho 900 na minha conta. Apareceu também uma notificação dizendo que ainda
> tenho 200 reais de saldo para transportes este mês."

Duas informações, dois eixos: **quanto sobrou na fonte** e **quanto sobrou na
categoria**. Ambos vêm prontos no retorno do RPC — não recalcular no cliente.

---

## Tarefas

### 9.1 Painel de confirmação

Um toast comum é curto demais para duas ou três linhas de saldo. Usar um **painel de
confirmação** que aparece no canto (desktop) ou como sheet inferior (mobile), com
auto-dismiss de 8 segundos e botão de fechar.

Layout para o caso de fonte única:

```
┌────────────────────────────────────────────┐
│ Uber aeroporto registrado                  │
│                                            │
│ Conta Corrente          R$ 3.916,00        │
│ Transporte              R$ 218,00 restantes│
│                                        [×] │
└────────────────────────────────────────────┘
```

Para split:

```
┌────────────────────────────────────────────┐
│ Mercado do mês registrado                  │
│                                            │
│ VR Flash                  R$ 605,00        │
│ Conta Corrente          R$ 3.848,00        │
│ Supermercado            R$ 420,00 restantes│
│                                        [×] │
└────────────────────────────────────────────┘
```

Detalhes:

- Valores em Geist Mono, alinhados à direita, tabular.
- Ponto colorido antes de cada fonte (cor da fonte) e da categoria.
- **Separar visualmente** as linhas de fonte das de categoria — uma hairline entre
  elas. São eixos diferentes de informação e misturá-los confunde.
- Categoria sem limite: mostrar "R$ 420,00 gastos neste mês" em vez de "restantes".
  Não invente um limite que não existe.
- Categoria estourada: `R$ 80,00 acima do limite` em `--color-alerta`.
- Fonte com saldo zerado após o lançamento: `R$ 0,00 — sem saldo` em
  `--color-ink-soft`.
- Acessibilidade: `role="status"` e `aria-live="polite"`. O conteúdo inteiro precisa
  ser lido por leitor de tela, não só o título.
- Se o usuário registrar duas saídas rapidamente, o segundo painel substitui o
  primeiro (não empilhar mais de um).

### 9.2 Alertas durante o preenchimento

Antes de salvar, à medida que o usuário digita, mostrar o estado projetado. Isso é
mais valioso que o aviso pós-fato — permite corrigir antes de errar.

Abaixo do campo Fonte (modo simples) ou de cada linha de split:

> `Conta Corrente: R$ 3.978,00 → R$ 3.916,00`

Abaixo do campo Categoria:

> `Transporte: restam R$ 280,00 → R$ 218,00`

Regras:
- Só aparece quando Valor > 0 e a fonte/categoria está escolhida.
- Cálculo local (saldo atual menos valor), apenas para preview. A verdade é sempre o
  retorno do servidor.
- Se o resultado projetado for negativo na fonte, o texto vira `--color-alerta` e
  reforça o bloqueio já indicado pelo select desabilitado.
- Sem animação. O número muda enquanto se digita; movimento aqui vira ruído.

### 9.3 Aviso de saldo baixo

Quando um lançamento deixa uma fonte com menos de 10% do que ela tinha, ou menos de
R$ 50 — o que for maior — adicionar uma linha ao painel:

> `VR Flash está quase no fim.`

Sem exclamação, sem ícone de alerta. É uma observação, não um alarme.

Não implementar isso para categoria — categoria já tem barra de progresso no
dashboard e o painel já mostra o restante.

### 9.4 Reuso em entradas

O toast de entrada do M7 já mostra o saldo novo. Refatorar para usar o mesmo
componente de painel, com uma única linha de fonte. Consistência de vocabulário e de
forma entre os dois fluxos.

### 9.5 Componente

`src/components/ui/PainelSaldo.tsx`:

```ts
type LinhaSaldo = {
  rotulo: string
  cor: string
  valorCentavos: number
  sufixo?: string          // "restantes" | "acima do limite" | "gastos neste mês"
  tom?: 'normal' | 'atencao' | 'neutro'
}

type Props = {
  titulo: string
  fontes: LinhaSaldo[]
  categoria?: LinhaSaldo
  nota?: string            // "VR Flash está quase no fim."
  onFechar(): void
}
```

Genérico o suficiente para servir entrada, saída e (no M11) confirmação de
recorrência.

---

## Critérios de aceite

- [ ] Após salvar uma saída de fonte única, o painel mostra saldo da fonte e da
      categoria, com os valores exatos do retorno do RPC
- [ ] Após salvar um split de 2 fontes, o painel lista as 2 fontes + a categoria
- [ ] Categoria sem limite mostra "gastos neste mês", nunca "restantes"
- [ ] Categoria estourada mostra o excedente em vermelho
- [ ] Preview `saldo atual → saldo projetado` atualiza enquanto se digita o valor
- [ ] Preview projetado negativo aparece em vermelho
- [ ] Painel some sozinho em 8s e pode ser fechado antes
- [ ] Dois lançamentos seguidos não empilham painéis
- [ ] Leitor de tela anuncia o conteúdo completo do painel
- [ ] Entradas usam o mesmo componente

## Definition of Done

O caso de uso original é reproduzível na íntegra: registrar um Uber de R$ 100 e ver,
numa única confirmação, "R$ 900 na Conta Corrente" e "R$ 200 restantes em Transporte".
