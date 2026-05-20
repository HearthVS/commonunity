#!/bin/bash
#
# CommonUnity — Hexagram JSON Deployer
# Drop new gk_XX.json files into ~/Downloads/gene_keys_json/
# then double-click this script to copy, commit, and deploy to Railway.
#
# Runs cleanly even if there is nothing new to commit.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$HOME/Downloads/gene_keys_json"
DEST="$SCRIPT_DIR/data/hexagrams"

mkdir -p "$DEST"

echo "📂 Copying hexagram files..."
if [ -d "$SOURCE" ] && ls "$SOURCE"/gk_*.json >/dev/null 2>&1; then
  cp "$SOURCE"/gk_*.json "$DEST"/
  echo "   Copied $(ls "$SOURCE"/gk_*.json 2>/dev/null | wc -l | tr -d ' ') file(s) into data/hexagrams/."
else
  echo "   No files found at $SOURCE — skipping copy."
fi

cd "$SCRIPT_DIR" || exit 1

echo "📦 Staging changes..."
git add data/hexagrams/ >/dev/null 2>&1 || true

if git diff --cached --quiet -- data/hexagrams/; then
  echo "   Nothing new to commit. Hexagrams are already up to date."
else
  echo "📝 Committing..."
  git commit -m "feat: add hexagram JSON files"
  echo "🚀 Pushing to Railway..."
  if git push origin main; then
    echo ""
    echo "✅ Done — hexagrams deployed to Railway."
    echo "   Railway will auto-deploy in ~30 seconds."
  else
    echo ""
    echo "⚠️  Commit created locally but push failed. Resolve and push manually."
  fi
fi

echo ""
read -p "Press Enter to close this window..."
