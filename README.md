# Lugom Financial Manager

Gerenciador financeiro pessoal baseado em orçamento por envelope. Ver `.specs/00-VISAO-GERAL.md`
para o domínio completo e `.specs/COMO-USAR.md` para como as specs são trabalhadas.

Roda só no homelab, sem serviços de nuvem (M17, `.specs/17-backend-local.md`):
Postgres + PostgREST + nginx no Kubernetes, porta **10070**.

## Subir no homelab

```bash
deploy/k8s/subir.sh                       # cria/atualiza tudo e faz o build do front
deploy/criar-usuario.sh voce@exemplo.com  # primeiro usuário (pede a senha)
```

Trazer os dados do Supabase antigo (uma vez, com o banco local vazio):

```bash
SUPABASE_DB_URL='postgresql://...pooler.supabase.com:5432/postgres' deploy/migrar-do-supabase.sh
```

O front é servido direto do `dist/` deste repositório: `npm run build` já atualiza o que
está no ar (F5 no navegador).

As migrations (`db/migrations`) só rodam quando o banco é criado. Migration nova num banco
existente:

```bash
POD=$(kubectl -n lugom-financas get pod -l app=postgres -o name)
kubectl -n lugom-financas exec -i $POD -- psql -v ON_ERROR_STOP=1 -U postgres -d lugom < db/migrations/000NN_nome.sql
kubectl -n lugom-financas rollout restart deployment/postgrest   # recarrega o schema
```

## Desenvolvimento

```bash
npm install
kubectl -n lugom-financas port-forward svc/postgrest 3000:3000   # ou um PostgREST seu
npm run dev                                                        # /api → localhost:3000
```

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento (`/api` repassado para `API_PROXY_TARGET`) |
| `npm run build` | type-check (`tsc -b`) + build de produção |
| `npm run lint` | lint com oxlint |
| `npm test` | testes (Vitest) |
