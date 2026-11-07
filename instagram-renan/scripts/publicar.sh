#!/usr/bin/env bash
# Publica no Instagram um post já gerado e enviado ao GitHub.
# uso: scripts/publicar.sh posts/AAAA-MM-DD-slug.json
# A chave do Instagram NÃO fica aqui: o proxy do ambiente injeta o "Authorization: Bearer"
# nas chamadas para graph.instagram.com (chave salva como segredo de rede do ambiente).
set -euo pipefail
cd "$(dirname "$0")/.."
JSON="$1"; [ -f "$JSON" ] || { echo "arquivo não encontrado: $JSON"; exit 1; }
API=$(jq -r .api config.json); IGID=$(jq -r .instagram_user_id config.json); BASE=$(jq -r .site_imagens config.json)
[ -n "$IGID" ] || { echo "preencha instagram_user_id em config.json"; exit 1; }
IMG_URL="$BASE$(basename "${JSON%.json}").jpg"
LEGENDA=$(jq -r '[.legenda, ((.hashtags // []) | map("#" + .) | join(" "))] | map(select(. != "")) | join("\n\n")' "$JSON")

echo "1/4 esperando a imagem ficar pública: $IMG_URL"
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$IMG_URL" || true)
  [ "$code" = "200" ] && break; sleep 15
done
[ "$code" = "200" ] || { echo "a imagem não ficou pública em 10 min (GitHub Pages ligado?)"; exit 1; }

echo "2/4 criando o container no Instagram"
R=$(curl -sS -X POST "$API/$IGID/media" --data-urlencode "image_url=$IMG_URL" --data-urlencode "caption=$LEGENDA")
CID=$(echo "$R" | jq -r '.id // empty'); [ -n "$CID" ] || { echo "erro ao criar: $R"; exit 1; }

echo "3/4 esperando o Instagram processar ($CID)"
for i in $(seq 1 30); do
  ST=$(curl -sS "$API/$CID?fields=status_code" | jq -r '.status_code // empty')
  [ "$ST" = "FINISHED" ] && break
  [ "$ST" = "ERROR" ] && { echo "o Instagram recusou a imagem"; exit 1; }
  sleep 5
done

echo "4/4 publicando"
R=$(curl -sS -X POST "$API/$IGID/media_publish" --data-urlencode "creation_id=$CID")
MID=$(echo "$R" | jq -r '.id // empty'); [ -n "$MID" ] || { echo "erro ao publicar: $R"; exit 1; }
LINK=$(curl -sS "$API/$MID?fields=permalink" | jq -r '.permalink // empty')
jq --arg id "$MID" --arg link "$LINK" --arg em "$(date -u +%FT%TZ)" '. + {publicado:{id:$id,link:$link,em:$em}}' "$JSON" > "$JSON.tmp" && mv "$JSON.tmp" "$JSON"
echo "PUBLICADO: $LINK"
