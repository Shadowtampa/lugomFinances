#!/bin/sh
# Roda por último no init do Postgres (docker-entrypoint-initdb.d, ordem alfabética).
# Lê do ambiente do container: JWT_SECRET (mesmo do PostgREST) e AUTHENTICATOR_PASSWORD.
set -eu

: "${JWT_SECRET:?JWT_SECRET não definido}"
: "${AUTHENTICATOR_PASSWORD:?AUTHENTICATOR_PASSWORD não definido}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v jwt="$JWT_SECRET" -v senha="$AUTHENTICATOR_PASSWORD" -v db="$POSTGRES_DB" <<'SQL'
alter database :"db" set app.jwt_secret = :'jwt';
alter role authenticator with password :'senha';
SQL
