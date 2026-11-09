# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

M1–M17 and M19–M26 are built (M18 superseded by M20's integration warning). The app runs only on the homelab (no Supabase, no Vercel) — see `.specs/17-backend-local.md`.

Before any task, read `.specs/00-VISAO-GERAL.md`. It contains the domain glossary, the business rules (RN-01 through RN-11), the stack decisions, and code conventions. They are mandatory and are not repeated in full here.

## What this is

Lugom Financial Manager — a single-user personal finance app built on **envelope budgeting**. The core idea: money is not fungible. R$500 of meal-voucher money cannot pay for an Uber, even if the account's total balance covers it. The whole system exists to enforce that separation between *where money came from* (Fonte) and *what it was spent on* (Categoria).

Domain vocabulary (Portuguese, mandatory in code/db/UI — do not invent synonyms): **Fonte** (envelope/wallet, `livre` or `restrita`), **Entrada** (money in), **Saída** (money out, always split across ≥1 Fonte), **Split** (a Saída's portion assigned to one Fonte), **Categoria** (spending nature, optional monthly limit that resets every month — no accumulation since M25). **Recorrência** (since M19) is a bill tracked month by month (paid / pending / overdue) in its own tables (`recorrencias`, `recorrencias_pagamentos`) — it is **not** a lançamento and never affects any balance. Entradas/Saídas have no recurrence fields anymore.

## Rules that must never be broken

- Money is always `BIGINT` in cents (`_centavos` fields). Never `float`, never `numeric`.
- A balance (saldo) is never stored — always derived by SQL view (`v_saldo_fontes`, `v_saldo_categorias`, `v_resumo_geral`); `v_recorrencias_mes` and `v_faturas_pendentes` are tracking views, not balances.
- A Saída (money out) is never inserted directly via `POST /saidas`. It always goes through the `criar_saida` RPC, which enforces the blocking rules transactionally.
- A Saída must have ≥1 split and `Σ splits = valor_total` exactly.
- A Saída can never drive a Fonte's balance negative (RN-02) — blocking. A restricted Fonte only accepts Saídas whose Categoria is on its allowlist (RN-03) — blocking. Exceeding a Categoria's monthly limit does **not** block (RN-06), it's cosmetic only (red balance).
- Database is `snake_case`; frontend is `camelCase`. Translation happens exactly once, in `src/services/mappers.ts` — no React component ever touches a `snake_case` or `_centavos` field directly (those only appear in `types/api.ts` and `services/`).
- No React component imports the data client directly — only `lib/api.ts`, `lib/auth.ts`, `contexts/AuthContext.tsx`, and the service layer (`src/services/*.ts`) may. Components call service functions, never `db.from()`/`.rpc()` directly.
- RLS is mandatory on every table; every row is scoped to `auth.uid()`.
- RPC errors from Postgres carry a `SCREAMING_SNAKE_CASE` code prefix before `:` (e.g. `SALDO_INSUFICIENTE`, `CATEGORIA_NAO_PERMITIDA_NA_FONTE`). The frontend parses that prefix for messaging and must never show the raw Postgres error text to the user.
- Dates are `YYYY-MM-DD` strings on the wire and in the db — never a serialized `Date`.
- React Router v7 uses the package `react-router`, **not** `react-router-dom`.
- Tailwind v4 config lives in CSS (`@theme` in `index.css`), not `tailwind.config.js` — don't fall back to v3 patterns (`@tailwind base;`).

## Stack

Vite + React 19 + TypeScript, Tailwind CSS v4, React Router v7 (declarative/SPA mode). **No Supabase since M17** (`.specs/17-backend-local.md`): local Postgres + PostgREST + RLS; data via `@supabase/postgrest-js` (`src/lib/api.ts`, PostgREST client only); auth via the `login` RPC that signs a JWT in the database (`db/migrations/00000_auth_local.sql`) and `src/lib/auth.ts`. Runs on the homelab Kubernetes (`deploy/k8s/`, port 10070). **Pluggy worker (M20):** `worker/` (Node 22, TS via `--experimental-strip-types`, deps: `pg`) is the only server code outside PostgREST — it pulls Pluggy transactions into `transacoes_importadas` as DB role `pluggy_worker`, every 6h and on `POST /sync` (nginx → worker, validates the login JWT). Pluggy credentials live only in the k8s Secret; never in the db, front or git. `src/services/integracao.ts` (`sincronizarAgora`) is the only service call that doesn't go through PostgREST. No global state library — React Router loaders + local `useState` + `AuthContext`.

## Working a milestone

The spec set in `.specs/` is the source of truth and is meant to be worked one milestone per session, in strict dependency order (`.specs/COMO-USAR.md` has the full rationale and dependency graph):

```
M1 setup → M2 schema → M3 auth → M4 camada de dados
  → M5 categorias → M6 fontes → M7 entradas → M8 saidas
      → M9 dashboard, M10 recorrencias (any order between these two)
          → M11 layout mobile (audits all screens, needs them all built first)
              → M12 notificacoes (always last — consolidates balance feedback into the final layout)
```

Each `NN-*.md` file has its own Escopo, Tarefas, Critérios de aceite, and Definition of Done. Read the target milestone's spec file (plus `00-VISAO-GERAL.md`) fully before writing code for it. If a spec turns out to be wrong once code exists, **update the spec first, then the code** — a stale spec is worse than none, because it will be trusted on the next session.

Commit convention: one commit per completed milestone, message `M<n>: <título da spec>`; break M8 (the largest, splits UI) into intermediate commits by section if needed.

Branch convention: each milestone starts on its own branch off the base branch, named `m<n>-<slug>` (e.g. `m3-auth`). Don't stack multiple milestones on one branch.

## Issue tracker

Work items live as GitHub issues on `Shadowtampa/lugomFinances` (use `gh`). Each new milestone/feature gets an issue titled `M<n>: <título>`; the issue holds the decisions and acceptance criteria, and the `.specs/NN-*.md` file is still written before code and linked from the issue. Every issue carries one category label (`bug` / `enhancement`) and one triage state label: `needs-triage` (not grilled yet), `needs-info`, `ready-for-agent` (fully specified), `ready-for-human`, `wontfix`. Reference the issue in the milestone commit (`Closes #<n>`).

## Versioning

Every milestone bumps the **minor** version in `package.json` (`npm install --package-lock-only` to sync the lock) and adds an entry at the top of `CHANGELOG.md` in the same commit; a fix without a spec bumps the patch. The menu shows the version via `__APP_VERSION__` (injected in `vite.config.ts`). The repo's GitHub default branch is not `main`, so `Closes #n` doesn't auto-close: close the issue with `gh issue close` after pushing.

## Git actions

Never `git commit`, `push`, or merge a branch unless the user explicitly asks for
it in that turn. Finishing or verifying a milestone/feature is not itself
permission — wait to be told.

## Commands

`npm run dev` (Vite; `/api` is proxied to `API_PROXY_TARGET`, default `http://localhost:3000`), `npm run build`, `npm run lint`, `npm test`. Deploy: `deploy/k8s/subir.sh`. See README.
