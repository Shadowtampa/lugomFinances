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

## Integração Pluggy (M20)

As transações do Inter / Mercado Pago chegam pelo worker (`worker/`, Deployment `worker`),
que busca na Pluggy a cada 6h ou quando você clica em **Sincronizar agora**.

1. **Credenciais.** No [Dashboard da Pluggy](https://dashboard.pluggy.ai): *Applications* →
   criar uma aplicação → anotar Client ID e Client Secret. O `subir.sh` pede os dois na
   primeira vez e grava no Secret `lugom-financas` (e em `deploy/k8s/.segredos`, fora do git).
2. **Conexões.** Em [meu.pluggy.ai](https://meu.pluggy.ai), conectar os bancos (Open Finance).
   Novas conexões só funcionam com o trial da pluggy.ai ativo; as já feitas continuam.
3. **Item IDs.** No Dashboard: sua Application → *Ir para Demo* → menu ⋮ → *Copiar Item ID*.
   Colar em **Conexões** no app, sincronizar e **Vincular** cada conta a uma Fonte (isso lança o
   saldo inicial e define a data de corte — só transações depois dela são importadas).

Recomeço do zero (uma vez, destrutivo — apaga todos os lançamentos e Fontes menos a VR Flash):

```bash
POD=$(kubectl -n lugom-financas get pod -l app=postgres -o name)
kubectl -n lugom-financas exec $POD -- pg_dump -U postgres -d lugom > ~/backups/lugom/antes-do-recomeco.sql
kubectl -n lugom-financas exec -i $POD -- psql -v ON_ERROR_STOP=1 -U postgres -d lugom < deploy/recomecar-do-zero.sql
```

Logs do worker: `kubectl -n lugom-financas logs deploy/worker -f`.

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
