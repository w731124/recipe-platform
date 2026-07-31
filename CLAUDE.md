# CLAUDE.md — 食譜筆記本網站開發指引

給未來在這個 repo 裡工作的 Claude Code 對話讀的規格摘要。完整脈絡見 `PROJECT_SPEC.md`；這份文件只放「每次處理食譜/素材庫都要遵守」的具體規則，避免每次重新解釋。

## 這是什麼專案
純靜態網站（vanilla HTML/CSS/JS，無框架、無建置流程），部署在 GitHub Pages。網站本身不解析、不呼叫任何 AI API。所有「智慧」工作（食譜解析、同義詞生成、分類詞彙表維護）都在 Claude Code 對話中離線完成，結果以 JSON 檔案寫入 `/data`，git commit + push 後由 GitHub Pages 自動重新部署。

**唯一例外**：食材庫（`data/pantry.json`）的新增/刪除可以直接在網站的「食材庫」分頁操作，網站會用使用者自己貼上、存在瀏覽器 localStorage 的 GitHub token 直接呼叫 GitHub API 寫回 repo（見下方「食材庫網站直接寫入」一節）。除此之外的所有資料（食譜、分類詞彙表、同義詞庫）仍然只能透過 Claude Code 對話離線寫入。

## Git commit / push 規則（覆蓋預設行為）

這個專案裡，Claude Code 完成一個階段性任務（例如：解析完一則食譜、做完一次功能變更）、且使用者已經確認結果沒問題之後：
- **直接執行 `git commit`，不用再另外詢問一次「要不要 commit」。**
- **`git push` 前一定要先問使用者要不要 push**，不要自動推上去——因為 push 會觸發 GitHub Pages 重新部署、影響其他裝置 pull 到的內容，這一步保留讓使用者決定時機。

## 新增一則食譜時，請依序做這些事

1. 使用者會貼上食譜原文（純文字，可能是從網頁複製、AI 回答、手寫筆記等任何格式）。
2. 依照下方 schema 解析成 JSON，`id` 用有意義的 kebab-case slug（例如 `shrimp-stirfry-scallion`），避免與 `data/recipes/index.json` 中既有 id 重複。
3. `cuisine` / `cooking_methods` / `main_ingredient_types` / `course` / `spice_level` 這五個欄位的值**必須**從 `data/taxonomy.json` 既有詞彙表裡選，不可自創新詞。如果現有詞彙表都不合適，先跟使用者確認要不要擴充詞彙表，再動手改 `taxonomy.json`，不要偷偷塞一個表裡沒有的值進食譜。
4. `raw_input` 欄位保留使用者貼上的原文，不要省略、不要摘要。
5. 把解析結果拿給使用者 review 一次再寫檔——尤其是份量欄位（`適量`、`少許`這類非數值）、食材別名判斷，AI 解析這些常出錯，不要跳過確認直接寫檔。
6. 寫入 `data/recipes/{id}.json`，並把 `{id}` 加進 `data/recipes/index.json` 陣列（別忘記這一步，前端靠這份 index 才知道要 fetch 哪些檔案）。
7. `git add`, `git commit`（訊息可用「新增食譜：{title}」）——照上方「Git commit / push 規則」，commit 不用再問，但 push 前要先問使用者。

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

`data/pantry.json` 是**依分類分組的物件**（不是扁平字串陣列）：

```json
{ "分類名稱": ["正式名稱1", "正式名稱2"] }
```

分類名稱固定從 `data/taxonomy.json` 的 `pantry_categories` 詞彙表裡選（目前是：香料、香草、調味粉、調味料、醬、辛香蔬菜、起司、罐頭/醃漬、生鮮食材）。跟其他分類詞彙表一樣，除非使用者明確要求，不要新增表裡沒有的分類值。

**單一項目的日常新增/刪除，使用者可以直接在網站「食材庫」分頁操作**（會直接寫回 GitHub，見下一節），不一定要透過 Claude Code 對話。但下列情況仍然要在 Claude Code 對話裡處理：

1. **批次新增/大幅調整素材庫**（一次要加好幾個項目、或要重新分類）：比照食譜的作法，先列出來讓使用者 review 再寫檔。
2. **同義詞生成**：新增一個素材庫項目時，主動幫使用者想幾個常見別名/同義詞候選（考慮台灣常見講法、簡稱），列出來讓使用者 review、確認每個候選在食材意義上真的等價（例如「蒜苗」不是「蔥」的別名、「香油」不是「麻油」的別名，即使容易混淆也不可隨意合併），使用者確認後才寫入 `data/synonyms.json`：
   ```json
   { "正式名稱": ["正式名稱", "別名1", "別名2"] }
   ```
   如果網站「食材庫」分頁新增的項目還沒有對應的同義詞群組，記得在下次對話中提醒使用者要不要順便補上別名——網站本身不會、也不應該自動生成同義詞（同義詞生成屬於離線輔助工作，不是網站執行期功能）。
3. 如果某個素材庫項目目前想不到有意義的別名，`synonyms.json` 裡至少要有一筆 `"正式名稱": ["正式名稱"]`，讓查表邏輯能命中自己。
4. 刪除素材庫項目時，同步詢問是否要一併移除 `synonyms.json` 裡對應的群組（不移除也不會壞，只是留著沒作用的資料）。

## 食材庫網站直接寫入（GitHub API，架構例外）

這是專案裡唯一允許網站執行期寫入資料的地方，設計如下（改動前務必先跟使用者確認，不要自作主張擴大範圍）：

- 使用者在「食材庫」分頁貼上一組 **fine-grained GitHub token**，只給 `w731124/recipe-platform` 這個 repo 的 Contents 讀寫權限，其餘權限一律不給。
- Token 只存在瀏覽器的 `localStorage`（key: `recipe_platform_gh_token`），**絕對不可以**出現在原始碼、commit 記錄或 repo 裡的任何檔案。
- 網站透過 GitHub Contents API（`GET`/`PUT /repos/w731124/recipe-platform/contents/data/pantry.json`）直接讀取、寫入 `pantry.json`，並建立 commit，直接推上 `main`（沒有 PR 審核這層，跟現在 Claude Code 的直接 push 流程一致）。
- 這個機制**只**用於 `data/pantry.json` 的新增/刪除。不要把這個模式複製到其他資料檔案（食譜、taxonomy、synonyms）——那些仍然要走 Claude Code 離線流程，理由見 PROJECT_SPEC.md 第 2 節（避免網站執行期出現不可控的寫入邏輯、保留人工 review 環節）。
- 沒有設定 token 的訪客仍然可以正常瀏覽食材庫內容（唯讀），只是看不到新增/刪除的按鈕，符合「單一維護者上傳、其他人唯讀瀏覽」的定位。

## 分類詞彙表（`data/taxonomy.json`）維護原則
- `cuisine` 刻意只停在「中式／西式／其他」這一層，不要往下細分國家（例如不要自作主張加「日式」「泰式」），因為很多菜色本來就跨國別，硬分反而製造分類困難。跨菜系的差異改用 `cooking_methods` / `main_ingredient_types` 這些不受國別限制的維度來區分。
- 除非使用者明確要求，不要新增詞彙表裡沒有的分類值。

## 前端行為（`assets/app.js`，非必要不要改動核心邏輯）
- 素材庫比對邏輯（`isInPantry`）：先查 `synonyms.json` 找出食材所屬的同義詞群組，群組的正式名稱若在 `pantry.json`（攤平後的 `state.pantryFlat`）裡就標記已有；如果食材完全沒有對應的同義詞群組，才退回直接對素材庫做字面包含比對。這是刻意設計，修改前先看 `PROJECT_SPEC.md` 第 5 節的理由。
- 篩選是多維度並列（facet），不是巢狀樹狀選單；同一維度內單選或複選依 `FACETS` 設定裡的 `multi` 決定。
- 食譜詳細頁的「還需要買」清單（`renderShoppingList`）跟既有的逐項綠色高亮是同一份 `isInPantry` 判斷邏輯算出來的，兩者要維持一致，不要各自維護一套比對規則。
- 「食譜」「食材庫」是分頁切換（`showRecipesTab` / `showPantryTab`），不是路由，重新整理頁面會回到食譜分頁，這是刻意的簡化，不需要加 URL hash 之類的路由邏輯。

## 不要做的事
- 不要在前端程式碼裡加入任何 **LLM API key** 或呼叫任何 LLM API——所有解析與同義詞生成都應該發生在 Claude Code 對話裡，不是網站執行期。（食材庫的 GitHub token 是唯一經過確認的例外，見上一節，不要把這個例外泛化成「前端可以放憑證」。）
- 不要用 `fetch` 去抓外部食譜網址；食譜內容一律由使用者貼上文字。
- 不要把 `data/recipes/index.json` 漏更新——這是唯一列出「有哪些食譜檔案」的清單，前端沒有目錄列表能力。
- 不要把食材庫的 GitHub 直接寫入模式擴大到其他資料檔案，也不要把 token 硬編碼進原始碼或以任何方式提交進 repo。
