# Handoff: aviso de "dados desatualizados" no Painel

## Pedido original

> "Quero saber, a partir da dashboard, há quantos dias eu não atualizo meu sistema.
> Se eu tiver há mais de uma semana sem atualizar meus dados, quero que me dê a data
> e um warning que meus dados estão desatualizados."

## Estado

Sessão de *grilling* (alinhamento de design) **em andamento**. As decisões abaixo são
**recomendações ainda não confirmadas pelo usuário**: confirme cada uma com ele antes de
escrever spec ou código. Nada foi implementado.

## Fatos levantados (base: `origin/main`, até M16)

- O Painel existe: `src/pages/DashboardPage.tsx` (resumo, fontes, categorias, últimos
  lançamentos via `listarEntradas`/`listarSaidas` com `limite: 10`, usando `useAsync`).
- `entradas` e `saidas` têm `created_at timestamptz`. **Não existe `updated_at`** em
  nenhuma tabela.
- Editar uma Saída apaga e recria o registro (`00004_rpc_saida_edicao.sql`), então o
  `created_at` dela é zerado na edição.
- **Lançamentos futuros (M14):** `data` pode estar no futuro e o lançamento só conta no
  saldo quando o dia chega. Por isso, `max(data)` não serve como sinal de atualização.
- **Recorrências (M10):** exigem confirmação manual (RN-08). Confirmar uma cria um
  lançamento novo, então isso conta como ação do usuário.

## Decisões em aberto (com recomendação)

1. **O que conta como "atualizar"?** Opções: maior `created_at` entre Entradas e
   Saídas / maior `data` / qualquer escrita (incluindo Fontes e Categorias) / último login.
   ➡️ **Maior `created_at` entre Entradas e Saídas**, porque não é afetado por
   lançamentos futuros nem retroativos.
2. **Onde entra no processo?** Opções: milestone novo ou reabrir `09-dashboard.md`.
   ➡️ **Milestone novo `.specs/17-dados-desatualizados.md`**, na branch
   `m17-dados-desatualizados`. O M9 já foi entregue e não deve ser reaberto.
3. **Limite:** contar dias de calendário no fuso America/Sao_Paulo (hoje menos a data do
   último registro). ➡️ Avisar quando passar de **7** (a partir do 8º dia). Usar uma
   constante fixa (`DIAS_PARA_DADOS_DESATUALIZADOS = 7`), sem tela de configuração.
4. **O contador aparece sempre?** ➡️ **Sim**, como uma linha discreta ("Última
   atualização: hoje" ou "há 3 dias"). Depois de 7 dias, ela vira um aviso com a data:
   *"Seus dados estão desatualizados — último lançamento em 28/10/2026, há 11 dias."*
5. **E se não houver nenhum lançamento?** ➡️ Não mostrar nem o contador nem o aviso.
   Nesse caso o onboarding do Painel já orienta o primeiro lançamento.
6. **O aviso pode ser dispensado?** ➡️ **Não.** Ele fica até o usuário lançar algo e some
   sozinho depois disso.

## Próximas decisões (dependem das respostas acima)

- **Onde calcular:** uma view nova (por exemplo `v_ultima_atualizacao`, com
  `security_invoker = true`, seguindo as views existentes) ou o cliente. Lembre que
  saldo e derivados vêm de view e que a tradução snake→camel fica só em
  `src/services/mappers.ts`.
- **Posição e estilo do aviso no Painel** (provavelmente junto ao resumo do topo).
- **Testes:** cálculo de dias, com fuso horário e virada de dia.

## Como continuar

1. Rode `/grilling` com este arquivo como contexto e confirme as decisões 1–6 com o usuário.
2. Depois do alinhamento, escreva `.specs/17-dados-desatualizados.md` (spec primeiro,
   código depois, conforme `CLAUDE.md`).
