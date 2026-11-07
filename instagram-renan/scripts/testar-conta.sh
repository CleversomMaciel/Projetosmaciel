#!/usr/bin/env bash
# Confere se a chave do Instagram está funcionando e mostra o ID da conta.
set -euo pipefail
cd "$(dirname "$0")/.."
curl -sS "$(jq -r .api config.json)/me?fields=user_id,username,account_type,media_count"; echo
