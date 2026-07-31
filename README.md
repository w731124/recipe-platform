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

## 食材庫分頁

網站有「食譜」「食材庫」兩個分頁。食材庫依分類顯示目前手邊有的食材，並在每則食譜詳細頁列出「還需要買」清單。任何人都可以唯讀瀏覽食材庫；要新增/刪除項目，需要在食材庫分頁貼上一組只給這個 repo Contents 寫入權限的 GitHub fine-grained token（只存在你自己瀏覽器的 localStorage），之後新增/刪除會直接透過 GitHub API 建立 commit。細節見 `CLAUDE.md`「食材庫網站直接寫入」一節。

## 目錄結構

```
index.html / assets/          網站前端（vanilla JS，無框架）
data/taxonomy.json            分類詞彙表（菜系/烹調方式/主食材類型/餐點角色/辣度/食材庫分類）
data/pantry.json              個人素材庫（依分類分組的物件，單項新增/刪除可由網站直接寫入）
data/synonyms.json            食材同義詞庫（AI 離線輔助生成，人工 review）
data/ingredient_families.json 食材家族關係（同一食材的不同品種/形態，例如花椒粒/花椒粉，不算同義詞但值得提醒使用者確認）
data/recipes/index.json       食譜檔案清單（前端靠這份才知道要抓哪些檔案）
data/recipes/{id}.json        單筆食譜資料
```
