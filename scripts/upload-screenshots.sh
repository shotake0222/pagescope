#!/usr/bin/env bash
# 旧サーバーの screenshots フォルダ内の画像を R2 バケットへアップロードします。
#
#   1. Xserver の public_html/screenshots/ を手元にダウンロード
#   2. ./scripts/upload-screenshots.sh ./screenshots
set -euo pipefail

DIR="${1:?使い方: $0 <screenshots フォルダ>}"
BUCKET="${BUCKET:-pagescope-screenshots}"

count=0
for f in "$DIR"/shot_*.{jpg,jpeg,png,webp}; do
  [ -e "$f" ] || continue
  key="$(basename "$f")"
  case "$key" in
    *.png) type=image/png ;;
    *.webp) type=image/webp ;;
    *) type=image/jpeg ;;
  esac
  npx wrangler r2 object put "$BUCKET/$key" --file="$f" --content-type="$type" --remote >/dev/null
  count=$((count + 1))
  echo "uploaded $key"
done
echo "完了: $count 件"
