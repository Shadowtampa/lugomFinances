# Como usar estas specs no Claude Code

## Setup inicial

1. Crie o repositório e coloque esta pasta em `docs/specs/`.
2. Crie um `CLAUDE.md` na raiz do projeto com este conteúdo:

```markdown
# Lugom Financial Manager

Antes de qualquer tarefa, leia `docs/specs/00-VISAO-GERAL.md`. Ele contém o
glossário do domínio, as regras de negócio (RN-01 a RN-11) e as convenções de
código. Elas são obrigatórias.

## Regras que nunca podem ser quebradas
- Dinheiro é sempre BIGINT em centavos. Nunca float, nunca numeric.
- Saldo nunca é armazenado — sempre derivado por view SQL.
- Toda gravação de saída passa pelo RPC `criar_saida`. Nunca insert direto.
- Banco em snake_case, frontend em camelCase. A tradução acontece só em `services/`.
- Nenhum componente React importa o cliente supabase-js.

## Estado atual
Milestone em andamento: M1
Milestones concluídos: nenhum
```

Atualize a seção "Estado atual" ao fim de cada milestone.

## Trabalhando um milestone

Abra uma sessão nova por milestone. Prompt inicial:

```
Leia docs/specs/00-VISAO-GERAL.md e docs/specs/01-setup-fundacao.md.

Antes de escrever código: me apresente um plano de execução com os arquivos
que você vai criar ou alterar e a ordem. Não comece até eu aprovar.
```

Depois de aprovar, deixe rodar. Ao fim:

```
Percorra a seção "Critérios de aceite" da spec item por item e me diga o
status de cada um. Para os que não puder verificar sozinho, me diga o que eu
preciso testar manualmente.
```

## Por que uma spec por sessão

Cada spec foi dimensionada para caber confortavelmente numa janela de contexto junto
com o código que ela produz. Juntar dois milestones numa sessão faz o agente perder
detalhe — normalmente os critérios de aceite, que é justamente onde os bugs moram.

## Commits

Um commit por milestone concluído, com a mensagem `M<n>: <título da spec>`. Se o
milestone for grande (M8 especialmente), commits intermediários por seção da spec.

## Se algo na spec estiver errado

Elas foram escritas antes do código existir, então algumas decisões vão se mostrar
ruins na prática. Quando isso acontecer: **altere a spec primeiro**, depois o código.
Uma spec desatualizada é pior que nenhuma, porque o agente vai confiar nela.

## Ordem e dependências

```
M1 setup
 └─ M2 schema
     └─ M3 auth
         └─ M4 camada de dados
             ├─ M5 categorias
             │   └─ M6 fontes          (fonte restrita referencia categorias)
             │       └─ M7 entradas    (entrada precisa de fonte)
             │           └─ M8 saídas  (saída precisa de saldo para testar bloqueio)
             │               ├─ M9  notificações
             │               ├─ M10 dashboard
             │               └─ M11 recorrências
```

M9, M10 e M11 podem ser feitos em qualquer ordem entre si.

## Pontos de atenção conhecidos

- **M2** é onde mora o valor do sistema. Se as views e o RPC estiverem certos, o resto
  é interface. Não passe adiante sem rodar os 8 testes de SQL.
- **M8** é o milestone mais longo. Considere quebrá-lo em duas sessões: formulário
  simples primeiro, modo split depois.
- **Tailwind v4** mudou bastante em relação à v3. Se o agente gerar
  `tailwind.config.js` e `@tailwind base;`, ele está usando conhecimento da v3 —
  corrija apontando para a spec do M1.
- **React Router v7** usa o pacote `react-router`, não `react-router-dom`. Mesmo
  problema: o agente tende a usar o padrão antigo.
