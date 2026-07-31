# 食譜筆記本

把各種格式蒐集來的食譜統一整理成同一種格式的個人食譜資料庫，並依手邊素材庫自動標示哪些食材已經有、不用再買。

完整設計脈絡見 [`PROJECT_SPEC.md`](./PROJECT_SPEC.md)；每次用 Claude Code 新增食譜或維護素材庫時的具體規則見 [`CLAUDE.md`](./CLAUDE.md)。

## 本機開啟

這是純靜態網站，不需要建置流程，但瀏覽器的 `fetch` 對 `file://` 開檔會被擋，所以要用本機伺服器打開，例如：

```bash
python3 -m http.server 8000
# 或
npx serve .
```

然後瀏覽器開 `http://localhost:8000`。

## 部署到 GitHub Pages

1. 這個資料夾 push 到你的 GitHub repo（public repo）。
2. Repo 設定裡開啟 GitHub Pages，來源選 `main` 分支的根目錄（因為沒有建置步驟，`index.html` 直接在根目錄）。
3. 之後每次 `git push` 到 `main`，GitHub Pages 會自動重新部署。

## 新增食譜的流程

不是在網站上操作，而是：

1. 把蒐集到的食譜文字貼給 Claude / Claude Code。
2. 依照 `CLAUDE.md` 的規則解析、review、寫入 `data/recipes/`，更新 `data/recipes/index.json`。
3. `git push`。

## 目錄結構

```
index.html / assets/          網站前端（vanilla JS，無框架）
data/taxonomy.json            分類詞彙表（菜系/烹調方式/主食材類型/餐點角色/辣度）
data/pantry.json              個人素材庫（人工維護的字串陣列）
data/synonyms.json            食材同義詞庫（AI 離線輔助生成，人工 review）
data/recipes/index.json       食譜檔案清單（前端靠這份才知道要抓哪些檔案）
data/recipes/{id}.json        單筆食譜資料
```
