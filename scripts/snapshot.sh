#!/bin/bash
OUT="CODEBASE_SNAPSHOT.md"
{
  echo "# 食譜筆記本網站 — Codebase Snapshot"
  echo "- 產生時間：$(date +%Y-%m-%d)"
  echo "- Git commit：$(git rev-parse HEAD 2>/dev/null || echo '無 git 資訊')"
  echo "- 所在分支：$(git branch --show-current 2>/dev/null)"
  echo ""
  echo "## 目錄樹"
  echo '```'
  find . -type f -not -path "./.git/*" -not -path "./scripts/*" | sort
  echo '```'
  echo ""
  while IFS= read -r f; do
    ext="${f##*.}"
    echo ""
    echo "### $f"
    echo "\`\`\`$ext"
    cat "$f"
    echo '```'
  done < <(find . -type f -not -path "./.git/*" -not -path "./scripts/*" | sort)
} > "$OUT"
echo "完成：$(wc -l < "$OUT") 行，$(du -h "$OUT" | cut -f1)"
