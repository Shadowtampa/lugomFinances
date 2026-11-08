#!/usr/bin/env bash
# Copia os dados do Supabase da nuvem para o banco local (k8s). Uma vez só, com o banco local vazio.
#
# Uso: SUPABASE_DB_URL='postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres' \
#        deploy/migrar-do-supabase.sh
#
# A connection string está no painel do Supabase: Connect → Session pooler (a "Direct
# connection" costuma ser só IPv6). Passe por variável de ambiente, não como argumento.
#
# Traz os usuários (id, e-mail e hash bcrypt da senha: a mesma senha continua valendo)
# e todas as tabelas do app, com os mesmos ids.
set -euo pipefail

: "${SUPABASE_DB_URL:?defina SUPABASE_DB_URL (ver cabeçalho)}"
NS=lugom-financas
POD=$(kubectl -n "$NS" get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}')

local_psql() { kubectl -n "$NS" exec -i "$POD" -- env PGOPTIONS="${PGOPTIONS_LOCAL:-}" psql -v ON_ERROR_STOP=1 -U postgres -d lugom "$@"; }
nuvem_psql() { docker run --rm -i -e PGURL="$SUPABASE_DB_URL" postgres:17 sh -c 'psql -v ON_ERROR_STOP=1 "$PGURL" "$@"' -- "$@"; }

# Ordem respeita as chaves estrangeiras.
TABELAS=(categorias fontes fonte_categorias entradas saidas saida_splits recorrencias_ignoradas)

echo "== Conferindo que o banco local está vazio"
JA_TEM=$(local_psql -tAc "select (select count(*) from auth.users) + (select count(*) from public.fontes)")
if [ "$JA_TEM" != "0" ]; then
  echo "O banco local já tem dados ($JA_TEM linhas em auth.users+fontes). Abortei para não duplicar."
  exit 1
fi

echo "== Testando conexão com o Supabase"
nuvem_psql -tAc "select 'ok: ' || count(*) || ' usuário(s)' from auth.users"

# Gatilhos desligados durante a cópia: os dados já vêm prontos (user_id preenchido etc.).
export PGOPTIONS_LOCAL='-c session_replication_role=replica'

echo "== auth.users"
nuvem_psql -c "\\copy (select id, email, encrypted_password, created_at from auth.users where email is not null and encrypted_password is not null) to stdout" \
  | local_psql -c "copy auth.users (id, email, encrypted_password, created_at) from stdin"

for t in "${TABELAS[@]}"; do
  COLS=$(PGOPTIONS_LOCAL='' local_psql -tAc \
    "select string_agg(quote_ident(column_name), ',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='$t'")
  echo "== $t ($COLS)"
  nuvem_psql -c "\\copy (select $COLS from public.$t) to stdout" \
    | local_psql -c "copy public.$t ($COLS) from stdin"
done

echo "== Conferência (nuvem x local)"
for t in "${TABELAS[@]}"; do
  N=$(nuvem_psql -tAc "select count(*) from public.$t")
  L=$(PGOPTIONS_LOCAL='' local_psql -tAc "select count(*) from public.$t")
  printf '%-24s nuvem=%-6s local=%-6s %s\n' "$t" "$N" "$L" "$([ "$N" = "$L" ] && echo OK || echo DIFERENTE)"
done
