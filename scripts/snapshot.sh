#!/bin/bash
# 產生 CODEBASE_SNAPSHOT.md：完整版網站快照，供上傳給另一個 Claude 對話檢查現況用。
# 純粹用命令列把檔案內容拼起來，不逐檔讀進 Claude 的上下文重新理解。
set -e
cd "$(git rev-parse --show-toplevel 2>/dev/null || dirname "$0"/..)"

OUT="CODEBASE_SNAPSHOT.md"

lang_for() {
  case "$1" in
    *.md) echo "markdown" ;;
    *.js) echo "javascript" ;;
    *.json) echo "json" ;;
    *.css) echo "css" ;;
    *.html) echo "html" ;;
    *) echo "" ;;
  esac
}

{
  echo "# 食譜筆記本網站 — Codebase Snapshot"
  echo "- 產生時間：$(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "- Git commit：$(git rev-parse HEAD 2>/dev/null || echo '無 git 資訊')"
  echo "- 所在分支：$(git branch --show-current 2>/dev/null)"
  echo ""
  echo "## 目錄樹"
  echo '```'
  find . -type f \
    -not -path "./.git/*" \
    -not -name ".DS_Store" \
    -not -name "Thumbs.db" \
    -not -name "$OUT" \
    | sed 's|^\./||' | sort
  echo '```'
  echo ""
  echo "## 檔案內容"

  # 固定收錄的規則文件與前端檔案
  for f in .gitignore CLAUDE.md PROJECT_SPEC.md README.md assets/app.js assets/style.css index.html; do
    [ -f "$f" ] || continue
    echo ""
    echo "### ./$f"
    echo "\`\`\`$(lang_for "$f")"
    cat "$f"
    echo '```'
  done

  # data/ 底下所有 JSON（不含 recipes 子目錄，那批另外處理）
  find data -maxdepth 1 -type f -name '*.json' | sort | while IFS= read -r f; do
    echo ""
    echo "### ./$f"
    echo "\`\`\`json"
    cat "$f"
    echo '```'
  done

  # data/recipes/ 底下所有食譜 JSON（含 index.json），完整收錄
  find data/recipes -type f -name '*.json' | sort | while IFS= read -r f; do
    echo ""
    echo "### ./$f"
    echo "\`\`\`json"
    cat "$f"
    echo '```'
  done
} > "$OUT"

echo "完成：$OUT，共 $(wc -l < "$OUT") 行，$(du -h "$OUT" | cut -f1)"
