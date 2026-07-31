# CLAUDE.md — 食譜筆記本網站開發指引

給未來在這個 repo 裡工作的 Claude Code 對話讀的規格摘要。完整脈絡見 `PROJECT_SPEC.md`；這份文件只放「每次處理食譜/素材庫都要遵守」的具體規則，避免每次重新解釋。

## 這是什麼專案
純靜態網站（vanilla HTML/CSS/JS，無框架、無建置流程），部署在 GitHub Pages。網站本身不解析、不呼叫任何 AI API、不寫入任何資料。所有「智慧」工作都在 Claude Code 對話中離線完成，結果以 JSON 檔案寫入 `/data`，git commit + push 後由 GitHub Pages 自動重新部署。

## 新增一則食譜時，請依序做這些事

1. 使用者會貼上食譜原文（純文字，可能是從網頁複製、AI 回答、手寫筆記等任何格式）。
2. 依照下方 schema 解析成 JSON，`id` 用有意義的 kebab-case slug（例如 `shrimp-stirfry-scallion`），避免與 `data/recipes/index.json` 中既有 id 重複。
3. `cuisine` / `cooking_methods` / `main_ingredient_types` / `course` / `spice_level` 這五個欄位的值**必須**從 `data/taxonomy.json` 既有詞彙表裡選，不可自創新詞。如果現有詞彙表都不合適，先跟使用者確認要不要擴充詞彙表，再動手改 `taxonomy.json`，不要偷偷塞一個表裡沒有的值進食譜。
4. `raw_input` 欄位保留使用者貼上的原文，不要省略、不要摘要。
5. 把解析結果拿給使用者 review 一次再寫檔——尤其是份量欄位（`適量`、`少許`這類非數值）、食材別名判斷，AI 解析這些常出錯，不要跳過確認直接寫檔。
6. 寫入 `data/recipes/{id}.json`，並把 `{id}` 加進 `data/recipes/index.json` 陣列（別忘記這一步，前端靠這份 index 才知道要 fetch 哪些檔案）。
7. `git add`, `git commit`（訊息可用「新增食譜：{title}」），`git push`。

### 食譜 JSON schema

```json
{
  "id": "string，kebab-case",
  "title": "string",
  "source": "string，可留空字串",
  "servings": "string，例如 2人份",
  "time_minutes": "number，可省略",
  "ingredients": [{ "name": "string", "amount": "string", "unit": "string", "category": "string，可選" }],
  "seasonings": [{ "name": "string", "amount": "string", "unit": "string" }],
  "spices": [{ "name": "string", "amount": "string" }],
  "steps": [{ "order": "number，從1開始", "text": "string" }],
  "cuisine": "取自 taxonomy.cuisine",
  "cooking_methods": ["取自 taxonomy.cooking_methods，可複選"],
  "main_ingredient_types": ["取自 taxonomy.main_ingredient_types，可複選"],
  "course": "取自 taxonomy.course",
  "spice_level": "取自 taxonomy.spice_level，可省略",
  "created_at": "ISO date，today",
  "raw_input": "使用者貼上的原文，完整保留"
}
```

`amount` 一律存字串，不要轉成數字型別（「適量」「少許」這類值會讓數字型別直接壞掉）。

## 素材庫維護（新增/刪除庫存項目時）

1. `data/pantry.json` 是一個字串陣列，存使用者目前手邊有的食材（用「正式名稱」，盡量避免只用單字，例如存「蝦仁」而非「蝦」——關鍵字越短，之後查表比對誤判率越高）。
2. 新增一個素材庫項目時，主動幫使用者想幾個常見別名/同義詞候選（考慮台灣常見講法、簡稱），列出來讓使用者 review、確認每個候選在食材意義上真的等價（例如「蒜苗」不是「蔥」的別名，即使兩者外觀相似，也不可合併），使用者確認後才寫入 `data/synonyms.json`：
   ```json
   { "正式名稱": ["正式名稱", "別名1", "別名2"] }
   ```
3. 如果某個素材庫項目目前想不到有意義的別名，`synonyms.json` 裡至少要有一筆 `"正式名稱": ["正式名稱"]`，讓查表邏輯能命中自己。
4. 刪除素材庫項目時，同步詢問是否要一併移除 `synonyms.json` 裡對應的群組（不移除也不會壞，只是留著沒作用的資料）。

## 分類詞彙表（`data/taxonomy.json`）維護原則
- `cuisine` 刻意只停在「中式／西式／其他」這一層，不要往下細分國家（例如不要自作主張加「日式」「泰式」），因為很多菜色本來就跨國別，硬分反而製造分類困難。跨菜系的差異改用 `cooking_methods` / `main_ingredient_types` 這些不受國別限制的維度來區分。
- 除非使用者明確要求，不要新增詞彙表裡沒有的分類值。

## 前端行為（`assets/app.js`，非必要不要改動核心邏輯）
- 素材庫比對邏輯（`isInPantry`）：先查 `synonyms.json` 找出食材所屬的同義詞群組，群組的正式名稱若在 `pantry.json` 裡就標記已有；如果食材完全沒有對應的同義詞群組，才退回直接對 `pantry.json` 做字面包含比對。這是刻意設計，修改前先看 `PROJECT_SPEC.md` 第 5 節的理由。
- 篩選是多維度並列（facet），不是巢狀樹狀選單；同一維度內單選或複選依 `FACETS` 設定裡的 `multi` 決定。

## 不要做的事
- 不要在前端程式碼裡加入任何 API key 或呼叫任何 LLM API——所有解析與同義詞生成都應該發生在 Claude Code 對話裡，不是網站執行期。
- 不要用 `fetch` 去抓外部食譜網址；食譜內容一律由使用者貼上文字。
- 不要把 `data/recipes/index.json` 漏更新——這是唯一列出「有哪些食譜檔案」的清單，前端沒有目錄列表能力。
