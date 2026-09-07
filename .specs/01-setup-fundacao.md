# M1 — Setup e Fundação

**Objetivo:** ter um projeto React rodando local e em produção na Vercel, com
Tailwind configurado, roteamento funcionando, design tokens definidos e um kit
mínimo de componentes de UI. Nenhuma regra de negócio ainda.

**Pré-requisitos:** conta na Vercel, conta no Supabase (projeto pode ser criado no
M2), Node 20+.

---

## Escopo

**Dentro:** scaffold Vite, Tailwind v4, React Router v7, variáveis
de ambiente, design tokens, componentes base de UI, layout shell, deploy.

**Fora:** qualquer chamada real de API, autenticação, tabelas do banco.

---

## Tarefas

### 1.1 Scaffold

```bash
npm create vite@latest lugom -- --template react-ts
cd lugom
npm install
npm install react-router @supabase/supabase-js
npm install -D tailwindcss @tailwindcss/vite
```

> **Atenção:** no React Router v7 o pacote é `react-router` (não mais
> `react-router-dom`). Importe tudo de `react-router`.

### 1.2 Tailwind v4

Tailwind v4 não usa `tailwind.config.js` por padrão — a configuração vive no CSS.

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

`src/index.css` começa com `@import "tailwindcss";` seguido do bloco `@theme` (ver 1.4).

### 1.3 Variáveis de ambiente

Criar `.env.local` (e `.env.example` versionado, sem valores):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Adicionar `.env.local` ao `.gitignore`. Criar `src/lib/env.ts` que lê e **valida na
inicialização** — se faltar variável, lançar erro com mensagem clara em vez de deixar
o app quebrar com `undefined` numa URL.

### 1.4 Design tokens

O app tem uma personalidade: é um **livro-caixa de envelopes**, não um dashboard de
fintech. A hierarquia visual precisa deixar óbvio, em meio segundo, quanto sobra em
cada envelope e quais envelopes são restritos.

**Paleta** (definir em `@theme` no `index.css`):

| Token | Hex | Uso |
|---|---|---|
| `--color-base` | `#F1F3F1` | fundo da aplicação, verde-acinzentado frio |
| `--color-surface` | `#FFFFFF` | cartões, campos |
| `--color-ink` | `#131C18` | texto principal |
| `--color-ink-soft` | `#5C6B64` | texto secundário, labels |
| `--color-line` | `#DDE2DE` | bordas e divisores hairline |
| `--color-livre` | `#0F6E4F` | fontes livres, valores positivos |
| `--color-restrita` | `#3D52A8` | fontes restritas (VR e afins) |
| `--color-alerta` | `#A32E2E` | bloqueios, saldo estourado |

Regra: **verde e azul carregam significado semântico**, não decoração. Verde = dinheiro
livre. Azul = dinheiro carimbado. Vermelho = você não pode / você estourou. Nunca use
essas cores fora desses papéis.

**Tipografia:**
- UI e texto: **Geist Sans**
- Valores monetários: **Geist Mono**, com `font-variant-numeric: tabular-nums`

Mono aqui é funcional, não estético: a tela inteira é uma coluna de números que
precisam alinhar verticalmente na vírgula. Não use mono para labels ou eyebrows.

Escala: 12 / 14 / 16 / 20 / 28 / 40. Peso 400 para corpo, 500 para labels, 600 para
valores em destaque. Sem all-caps.

**Forma:** cartão de Fonte tem `border-radius: 4px` e uma **faixa vertical de 3px na
borda esquerda** na cor do tipo da fonte (verde ou azul) — é o que diferencia
envelope livre de restrito à distância. Listas de lançamento são linhas planas
separadas por hairline `--color-line`, sem cartão, sem sombra. Sombra só em overlays
(modal, toast).

### 1.5 Componentes base (`src/components/ui/`)

Criar, sem lógica de negócio, todos tipados:

- `Button` — variantes `primary | secondary | ghost | danger`, estados `loading`, `disabled`
- `Input` — label, hint, mensagem de erro, `aria-invalid`
- `MoneyInput` — máscara de digitação em BRL, emite `number` em centavos via `onChange`
- `Select` — nativo, estilizado
- `Modal` — foco preso dentro, fecha no `Esc`, fecha no clique fora
- `Toast` + `ToastProvider` — fila, auto-dismiss 6s, variantes `info | success | error`, com `aria-live="polite"`
- `Money` — recebe centavos, renderiza formatado; prop `sinal` para colorir positivo/negativo
- `EmptyState` — ícone, título, texto, ação
- `Spinner`

> **Copy:** botões dizem o que acontece — "Salvar entrada", não "Enviar". Estados
> vazios convidam à ação — "Nenhuma fonte cadastrada. Crie a primeira para começar
> a lançar." Erros dizem o que houve e como resolver, sem pedir desculpa.

### 1.6 Helpers

`src/lib/money.ts`:
```ts
export function formatBRL(centavos: number): string
export function parseBRL(input: string): number   // "1.234,56" -> 123456
export function centavosParaReais(c: number): number
```

`src/lib/date.ts`:
```ts
export function mesAtual(): string          // "2026-09"
export function primeiroDiaDoMes(ym: string): string  // "2026-09-01"
export function ultimoDiaDoMes(ym: string): string
export function formatarData(iso: string): string     // "05/09/2026"
export function nomeDoMes(ym: string): string         // "setembro de 2026"
```

Escrever testes unitários simples desses dois arquivos (Vitest). São os únicos testes
obrigatórios no MVP — dinheiro e data são onde bugs silenciosos moram.

### 1.7 Roteamento

`src/routes.tsx` com `createBrowserRouter`. Rotas (todas ainda com páginas
placeholder):

```
/login          -> LoginPage
/               -> DashboardPage      (dentro de AppShell)
/entradas       -> EntradasPage
/saidas         -> SaidasPage
/fontes         -> FontesPage
/categorias     -> CategoriasPage
/recorrencias   -> RecorrenciasPage
*               -> NotFoundPage
```

`AppShell` (`src/components/layout/`): navegação lateral em desktop, barra inferior em
mobile. Item ativo destacado via `NavLink`. Header da página com título e slot de ação
à direita.

### 1.8 Deploy na Vercel

- Conectar o repositório.
- Framework preset: **Vite**. Build: `npm run build`. Output: `dist`.
- Cadastrar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas env vars do projeto.
- **Criar `vercel.json` com rewrite de SPA** — sem isso, dar F5 em `/entradas` retorna 404:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## Critérios de aceite

- [ ] `npm run dev` sobe sem erro nem warning de console
- [ ] `npm run build` passa com `tsc` sem erros de tipo
- [ ] Navegar entre todas as rotas funciona; F5 em rota interna **em produção** não dá 404
- [ ] Tokens de cor e fonte aplicados — nenhum hex hardcoded fora do `@theme`
- [ ] `MoneyInput` digitando "1234,56" produz `123456` no `onChange`
- [ ] `formatBRL(123456)` retorna `"R$ 1.234,56"`
- [ ] Testes de `money.ts` e `date.ts` passando
- [ ] Modal fecha com `Esc` e devolve o foco ao gatilho
- [ ] Toast é anunciado por leitor de tela
- [ ] Layout usável em 375px de largura
- [ ] App no ar numa URL da Vercel

## Definition of Done

Deploy funcionando, README com passos de setup local, `.env.example` commitado.
