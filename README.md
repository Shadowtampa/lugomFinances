# Lugom Financial Manager

Gerenciador financeiro pessoal baseado em orçamento por envelope. Ver `.specs/00-VISAO-GERAL.md`
para o domínio completo e `.specs/COMO-USAR.md` para como as specs são trabalhadas.

## Setup local

```bash
npm install
cp .env.example .env.local   # preencher com as credenciais do projeto Supabase (a partir do M2)
npm run dev
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | sobe o servidor de desenvolvimento |
| `npm run build` | type-check (`tsc -b`) + build de produção |
| `npm run preview` | serve o build de produção localmente |
| `npm run lint` | lint com oxlint |
| `npm test` | roda os testes (Vitest) |

## Deploy

Vercel, framework preset **Vite**, build `npm run build`, output `dist`. `vercel.json` já
inclui o rewrite de SPA necessário para rotas internas não darem 404 num F5. As env vars
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` precisam ser cadastradas no projeto Vercel.
