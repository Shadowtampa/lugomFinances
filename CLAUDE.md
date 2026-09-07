# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

No application code exists yet — this repo currently contains only `.specs/`, a full spec set for a project that has not been scaffolded. Before doing anything else, check whether `src/`, `package.json`, etc. exist; if not, you are starting at M1 (`.specs/01-setup-fundacao.md`).

Before any task, read `.specs/00-VISAO-GERAL.md`. It contains the domain glossary, the business rules (RN-01 through RN-11), the stack decisions, and code conventions. They are mandatory and are not repeated in full here.

## What this is

Lugom Financial Manager — a single-user personal finance app built on **envelope budgeting**. The core idea: money is not fungible. R$500 of meal-voucher money cannot pay for an Uber, even if the account's total balance covers it. The whole system exists to enforce that separation between *where money came from* (Fonte) and *what it was spent on* (Categoria).

Domain vocabulary (Portuguese, mandatory in code/db/UI — do not invent synonyms): **Fonte** (envelope/wallet, `livre` or `restrita`), **Entrada** (money in), **Saída** (money out, always split across ≥1 Fonte), **Split** (a Saída's portion assigned to one Fonte), **Categoria** (spending nature, optional accumulating monthly limit). There is no separate "Conta" entity — a recurring fixed bill is just a Saída with `recorrente = true`.

## Rules that must never be broken

- Money is always `BIGINT` in cents (`_centavos` fields). Never `float`, never `numeric`.
- A balance (saldo) is never stored — always derived by SQL view (`v_saldo_fontes`, `v_saldo_categorias`, `v_resumo_geral`, `v_recorrencias_pendentes`).
- A Saída (money out) is never inserted directly via `POST /rest/v1/saidas`. It always goes through the `criar_saida` RPC, which enforces the blocking rules transactionally.
- A Saída must have ≥1 split and `Σ splits = valor_total` exactly.
- A Saída can never drive a Fonte's balance negative (RN-02) — blocking. A restricted Fonte only accepts Saídas whose Categoria is on its allowlist (RN-03) — blocking. Exceeding a Categoria's monthly limit does **not** block (RN-06), it's cosmetic only (red balance).
- Database is `snake_case`; frontend is `camelCase`. Translation happens exactly once, in `src/services/mappers.ts` — no React component ever touches a `snake_case` or `_centavos` field directly (those only appear in `types/api.ts` and `services/`).
- No React component imports the `supabase-js` client directly — only `lib/supabase.ts` and `contexts/AuthContext.tsx` may. Everything else (all data) goes through the axios instance in `lib/api.ts` against PostgREST.
- RLS is mandatory on every table; every row is scoped to `auth.uid()`.
- RPC errors from Postgres carry a `SCREAMING_SNAKE_CASE` code prefix before `:` (e.g. `SALDO_INSUFICIENTE`, `CATEGORIA_NAO_PERMITIDA_NA_FONTE`). The frontend parses that prefix for messaging and must never show the raw Postgres error text to the user.
- Dates are `YYYY-MM-DD` strings on the wire and in the db — never a serialized `Date`.
- React Router v7 uses the package `react-router`, **not** `react-router-dom`.
- Tailwind v4 config lives in CSS (`@theme` in `index.css`), not `tailwind.config.js` — don't fall back to v3 patterns (`@tailwind base;`).

## Stack

Vite + React 19 + TypeScript, Tailwind CSS v4, React Router v7 (declarative/SPA mode), axios (all data access, straight to PostgREST at `/rest/v1/...`), `@supabase/supabase-js` (auth/session/refresh only — never for data), Supabase (Postgres + PostgREST + Auth + RLS), deployed on Vercel. No global state library — React Router loaders + local `useState` + `AuthContext`.

## Working a milestone

The spec set in `.specs/` is the source of truth and is meant to be worked one milestone per session, in strict dependency order (`.specs/COMO-USAR.md` has the full rationale and dependency graph):

```
M1 setup → M2 schema → M3 auth → M4 camada de dados
  → M5 categorias → M6 fontes → M7 entradas → M8 saidas
      → M9 notificacoes, M10 dashboard, M11 recorrencias (any order among these three)
```

Each `NN-*.md` file has its own Escopo, Tarefas, Critérios de aceite, and Definition of Done. Read the target milestone's spec file (plus `00-VISAO-GERAL.md`) fully before writing code for it. If a spec turns out to be wrong once code exists, **update the spec first, then the code** — a stale spec is worse than none, because it will be trusted on the next session.

Commit convention: one commit per completed milestone, message `M<n>: <título da spec>`; break M8 (the largest, splits UI) into intermediate commits by section if needed.

## Commands

None yet — no `package.json` exists. Once M1 is scaffolded (Vite + React + TS template), the standard `npm run dev` / `npm run build` / `npm run lint` / `vitest` commands apply per `.specs/01-setup-fundacao.md`. Update this section once the project is scaffolded.
