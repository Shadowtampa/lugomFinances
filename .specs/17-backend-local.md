# M17 — Backend local (sem Supabase)

**Objetivo:** tirar o Supabase. O app passa a rodar só no homelab: Postgres + PostgREST
em containers, login feito por uma função no próprio banco, front servido por nginx,
tudo orquestrado no Kubernetes do homelab e publicado na porta **10070**.

**Pré-requisitos:** M1–M16 concluídos.

---

## Escopo

**Dentro:**
- Banco Postgres próprio rodando as mesmas migrations (renomeadas de `supabase/` para `db/`).
- Shim do que o Supabase fornecia de graça: papéis `anon`/`authenticated`/`authenticator`,
  schema `auth` com `auth.users` e `auth.uid()`, grants padrão.
- Login: RPC `login(email, senha)` que confere a senha (bcrypt, `pgcrypto`) e devolve um
  JWT HS256 assinado com o mesmo segredo que o PostgREST usa.
- Front: troca `@supabase/supabase-js` por `@supabase/postgrest-js` (só o cliente
  PostgREST, sem auth/realtime/storage) + uma camada de sessão própria (`lib/auth.ts`).
- Deploy no k8s (`deploy/k8s/`): Postgres, PostgREST e nginx; nginx serve o `dist/` e
  repassa `/api/` para o PostgREST (mesma origem, sem CORS).
- Script para migrar os dados do Supabase da nuvem para o banco local.

**Fora:**
- Refresh token. O JWT vale 30 dias; expirou, entra de novo.
- Cadastro de usuário pela UI (o app é de um usuário só; o usuário é criado por script).
- Vercel (o `vercel.json` sai).

---

## Tarefas

### 17.1 Banco

- `db/migrations/00000_auth_local.sql`: papéis, `auth.users (id, email, encrypted_password, created_at)`,
  `auth.uid()` lendo `request.jwt.claims ->> 'sub'`, função `login`.
- `db/migrations/99999_grants.sql`: grants que o Supabase aplicava por padrão
  (`authenticated` com CRUD em `public`; RLS continua valendo). Repete o `revoke` de
  `set_user_id_from_auth` do M7 (o `grant ... on all functions` desfaria).
- Segredo do JWT em `app.jwt_secret` (setting do banco, definido no init a partir de env).
- Erro de login: `INVALID_CREDENTIALS:` no prefixo, como as outras RPCs.

### 17.2 Front

- `src/lib/api.ts`: `db = new PostgrestClient(env.apiUrl, { fetch })`, com `fetch` que
  injeta `Authorization: Bearer <token>` da sessão atual.
- `src/lib/auth.ts`: `entrar`, `sair`, `sessaoAtual`, `aoMudarSessao`. Sessão em
  `localStorage` (`lugom.sessao`), descartada se `expiresAt` passou.
- `VITE_API_URL` opcional; padrão `/api`.
- Regra mantida: componentes não importam o cliente; só `lib/`, `AuthContext` e `services/`.

### 17.3 Deploy

- `deploy/k8s/`: kustomize com namespace `lugom-financas`; dados do Postgres em
  `hostPath` (`/var/lib/lugom-financas/postgres`), nginx com `hostPort: 10070`.
- `deploy/k8s/subir.sh`: gera o Secret (segredo JWT + senha do `authenticator`) na
  primeira vez, faz `npm run build` e aplica.
- `deploy/criar-usuario.sh` e `deploy/migrar-do-supabase.sh`.

---

## Critérios de aceite

- `npm run build` e `npm test` passam sem `@supabase/supabase-js` instalado.
- Login com e-mail/senha do usuário migrado funciona; senha errada mostra
  "E-mail ou senha incorretos."
- RLS: um token de outro `sub` não enxerga dados.
- `criar_saida` continua bloqueando `SALDO_INSUFICIENTE` etc.
- App abre em `http://<homelab>:10070`.

## Definition of Done

Critérios atendidos, README/CLAUDE.md/visão geral atualizados, um commit `M17: Backend local (sem Supabase)`.
