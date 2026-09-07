# M9 — Dashboard

**Objetivo:** a tela inicial responde, em menos de dois segundos de leitura: quanto
posso gastar, de onde, e em que estou perto de estourar.

**Pré-requisitos:** M1–M8 concluídos.

---

## Escopo

**Dentro:** resumo do topo, grade de fontes, consumo de categorias, últimos
lançamentos, atalhos de lançamento rápido.

**Fora:** gráficos, séries históricas, comparativo entre meses, projeções. Todos
adiados por decisão explícita do MVP.

---

## Princípio de design

A pergunta que o dashboard responde não é "quanto eu tenho" — é **"quanto eu posso
gastar"**. Essas são coisas diferentes num sistema de envelopes, e a hierarquia
visual precisa refletir isso.

O número em destaque é o **saldo livre**, não o saldo total. O saldo restrito aparece
ao lado, menor, rotulado. Somar os dois num "total" grande seria repetir exatamente o
erro que este sistema existe para evitar.

---

## Tarefas

### 9.1 Resumo do topo

```
Disponível para gastar
R$ 3.978,00

R$ 855,00 em fontes restritas    ·    R$ 4.833,00 no total
```

- `saldo_livre_centavos` em Geist Mono, 40px, `--color-livre`.
- Rótulo "Disponível para gastar" acima, 14px, `--color-ink-soft`. Não use um eyebrow
  em maiúsculas.
- Linha secundária com restrito e total, 14px, `--color-ink-soft`.
- Fonte de dados: `obterResumoGeral()` (view `v_resumo_geral`).
- Se não houver nenhuma fonte, substituir tudo por um onboarding (ver 9.6).

### 9.2 Fontes

Reusar o cartão de fonte do M6, em versão compacta. Grade responsiva. Cada cartão
navega para a fonte ao clicar.

Ordenação: livres primeiro (maior saldo antes), depois restritas.

Limitar a 6 cartões com link "Ver todas" se houver mais.

### 9.3 Consumo de categorias

Só as categorias **com limite**, ordenadas por percentual de consumo decrescente — o
que está mais perto do limite aparece primeiro. Categorias sem limite não entram aqui;
elas aparecem apenas em `/categorias`.

Reusar a linha de categoria do M5, em versão compacta:

```
Transporte      ████████████████████████████  127%   estourou R$ 80,00
Alimentação     ████████░░░░░░░░░░░░░░░░░░░░   28%   restam R$ 860,00
Lazer           ██░░░░░░░░░░░░░░░░░░░░░░░░░░    7%   restam R$ 372,00
```

Limitar a 5, com "Ver todas". Se nenhuma categoria tiver limite, ocultar a seção
inteira e mostrar uma linha discreta: "Defina limites nas suas categorias para
acompanhar o consumo aqui." com link para `/categorias`.

### 9.4 Últimos lançamentos

Lista unificada de entradas e saídas, últimos 10, ordenados por data decrescente.
Entradas com valor em `--color-livre` e prefixo `+`; saídas em `--color-ink` com
prefixo `−`.

```
28/09   − Uber aeroporto           Transporte      R$ 62,00
27/09   − Almoço                   Alimentação     R$ 45,00
22/09   + Freelance landing page   Conta Corrente  R$ 800,00
```

Duas chamadas em paralelo (`listarEntradas` e `listarSaidas` com limite), mescladas e
ordenadas no cliente. `Promise.all`, não sequencial.

Clique leva ao item na tela correspondente.

### 9.5 Ações rápidas

Dois botões no header da página: **"Registrar saída"** (primário) e **"Registrar
entrada"** (secundário). Abrem os mesmos modais do M7 e M8, sem navegar.

Em mobile, um botão flutuante único de "Registrar saída" — é a ação feita muitas
vezes por dia, ao contrário da entrada.

Após salvar, o dashboard recarrega os dados afetados. Recarregar tudo é aceitável no
MVP; um usuário, poucas linhas.

### 9.6 Onboarding (estado zero)

Se não houver fontes **nem** categorias, o dashboard não mostra números vazios nem
zeros. Mostra três passos, e cada um só fica disponível quando o anterior está feito:

1. **Crie suas categorias** — "Como você organiza seus gastos." → `/categorias`
2. **Crie suas fontes** — "De onde o dinheiro sai. Marque como restrita as que só
   pagam certas coisas, como vale-refeição." → `/fontes`
3. **Registre sua primeira entrada** — "Seu salário, seu VR, qualquer dinheiro que
   você recebeu." → `/entradas`

Passos concluídos ficam marcados. Este é um caso em que numeração é apropriada,
porque é de fato uma sequência.

Quando o estado zero passa, o onboarding desaparece permanentemente.

### 9.7 Performance e carregamento

- Carregar resumo, fontes e categorias em paralelo com `Promise.all`.
- Skeleton de carregamento com a mesma altura do conteúdo final, para evitar salto de
  layout.
- Erro em uma seção não derruba o dashboard inteiro. Cada bloco trata o próprio erro
  com um "Não foi possível carregar. Tentar de novo."

---

## Critérios de aceite

- [ ] Saldo livre é o número em destaque; total e restrito são secundários
- [ ] O VR **não** entra no "Disponível para gastar"
- [ ] Números batem exatamente com `select * from v_resumo_geral` e `v_saldo_fontes`
- [ ] Categoria mais próxima do limite aparece primeiro
- [ ] Sem categorias com limite, a seção some e mostra o convite a definir limites
- [ ] Últimos lançamentos mesclam entradas e saídas na ordem certa
- [ ] Registrar uma saída pelo dashboard atualiza os números sem F5
- [ ] Estado zero mostra os 3 passos, com progresso conforme se cadastra
- [ ] Falha ao carregar categorias não impede o resumo de renderizar
- [ ] Sem salto de layout durante o carregamento
- [ ] Usável em 375px; a grade de fontes vira uma coluna

## Definition of Done

A pergunta "posso gastar R$ 200 hoje?" é respondível abrindo a tela inicial, sem
clicar em nada.
