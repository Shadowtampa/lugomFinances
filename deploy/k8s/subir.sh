#!/usr/bin/env bash
# Sobe (ou atualiza) o Lugom no Kubernetes do homelab. Pode rodar de novo à vontade.
#  - na primeira vez gera o Secret (senhas + segredo do JWT) e guarda uma cópia em .segredos (fora do git)
#  - atualiza os ConfigMaps (migrations e nginx)
#  - faz o build do front (dist/, servido direto pelo nginx via hostPath)
#  - aplica os manifests e espera tudo ficar pronto
#
# As migrations só rodam quando o banco é criado (pasta de dados vazia). Migration nova
# num banco existente: aplique à mão (ver README).
set -euo pipefail
cd "$(dirname "$0")"
RAIZ=$(cd ../.. && pwd)
NS=lugom-financas

kubectl apply -f 00-namespace.yaml

if ! kubectl -n "$NS" get secret lugom-financas >/dev/null 2>&1; then
  echo "== Gerando segredos"
  # umask só neste subshell: fora dele o build do front precisa sair legível para o nginx.
  (umask 077; cat > .segredos <<EOF
postgres-password=$(openssl rand -hex 24)
authenticator-password=$(openssl rand -hex 24)
jwt-secret=$(openssl rand -hex 32)
EOF
  )
  kubectl -n "$NS" create secret generic lugom-financas --from-env-file=.segredos
fi

echo "== ConfigMaps"
kubectl -n "$NS" create configmap db-init \
  --from-file="$RAIZ/db/migrations" --from-file="$RAIZ/db/zz_settings.sh" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NS" create configmap web-nginx --from-file=default.conf=nginx.conf \
  --dry-run=client -o yaml | kubectl apply -f -

echo "== Build do front"
(cd "$RAIZ" && npm ci --silent && npm run build)

echo "== Manifests"
kubectl apply -f 10-postgres.yaml -f 20-postgrest.yaml -f 30-web.yaml
kubectl -n "$NS" rollout restart deployment/web   # pega nginx.conf novo
kubectl -n "$NS" rollout status deployment/postgres --timeout=180s
kubectl -n "$NS" rollout status deployment/postgrest --timeout=120s
kubectl -n "$NS" rollout status deployment/web --timeout=120s

echo
echo "Pronto: http://localhost:10070"
echo "Primeiro uso: ../criar-usuario.sh  (ou ../migrar-do-supabase.sh para trazer os dados da nuvem)"
