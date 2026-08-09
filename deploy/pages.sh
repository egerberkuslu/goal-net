#!/usr/bin/env bash
# GitHub Pages'e tek komutla yayınlar: repo kur -> main push -> Pages build -> gh-pages push -> Pages aç
set -euo pipefail
cd "$(dirname "$0")/.."

REPO=goal-net
USER=$(gh api user -q .login)
URL="https://${USER}.github.io/${REPO}/"

# 1) repo (varsa geç)
gh repo view "${USER}/${REPO}" >/dev/null 2>&1 || gh repo create "${REPO}" --public --source . --push
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/${USER}/${REPO}.git"
git push -u origin main

# 2) Pages tabanıyla build
npx vite build --base="/${REPO}/"

# 2b) indirilen asset'ler ve LİSANSLARI
#
# vendor-assets/ CC-BY modeller içeriyor: atıf, dağıtılan yapıyla birlikte
# gitmek ZORUNDA. Bu satırı silmek bir temizlik değil, lisans ihlalidir.
# dist-assets/ ise üretilmiş/CC0 olan taraf; ikisi de vite kökünün dışında
# olduğu için build onları kendiliğinden almıyor.
if [ -d dist-assets ]; then
  mkdir -p dist/dist-assets
  cp -r dist-assets/* dist/dist-assets/
fi
for credits in vendor-assets/CREDITS.md dist-assets/textures/CREDITS.md; do
  [ -f "$credits" ] && cat "$credits" >> dist/CREDITS.md && echo >> dist/CREDITS.md
done

# 3) dist'i gh-pages dalı olarak it
cd dist
rm -rf .git
git init -q
git checkout -qb gh-pages
git add -A
git commit -qm "deploy $(date +%F-%H%M)"
git push -f "https://github.com/${USER}/${REPO}.git" gh-pages
cd ..

# 4) Pages'i etkinleştir (zaten açıksa hata vermez)
gh api "repos/${USER}/${REPO}/pages" -X POST \
  -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null 2>&1 || true

echo ""
echo "✅ Yayında (1-2 dk içinde): ${URL}"
echo "   Oda listesi sunucusu deploy edilmediyse oyun kod-ile-katıl modunda çalışır."
echo "   (İleride: docs/DEPLOY.md -> Fly.io bölümü + localStorage goalnet-rooms-url)"
