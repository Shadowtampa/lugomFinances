# M8 — Saídas com Split e Validação Bloqueante

**Objetivo:** o núcleo do sistema. Registrar um gasto, ratear entre uma ou mais
fontes, e garantir que as regras de bloqueio funcionem — inclusive a que impede o
Uber de sair do VR.

**Pré-requisitos:** M1–M7 concluídos, com saldo real cadastrado para testar.

> Este é o milestone mais complexo. Se algum outro pode ser feito às pressas, este
> não pode. Reserve tempo para os testes da seção final.

---

## Escopo

**Dentro:** lista mensal, formulário com split, validação preventiva no cliente,
tratamento dos erros bloqueantes do RPC, edição, exclusão.

**Fora:** as notificações de saldo pós-lançamento (M9 — aqui só se garante que o RPC
devolve os dados), parcelamento, anexo de nota.

---

## Regras aplicáveis

- **RN-01** — `Σ splits = valor_total`, exatamente
- **RN-02** — nenhum split pode exceder o saldo da sua fonte → **bloqueia**
- **RN-03** — fonte restrita só aceita categorias permitidas → **bloqueia**
- **RN-06** — estourar limite de categoria **não** bloqueia
- Toda gravação passa pelo RPC `criar_saida`. Nunca `POST /rest/v1/saidas` direto.

---

## Tarefas

### 8.1 Página de lista — `/saidas`

Mesmo padrão do M7: navegador de mês na URL, total do mês, linhas planas.

```
28/09  Uber aeroporto        Transporte    Conta Corrente        R$ 62,00
27/09  Almoço                Alimentação   VR Flash              R$ 45,00
26/09  Mercado do mês        Supermercado  VR + Conta Corrente   R$ 380,00
05/09  Aluguel               Moradia       Conta Corrente     R$ 1.800,00  ↻
```

- Quando houver múltiplos splits, mostrar "VR + Conta Corrente" (ou "3 fontes" se
  forem mais de 2), e expandir o detalhe ao clicar.
- Categoria com um ponto na cor dela.
- Valores em `--color-ink` (não vermelho — gasto normal não é erro).
- Filtros no topo: mês, categoria, fonte. Todos na URL.

### 8.2 Formulário — o coração

Este formulário merece ser uma **página**, não um modal, quando houver split. Estratégia:
começar como modal simples e expandir para o modo split sob demanda.

**Modo simples (padrão):**

| Campo | Tipo | Validação |
|---|---|---|
| Título | texto | obrigatório, 1–60 |
| Valor | `MoneyInput` | obrigatório, > 0 |
| Categoria | select | obrigatório, só não arquivadas |
| Fonte | select | obrigatório, só não arquivadas e **elegíveis** |
| Data | date | obrigatório, default hoje |
| Recorrente | checkbox | — |
| Dia da recorrência | number | obrigatório se recorrente |

Botão de texto abaixo do campo Fonte: **"Dividir entre fontes"** → entra no modo split.

**Elegibilidade da fonte (crítico):**

O select de Fonte precisa reagir à Categoria escolhida. Assim que uma categoria é
selecionada:

1. Fontes **livres** → sempre elegíveis.
2. Fontes **restritas** → elegíveis só se a categoria estiver entre as permitidas.
3. Fontes inelegíveis **continuam visíveis, mas desabilitadas**, com o motivo ao lado:
   `VR Flash — não aceita Transporte`.

> Esconder as fontes inelegíveis seria pior. O usuário precisa ver que o VR existe e
> entender *por que* não pode usá-lo ali. Ensinar a regra vale mais que limpar a lista.

4. Fontes sem saldo suficiente → mostrar o saldo ao lado do nome e desabilitar quando
   `saldo < valor`: `Carteira — R$ 12,00 disponíveis`.

Recalcular a elegibilidade sempre que Categoria **ou** Valor mudarem.

**Modo split:**

```
Valor total: R$ 380,00

  Fonte                     Valor
  ┌────────────────────┐  ┌──────────┐
  │ VR Flash        ▾  │  │  250,00  │  🗑
  └────────────────────┘  └──────────┘
    R$ 855,00 disponíveis
  ┌────────────────────┐  ┌──────────┐
  │ Conta Corrente  ▾  │  │  130,00  │  🗑
  └────────────────────┘  └──────────┘
    R$ 3.978,00 disponíveis

  + Adicionar fonte

  ────────────────────────────────────
  Rateado: R$ 380,00 de R$ 380,00  ✓
```

- Cada linha: select de fonte (mesma regra de elegibilidade) + `MoneyInput`.
- Saldo disponível da fonte abaixo do select, atualizado ao trocar.
- Uma fonte não pode se repetir em dois splits (constraint no banco). Filtrar as já
  usadas dos selects seguintes.
- **Indicador de rateio** sempre visível no rodapé:
  - Falta ratear: `Faltam R$ 130,00` em `--color-ink-soft`
  - Fechou: `Rateado: R$ 380,00 de R$ 380,00 ✓` em `--color-livre`
  - Passou: `Excedeu em R$ 20,00` em `--color-alerta`
- Botão salvar desabilitado enquanto não fechar exatamente.
- **Atalho de conveniência:** ao adicionar a segunda fonte, preencher automaticamente
  o valor restante nela. Economiza a conta de cabeça no caso mais comum (duas fontes).
- Voltar ao modo simples: possível só se houver 1 split.

### 8.3 Validação preventiva (cliente)

Antes de enviar, o cliente valida **tudo** que consegue validar:

- soma dos splits = valor total
- cada split ≤ saldo da sua fonte
- categoria permitida em cada fonte restrita usada
- nenhum split com valor ≤ 0
- fontes não repetidas

Isso existe para dar feedback instantâneo, **não** para substituir o servidor. O
banco valida de novo e é a autoridade final (M2).

### 8.4 Tratamento dos erros do servidor

Mapear os códigos do RPC para mensagens acionáveis. Nunca mostrar texto cru do
Postgres.

| Código | Mensagem ao usuário |
|---|---|
| `SALDO_INSUFICIENTE` | "**{fonte}** tem apenas {saldo}. Reduza o valor ou divida entre outras fontes." |
| `CATEGORIA_NAO_PERMITIDA_NA_FONTE` | "**{fonte}** não pode pagar {categoria}. Essa fonte é restrita a: {lista}." |
| `SPLIT_SOMA_DIVERGENTE` | "O rateio não fecha com o valor total. Confira os valores." |
| `SPLIT_VAZIO` | "Escolha ao menos uma fonte para esta saída." |
| `CATEGORIA_INVALIDA` / `FONTE_INVALIDA` | "Esse registro não existe mais. Recarregue a página." |

Extrair `{fonte}`, `{saldo}` etc. do detalhe da exceção quando disponível; se não,
usar a versão genérica da mensagem.

O erro aparece **inline no formulário**, próximo ao campo culpado quando dá para
identificá-lo, e o formulário **mantém todos os dados preenchidos**. Perder o que foi
digitado depois de um bloqueio é a pior experiência possível aqui.

### 8.5 Aviso de estouro de categoria (não bloqueante)

Enquanto o usuário digita o valor, se a categoria escolhida tiver limite e o valor
ultrapassar o saldo disponível dela, mostrar um aviso **amarelo/neutro** abaixo do
campo Categoria — não vermelho, não bloqueante:

> Isso vai deixar Transporte R$ 80,00 acima do limite. Você ainda pode registrar.

Deixa claro que é informativo. A RN-06 diz que categoria nunca bloqueia.

### 8.6 Edição

Editar uma saída significa **desfazer e refazer** — a validação precisa rodar de novo
contra os saldos sem a saída antiga. Usar o RPC `atualizar_saida` do M2, que faz isso
numa transação.

O formulário de edição é o mesmo, pré-preenchido, já em modo split se houver mais de
um split.

### 8.7 Exclusão

Confirmação mostrando o impacto:

> Excluir "Mercado do mês"? R$ 250,00 voltam para VR Flash e R$ 130,00 para
> Conta Corrente.

Exclusão de saída **nunca** é bloqueada — devolver dinheiro sempre é seguro.

---

## Testes obrigatórios

Reproduzir exatamente estes cenários e verificar o comportamento:

1. **Caso de uso original** — saída de R$ 100 (Transporte, Conta Corrente) com
   R$ 1.000 de saldo → grava, saldo vai a R$ 900
2. **A regra do VR** — saída de R$ 30 com categoria `Transporte` e fonte `VR Flash`
   → o VR Flash aparece **desabilitado** no select, com o motivo. Forçando via
   DevTools, o servidor retorna `CATEGORIA_NAO_PERMITIDA_NA_FONTE`
3. **Saldo insuficiente** — saída de R$ 99.999 na Carteira (saldo R$ 0) → bloqueado
   com mensagem nomeando a fonte e o saldo
4. **Split que fecha** — R$ 380 com R$ 250 no VR e R$ 130 na Conta → grava, ambos os
   saldos caem corretamente
5. **Split que não fecha** — R$ 380 com R$ 250 + R$ 100 → botão salvar desabilitado,
   indicador mostra "Faltam R$ 30,00"
6. **Split com fonte restrita inválida** — R$ 100 de `Transporte` dividido entre
   Conta Corrente (R$ 50) e VR (R$ 50) → o VR aparece desabilitado no select do split
7. **Estouro de categoria** — gasto que ultrapassa o limite de Transporte → aviso
   informativo aparece, mas o registro **é gravado**
8. **Erro preserva o formulário** — após um bloqueio do servidor, todos os campos
   continuam preenchidos
9. **Fonte repetida** — tentar escolher a mesma fonte em dois splits → não aparece no
   segundo select
10. **Concorrência de leitura** — abrir o formulário, criar uma saída em outra aba, e
    salvar a primeira com valor que agora excede o saldo → servidor bloqueia
    corretamente

---

## Critérios de aceite

- [ ] Os 10 testes acima passam
- [ ] Toda gravação passa por `criar_saida`; nenhum `POST /rest/v1/saidas` no código
- [ ] Select de fonte reage a mudanças de Categoria e de Valor
- [ ] Fontes inelegíveis ficam visíveis, desabilitadas e com o motivo escrito
- [ ] Preenchimento automático do valor restante ao adicionar a segunda fonte
- [ ] Nenhuma mensagem de erro do Postgres vaza para a UI
- [ ] Após erro, nada do que foi digitado se perde
- [ ] Lista mostra corretamente saídas de 1 e de múltiplas fontes
- [ ] Formulário inteiro navegável por teclado
- [ ] Modo split usável em 375px (linhas empilham em vez de espremer)

## Definition of Done

O sistema cumpre integralmente sua premissa: é impossível pagar um Uber com o VR, por
nenhum caminho da interface nem por chamada direta à API.
