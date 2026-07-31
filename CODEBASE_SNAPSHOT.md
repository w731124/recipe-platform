# 食譜筆記本網站 — Codebase Snapshot
- 產生時間：2026-07-31
- Git commit：350b40bc746f7f399fca2600456e9ee59ca80edc
- 所在分支：main

## 目錄樹
```
./.gitignore
./CLAUDE.md
./CODEBASE_SNAPSHOT.md
./PROJECT_SPEC.md
./README.md
./assets/app.js
./assets/style.css
./data/ingredient_families.json
./data/pantry.json
./data/recipes/braised-pork-belly-taiwanese.json
./data/recipes/index.json
./data/recipes/lobster-bisque-shrimp-pasta.json
./data/recipes/mala-celery-minced-pork.json
./data/recipes/pan-seared-steak-garlic-butter.json
./data/recipes/shrimp-stirfry-scallion.json
./data/synonyms.json
./data/taxonomy.json
./index.html
```


### ./.gitignore
```gitignore
.DS_Store
Thumbs.db
.vscode/
```

### ./CLAUDE.md
```md
# CLAUDE.md — 食譜筆記本網站開發指引

給未來在這個 repo 裡工作的 Claude Code 對話讀的規格摘要。完整脈絡見 `PROJECT_SPEC.md`；這份文件只放「每次處理食譜/素材庫都要遵守」的具體規則，避免每次重新解釋。

## 這是什麼專案
純靜態網站（vanilla HTML/CSS/JS，無框架、無建置流程），部署在 GitHub Pages。網站本身不解析、不呼叫任何 AI API。所有「智慧」工作（食譜解析、同義詞生成、分類詞彙表維護）都在 Claude Code 對話中離線完成，結果以 JSON 檔案寫入 `/data`，git commit + push 後由 GitHub Pages 自動重新部署。

**例外**：以下兩種操作可以直接在網站上做，網站會用使用者自己貼上、存在瀏覽器 localStorage 的同一組 GitHub token 直接呼叫 GitHub API 寫回 repo（見下方「網站直接寫入 GitHub」一節）：
- 食材庫（`data/pantry.json`）的新增/刪除。
- 食譜的刪除（同時刪除 `data/recipes/{id}.json` 並更新 `data/recipes/index.json`）。

除此之外的所有寫入（新增/編輯食譜、分類詞彙表、同義詞庫）仍然只能透過 Claude Code 對話離線寫入。

## Git commit / push 規則（覆蓋預設行為）

這個專案裡，Claude Code 完成一個階段性任務（例如：解析完一則食譜、做完一次功能變更）之後：
- **直接執行 `git commit`，不用等使用者確認、也不用另外詢問一次「要不要 commit」。**
- **`git push` 前一定要先問使用者要不要 push**，不要自動推上去——因為 push 會觸發 GitHub Pages 重新部署、影響其他裝置 pull 到的內容，這一步保留讓使用者決定時機。

## 畫面/樣式變更的驗證方式

純前端（HTML/CSS/JS）畫面或樣式調整，**不需要**在本機開靜態伺服器 + 無頭瀏覽器截圖給使用者確認——使用者會自己用 VS Code 的 Live Server 開 `index.html` 檢查。改完直接說明改了什麼，讓使用者自行檢視即可，不用截圖這一步。

（如果是需要驗證「跟 GitHub API 實際互動」的行為，例如食材庫寫入，截圖幫不上忙，本來就要請使用者在正式網站上實際操作測試。）

## 新增一則食譜時，請依序做這些事

1. 使用者會貼上食譜原文（純文字，可能是從網頁複製、AI 回答、手寫筆記、Excel 表格等任何格式）。**Excel/表格貼上的文字常常會因為並排的兩個表格被序列化成一行行 tab 分隔文字而順序錯亂**（例如「食材表」跟「作法表」原本並排，貼上後變成一行一行交錯），解析前要先判斷這種情況、重組回正確的表格結構，不要照字面順序死板地解析。
2. 依照下方 schema 解析成 JSON，`id` 用有意義的 kebab-case slug（例如 `shrimp-stirfry-scallion`），避免與 `data/recipes/index.json` 中既有 id 重複。
3. `cuisine` / `cooking_methods` / `main_ingredient_types` / `course` / `spice_level` 這幾個欄位的值**必須**從 `data/taxonomy.json` 既有詞彙表裡選，不可自創新詞；`ingredients[].category` 則固定從 `pantry_categories` 詞彙表裡選（見下方「食材分類」）。如果現有詞彙表都不合適，先跟使用者確認要不要擴充詞彙表，再動手改 `taxonomy.json`，不要偷偷塞一個表裡沒有的值進食譜。
4. `raw_input` 欄位保留使用者貼上的原文，不要省略、不要摘要（保留原始貼上的文字，不是「重組後」的版本——重組是解析步驟的中間產物，`raw_input` 是給人事後對照原文用的）。
5. **份量欄位（`amount`/`unit`）「原文有寫就照抄，原文沒寫就整個欄位省略」，不要因為缺份量就停下來問使用者，也不要自己亂猜一個數字湊上去。網站不顯示、也不管理「幾人份」「烹調時間」，所以 schema 沒有 `servings`、`time_minutes` 欄位，解析時不用特別找/填這兩項資訊。** 真正需要拿給使用者 review 的，是解析過程中有實質判斷風險的地方：食材別名/身份判斷有疑慮（例如原文縮寫看不出指的是哪個食材）、表格重組的結果（尤其是 Excel 貼上這種容易錯位的來源）、`spice_level` 的自動判斷結果（見下方規則，判斷完仍要在回覆裡附上依據，讓使用者一眼能看出來合不合理）。
6. 寫入 `data/recipes/{id}.json`，並把 `{id}` 加進 `data/recipes/index.json` 陣列（別忘記這一步，前端靠這份 index 才知道要 fetch 哪些檔案）。
7. `git add`, `git commit`（訊息可用「新增食譜：{title}」）——照上方「Git commit / push 規則」，commit 不用再問，但 push 前要先問使用者。

### 食譜 JSON schema

```json
{
  "id": "string，kebab-case",
  "title": "string",
  "source": "string，可留空字串",
  "ingredients": [
    {
      "name": "string",
      "amount": "string，原文沒寫份量就省略這個欄位（不要填空字串或亂猜數字）",
      "unit": "string，同上，沒有就省略",
      "category": "取自 taxonomy.pantry_categories（見下方「食材分類」）"
    }
  ],
  "steps": [{ "order": "number，從1開始", "text": "string" }],
  "cuisine": "取自 taxonomy.cuisine",
  "cooking_methods": ["取自 taxonomy.cooking_methods，可複選"],
  "main_ingredient_types": ["取自 taxonomy.main_ingredient_types，可複選"],
  "course": "取自 taxonomy.course",
  "spice_level": "取自 taxonomy.spice_level，依下方規則自動判斷，可省略（完全沒有辣度相關食材時）",
  "created_at": "ISO date，today",
  "raw_input": "使用者貼上的原文，完整保留"
}
```

`amount` 一律存字串，不要轉成數字型別（「適量」「少許」這類值會讓數字型別直接壞掉）。**舊版 schema 曾經把食材拆成 `ingredients` / `seasonings` / `spices` 三個陣列，v0.3 起統一成單一 `ingredients` 陣列，用 `category` 欄位分類（見下）——新食譜一律用新格式，不要再用三陣列的舊格式。**

### 食材分類（`ingredients[].category`，沿用食材庫的 9 大分類）

食譜裡每個食材都要歸類到 `data/taxonomy.json` 的 `pantry_categories` 詞彙表（跟食材庫分頁用的是同一份，這樣食譜詳細頁才能用跟食材庫一致的分類呈現，也讓使用者一眼看出「這個食材屬於食材庫哪一類、平常會不會囤貨」）：

| 分類 | 判斷原則 | 範例 |
|---|---|---|
| 香料 | 乾燥的整粒/碎狀辛香料 | 花椒、孜然、丁香、乾辣椒 |
| 香草 | 新鮮或乾燥的葉菜類香草 | 羅勒、巴西里、迷迭香、九層塔 |
| 調味粉 | 複方或單方的粉狀調味 | 咖哩粉、五香粉、黑胡椒粉、白胡椒粉 |
| 調味料 | 液態基礎調味料、料酒類 | 醬油、香油、白醋、烏醋、味醂、米酒、清酒、白酒、巴薩米克醋、魚露、橄欖油、奶油、鮮奶油 |
| 醬 | 醬狀調味品 | 番茄醬、豆瓣醬、芥末醬、美乃滋、五味醬 |
| 辛香蔬菜 | 新鮮辛香類蔬菜 | 薑、蒜、蔥、洋蔥、新鮮辣椒 |
| 起司 | 起司類 | 帕瑪森、切達、mozzarella |
| 罐頭/醃漬 | 罐頭或醃漬加工食材 | 酸豆、橄欖、鯷魚、番茄罐頭 |
| 主食 | **耐放的乾貨澱粉類**，你有可能囤在家裡的 | 米、乾燥麵條、烏龍麵、義大利麵、冬粉 |
| 生鮮食材 | 前 9 類都套不上、**容易壞、幾乎每次都要現買**的主食材/配菜 | 絞肉、蝦仁、芹菜、蘑菇、龍蝦濃湯、**麵包/吐司/法國麵包** |

「主食」跟「生鮮食材」的分界不是「是不是澱粉/碳水」，是**耐不耐放、值不值得放進食材庫追蹤**：米、乾燥麵條這類放櫃子裡可以放很久，適合追蹤「家裡還有沒有」；麵包、吐司雖然也是澱粉，但容易壞、幾乎不會囤貨，跟肉類/海鮮/新鮮蔬菜一樣歸「生鮮食材」。

「生鮮食材」是刻意設計成最後的接底分類，不是字面上限定「新鮮」的意思——只要不屬於前 9 類，就歸這一類。

遇到表裡沒有的新分類需求時，先跟使用者確認要不要擴充 `pantry_categories`，不要自己偷加——沿用既有的分類詞彙表治理原則。

### 辣度（`spice_level`）自動判斷規則（v2，依實際案例校正過）

辣度判斷很主觀，用下面這套規則自動評估，**不需要每次都先問使用者**，但判斷完要在回覆裡附上依據（用了哪些辣度來源、各自的份量級距），方便使用者一眼檢查合不合理、要不要調整：

1. 掃描所有食材名稱（含備註），找出「辣度來源」關鍵字：辣椒、乾辣椒、辣椒粉、辣椒碎、辣椒醬、辣椒油、朝天椒、小米椒、剁椒、花椒、青花椒、藤椒、郫縣豆瓣醬、辣豆瓣醬、韓式辣醬（gochujang）等。
2. 每個辣度來源依份量描述分四級（**種類多但每種份量都很少時，不能直接因為種類多就跳到大辣**——這是實測椒麻芹菜肉末這道菜後校正過的重點，v1 規則曾經因為「4 種來源」就誤判成大辣，實際吃起來是中辣）：
   - Tier 1（微量）：少許、少量、可選、≤ 1/2 小匙
   - Tier 2（小量明確）：約 1 小匙、1~2 根/顆
   - Tier 3（中量）：1 大匙 ~ 2 大匙，或 3~5 根/顆
   - Tier 4（大量）：> 2 大匙、整把、大量
3. 完全沒有辣度來源 → `不辣`（或省略 `spice_level` 欄位）。
4. 只有 Tier 1 的來源，且種類 ≤ 2 種 → `微辣`。
5. 符合以下任一條件 → `中辣`：至少一個辣度來源達到 Tier 2 或 Tier 3；或有 3 種以上不同辣度來源疊加，但沒有任何一個到達 Tier 3 以上（即使種類多、個別都只是少量點綴，也不直接跳大辣）。
6. 符合以下任一條件 → `大辣`：食譜名稱或原文出現「麻辣／爆辣／重辣／死辣」等明確強辣描述；或任一辣度來源達到 Tier 4；或 4 種以上不同辣度來源疊加，且至少一種達到 Tier 3 以上。
7. **烹調方式是「燉／滷／湯」、湯汁份量大（水蓋過主料）時，稀釋效果會大幅降低感知辣度**——單一辣度來源即使份量達到 Tier 2、機械算出來是中辣，實際吃起來常常只是提味、感覺不到辣，這種情況判斷可以下修一級（中辣→微辣，甚至不辣），回覆裡要註明「機械規則算出來是 X，但因為是大量湯汁稀釋，我判斷比較接近 Y」讓使用者確認。真實案例：家常滷肉只放 1 根辣椒提味，機械規則算中辣，實際成品完全不辣。
8. 這是輔助判斷，不是絕對規則——花椒帶來的「麻」跟辣椒的「辣」不完全是同一種感受，但這裡先都算進辣度來源，判斷有明顯不合理時（例如花椒只是裝飾、根本不會吃下去），可以在回覆裡註明「規則判斷為 X，但實際可能偏 Y」，讓使用者視情況調整，不需要為此中斷流程先問；使用者確認判斷不準時，直接照使用者的判斷寫入，並視情況把規則本身也一併校正（像這次一樣），不用來回爭論規則該不該改。

## 素材庫維護（新增/刪除庫存項目時）

`data/pantry.json` 是**依分類分組的物件**（不是扁平字串陣列）：

```json
{ "分類名稱": ["正式名稱1", "正式名稱2"] }
```

分類名稱固定從 `data/taxonomy.json` 的 `pantry_categories` 詞彙表裡選（目前是：香料、香草、調味粉、調味料、醬、辛香蔬菜、起司、罐頭/醃漬、主食、生鮮食材）。跟其他分類詞彙表一樣，除非使用者明確要求，不要新增表裡沒有的分類值。

**單一項目的日常新增/刪除，使用者可以直接在網站「食材庫」分頁操作**（會直接寫回 GitHub，見下一節），不一定要透過 Claude Code 對話。但下列情況仍然要在 Claude Code 對話裡處理：

1. **批次新增/大幅調整素材庫**（一次要加好幾個項目、或要重新分類）：比照食譜的作法，先列出來讓使用者 review 再寫檔。
2. **同義詞生成**：新增一個素材庫項目時，主動幫使用者想幾個常見別名/同義詞候選（考慮台灣常見講法、簡稱），列出來讓使用者 review、確認每個候選在食材意義上真的等價（例如「蒜苗」不是「蔥」的別名、「香油」不是「麻油」的別名，即使容易混淆也不可隨意合併），使用者確認後才寫入 `data/synonyms.json`：
   ```json
   { "正式名稱": ["正式名稱", "別名1", "別名2"] }
   ```
   如果網站「食材庫」分頁新增的項目還沒有對應的同義詞群組，記得在下次對話中提醒使用者要不要順便補上別名——網站本身不會、也不應該自動生成同義詞（同義詞生成屬於離線輔助工作，不是網站執行期功能）。
3. 如果某個素材庫項目目前想不到有意義的別名，`synonyms.json` 裡至少要有一筆 `"正式名稱": ["正式名稱"]`，讓查表邏輯能命中自己。
4. 刪除素材庫項目時，同步詢問是否要一併移除 `synonyms.json` 裡對應的群組（不移除也不會壞，只是留著沒作用的資料）。

## 食材別名的「不可合併」原則，以及家族關係（`data/ingredient_families.json`）

**同義詞（`synonyms.json`）只能收「對烹飪來說完全可以互相取代」的講法**，不能因為兩個詞長得像、或字面上有包含關係就合併。已知的反例（不可合併）：蒜苗≠蔥、香油≠麻油、花椒粒≠花椒粉、青花椒≠紅花椒、**醬油≠醬油膏**（質地跟用途不同，醬油膏是加了澱粉的濃稠版，常用來沾/收尾，不是醬油的另一種寫法）。判斷原則：**只要「品種」或「形態／加工方式」任一軸不同，就不是同義詞**，即使原文只用一個籠統的詞（例如單純寫「花椒」），也不要因此把它塞進某個特定品種/形態的同義詞群組——寧可讓它比對不到、由下面的「家族」機制軟提示，也不要製造誤判成「已有」的假陽性。

真實案例（曾經是 bug）：`synonyms.json` 一度把 `"花椒": ["花椒", "花椒粒", "花椒粉"]` 合併成一群，但素材庫裡「花椒」跟「花椒粉」其實是兩個獨立項目，導致食譜寫「花椒粉」時，比對邏輯查到「花椒」在庫存裡就誤判成「已有」，即使實際上沒有花椒粉。修法是把這個群組拆開成各自獨立、不互相合併的同義詞群組，籠統的講法就讓它比對不到，交給「家族」機制處理。

**家族關係**（`data/ingredient_families.json`）是介於「同義詞（完全可取代）」跟「完全不相關」之間的第三種關係，用來處理「同一個食材，衍生出多個品種/形態，使用者庫存裡可能有其中一種，但食譜講得籠統、看不出是哪一種」的情況：

```json
{ "家族代表詞": ["同義詞群組正式名稱1", "同義詞群組正式名稱2"] }
```

- key 是一個籠統的字（例如「花椒」），value 是這個家族底下、各自是獨立同義詞群組正式名稱的陣列。
- 比對邏輯（`assets/app.js` 的 `pantryStatus`）：先照 `isInPantry` 做嚴格比對，比對到才算「已有」（have）；比對不到時，才看食材名稱是否包含/被包含於某個家族代表詞，且該家族裡有任一成員在庫存中，是的話算「可能已有，請確認品種/形態」（maybe，畫面上是琥珀色，還需要買清單裡會分開列出來）；兩者都沒有才算「還需要買」（missing）。
- 新增家族關係時，跟同義詞一樣要讓使用者 review 確認：這個籠統詞底下真的有哪些品種/形態、使用者庫存裡實際有哪些，不要自己亂猜著寫。
- 什麼時候該新增家族關係：發現某個食材有明顯的品種/形態分支、而且使用者庫存剛好有其中特定一種時（像花椒、白胡椒粒/白胡椒粉、黑胡椒粉的案例）。不是每個食材都需要，多數食材維持單純的同義詞比對就夠了。
- **這個「不可合併」原則不是只有花椒才要注意**——只要一個食材同時有「粒/粉」「新鮮/乾燥」「品種」這類會影響用法的分支，新增同義詞或補資料時都要先檢查會不會犯同樣的錯（例如這次補「白胡椒粉」的同義詞時，一度手滑把籠統的「白胡椒」也合併進去，就是同一種錯誤，事後才發現修正）。

**另外兩個真實案例（演算法層級的 bug，不是資料層級，修過兩輪才穩定）**：

1. 新增 `"米": ["米", "白米"]` 後，食譜寫「米酒」被誤判成已有——因為「米酒」「味醂」的別名「米霖」字面上都包含「米」這個字根。第一輪修法：加了 `looseMatch()`，要求寬鬆子字串比對時「比較短的那一邊至少 2 個字」，單一漢字只接受完全相等。
2. 但這樣還不夠：「醬油膏」被誤判成跟「醬油」已有，因為「醬油」（2 字）跟「醬油膏」（3 字）都 ≥ 2 字，通過了 `looseMatch()` 的長度門檻，卻仍然是完全不同的食材。中文很多食材名是「字＋字」直接黏在一起組成不同東西（米→米酒、醬油→醬油膏、花→花椒），不是只有單一漢字才會這樣，字數門檻擋不住這種情況。

最終修法是 `assets/app.js` 的 `safeExtension(longer, shorter)`：只有兩種情況把「較長字串包含較短字串」當作同一食材的延伸寫法直接判定已有——(a) 較短字串在開頭、後面接的是括號備註（例：「辣椒（切末）」延伸自「辣椒」），或 (b) 較短字串在結尾、前面是「新鮮/乾燥/生/熟」這類不影響食材本身的敘述性前綴。其餘所有「較長字串包含較短字串」的狀況（例如字直接黏在一起形成新品項）一律不算安全延伸。這是通用的演算法防呆，不是逐一資料修正——之後如果又出現類似的誤判，先檢查是不是新的「字黏在一起變成不同食材」案例，理論上已經被 `safeExtension` 擋掉了，但如果發現新的漏網案例要在這裡補充說明，也可以視情況擴充 `SAFE_DESCRIPTIVE_PREFIXES` 這個安全前綴清單。

### 解析食譜時，判斷食材是「粒」還是「粉」

食譜原文如果只寫籠統的名稱（例如單純「胡椒」「黑胡椒」，沒說粒還是粉），**先看烹調情境判斷**，不要每次都停下來問使用者：

- 步驟是「久煮/燉/滷/熬湯」，這類辛香料通常是整粒下去煮出味道、之後可能撈除或留著 → 傾向判斷成**粒**（例如「白胡椒粒」）。
- 步驟是「起鍋前/盛盤後/撒上/拌入」這類快速的最後調味動作 → 傾向判斷成**粉**（例如「黑胡椒粉」）。
- 如果原文的動詞/情境看不出傾向（例如只單純列在食材表，沒有對應到步驟細節），**不要用上面兩條硬猜**，維持原文的籠統寫法（例如就寫「黑胡椒」），讓它落到家族機制顯示「可能已有，請確認品種/形態」，並在回覆裡跟使用者說明這裡沒有把握判斷、原文就是這樣寫。
- 判斷完（不管是用情境推斷、還是維持籠統）都要在回覆裡簡短說明依據，讓使用者可以一眼確認，不需要為此中斷流程先問。

## 網站直接寫入 GitHub（架構例外）

這是專案裡允許網站執行期寫入資料的地方，設計如下（改動前務必先跟使用者確認，不要自作主張擴大範圍）：

- 使用者在「食材庫」分頁貼上一組 **fine-grained GitHub token**，只給 `w731124/recipe-platform` 這個 repo 的 Contents 讀寫權限，其餘權限一律不給。這組 token 是共用的：食材庫的新增/刪除、食譜的刪除都用同一組。
- Token 只存在瀏覽器的 `localStorage`（key: `recipe_platform_gh_token`），**絕對不可以**出現在原始碼、commit 記錄或 repo 裡的任何檔案。
- 共用的 GitHub 讀寫邏輯在 `assets/app.js` 的 `readJsonFileFromGitHub` / `updateJsonFileOnGitHub` / `deleteFileOnGitHub`，都是「先用 `cache: no-store` 抓 GitHub 上真正最新的內容跟 sha，套用變更，再寫回去；遇到 409 衝突自動重試最多 3 次」的模式，新增其他直接寫入操作時應該重用這幾個函式，不要另外寫一套。
- 目前允許的操作範圍**只有**：
  - `data/pantry.json` 的新增/刪除單一項目。
  - 刪除食譜：先更新 `data/recipes/index.json` 移除該 id，再刪除 `data/recipes/{id}.json`（順序不能反過來，否則中途失敗會讓 index.json 留著指向不存在檔案的 id，前端一次 fetch 全部食譜時會整批失敗）。
- 不要把這個模式擴大到食譜的新增/編輯、`taxonomy.json`、`synonyms.json`——那些仍然要走 Claude Code 離線流程，理由見 PROJECT_SPEC.md 第 2 節（避免網站執行期出現不可控的寫入邏輯、保留人工 review 環節）。
- 沒有設定 token 的訪客仍然可以正常瀏覽食材庫內容、食譜內容（唯讀），只是看不到新增/刪除/刪除食譜的按鈕，符合「單一維護者上傳、其他人唯讀瀏覽」的定位。

## 分類詞彙表（`data/taxonomy.json`）維護原則
- `cuisine` 刻意只停在「中式／西式／其他」這一層，不要往下細分國家（例如不要自作主張加「日式」「泰式」），因為很多菜色本來就跨國別，硬分反而製造分類困難。跨菜系的差異改用 `cooking_methods` / `main_ingredient_types` 這些不受國別限制的維度來區分。
- 除非使用者明確要求，不要新增詞彙表裡沒有的分類值。

## 前端行為（`assets/app.js`，非必要不要改動核心邏輯）
- 素材庫比對邏輯（`isInPantry`）：先查 `synonyms.json` 找出食材所屬的同義詞群組，群組的正式名稱若在 `pantry.json`（攤平後的 `state.pantryFlat`）裡就標記已有；如果食材完全沒有對應的同義詞群組，才退回直接對素材庫做字面包含比對。這是刻意設計，修改前先看 `PROJECT_SPEC.md` 第 5 節的理由。
- 比對結果是三態（`pantryStatus`）：`have`（嚴格同義詞比對命中，綠色）／`maybe`（同義詞比對不到，但命中 `ingredient_families.json` 的家族關係，琥珀色，提示使用者自行確認品種/形態）／`missing`（都比對不到，還需要買）。詳細頁的逐項高亮跟購物清單（`renderShoppingList`）都要用這同一份三態邏輯，不要各自維護一套比對規則。
- 篩選是多維度並列（facet），不是巢狀樹狀選單；同一維度內單選或複選依 `FACETS` 設定裡的 `multi` 決定。
- 食譜詳細頁的食材區塊依 `ingredients[].category` 動態分組、依 `taxonomy.pantry_categories` 的順序顯示，該食譜沒用到的分類不顯示（不像食材庫分頁會列出全部 9 類含空分類）——這是刻意設計，讓食譜詳細頁的分類跟食材庫分頁用同一套詞彙表但呈現邏輯不同，修改前留意這個差異。
- 「食譜」「食材庫」是分頁切換（`showRecipesTab` / `showPantryTab`），不是路由，重新整理頁面會回到食譜分頁，這是刻意的簡化，不需要加 URL hash 之類的路由邏輯。

## 不要做的事
- 不要在前端程式碼裡加入任何 **LLM API key** 或呼叫任何 LLM API——所有解析與同義詞生成都應該發生在 Claude Code 對話裡，不是網站執行期。（食材庫的 GitHub token 是唯一經過確認的例外，見上一節，不要把這個例外泛化成「前端可以放憑證」。）
- 不要用 `fetch` 去抓外部食譜網址；食譜內容一律由使用者貼上文字。
- 不要把 `data/recipes/index.json` 漏更新——這是唯一列出「有哪些食譜檔案」的清單，前端沒有目錄列表能力。
- 不要把網站直接寫入 GitHub 的模式擴大到「食材庫新增/刪除」「食譜刪除」以外的操作（尤其是食譜的新增/編輯），也不要把 token 硬編碼進原始碼或以任何方式提交進 repo。
```

### ./CODEBASE_SNAPSHOT.md
```md
```

### ./PROJECT_SPEC.md
```md
# 食譜筆記本網站 — 專案規格 v0.1

## 1. 定位
- 單一維護者（Harry）上傳/整理食譜，公開展示給任何人（含少數朋友）唯讀瀏覽。
- 無登入系統、無多使用者帳號。安全邊界靠「不公開 GitHub Token / 不給他人 push 權限」，而不是靠應用層權限控管。

## 2. 架構（純靜態展示網站，解析工作在網站之外完成）

```
你的開發環境（VS Code + Claude / Claude Code，離線於網站之外）
  ├─ 把蒐集到的食譜原文（文字或從網頁複製）交給 Claude / Claude Code
  ├─ Claude 依照本文件第 4 節的 JSON schema 產出結構化資料
  ├─ 你 review / 修正解析結果（AI 對「適量」「少許」等模糊份量的判斷不會 100% 正確）
  ├─ Claude Code 把 JSON 檔案寫入 /data/recipes/，並直接執行 git add/commit/push（前提：你的本機已設定好該 repo 的 git remote 與推送憑證，例如 SSH key 或已登入的 credential helper，這是一次性環境設定，不在本文件範圍內）
  └─ GitHub Pages 偵測到 repo 更新 → 自動重新部署靜態網站

瀏覽器（你或朋友，任何訪客）
  └─ 純瀏覽 GitHub Pages 上已經部署好的靜態內容，做篩選/查找/素材庫比對高亮，不能寫入、不需要任何 key
```

**關鍵決定與理由：**
- 網站本身不含任何解析邏輯，只是一個讀取 `/data/*.json` 並渲染成介面的前端（純 HTML/CSS/JS，或用一個前端框架 build 成靜態檔案再部署到 GitHub Pages）。這是可能的最簡架構：沒有 LLM API key 外洩風險、沒有 CORS 問題、沒有版權爬取疑慮，因為「取得食譜內容」這個動作完全發生在你自己的 Claude 對話裡，不是網站自動抓取。
- **例外（v0.2 新增，v0.3 擴大）**：兩種操作允許網站執行期直接寫入。做法是讓瀏覽器直接呼叫 GitHub Contents API，用你自己貼上、存在瀏覽器 localStorage 的 fine-grained token（只開這個 repo 的 Contents 讀寫權限）建立 commit：
  1. 食材庫（`data/pantry.json`）的新增/刪除。
  2. 食譜的刪除（同時更新 `data/recipes/index.json`）。
  這個例外只開放給「低風險、你自己常態操作」的刪除/簡單新增動作；食譜的新增/編輯仍然維持「網站唯讀、寫入靠 Claude Code 離線 + git push」的原則，因為那需要人工 review（份量判斷、同義詞語意）才適合寫入，不適合開放成即時可寫。細節見 `CLAUDE.md`「網站直接寫入 GitHub」一節。
- 「上傳」不是網站功能，是你的開發工作流程的一部分：每次要新增食譜，就是一次「你跟 Claude Code 互動 → 產生 JSON → git push」的循環。這代表使用者體驗上不會有「上傳按鈕」，只有「開發者更新資料、訪客看結果」兩種角色，跟你目前的分工（你維護、朋友純看）完全一致。
- Repo 全公開，包含個人素材庫與所有食譜資料，你已確認可接受。

## 3. 資料儲存
- 資料庫 = repo 內的 JSON 檔案，git commit 歷史即版本紀錄。
- 建議目錄結構：
  ```
  /data/recipes/{slug}-{timestamp}.json   # 每份食譜一個檔案
  /data/pantry.json                        # 個人素材庫，依 taxonomy.pantry_categories 分類分組（{"分類": ["項目", ...]}），單項新增/刪除可由網站直接寫入
  /data/synonyms.json                      # 食材同義詞庫（AI 離線輔助生成，人工 review 後維護，供比對用）
  /data/taxonomy.json                      # 分類詞彙表（菜系、烹調方式、食材庫分類等，人工維護，供篩選/分類用）
  ```
- 選擇「一食譜一檔」而非單一大 JSON：多次上傳時 git diff 清楚、不容易因單一大檔案損毀而全部遺失。

## 4. 食譜資料結構（v0.3：食材改成單一陣列 + 沿用食材庫 9 大分類）

```json
{
  "id": "string",
  "title": "string",
  "source": "string，例如來源網站名稱或備註",
  "ingredients": [
    { "name": "蝦仁", "amount": "300", "unit": "g", "category": "生鮮食材" },
    { "name": "醬油", "amount": "1", "unit": "大匙", "category": "調味料" },
    { "name": "白胡椒粉", "amount": "適量", "category": "調味粉" }
  ],
  "steps": [
    { "order": 1, "text": "..." }
  ],
  "cuisine": "中式",
  "cooking_methods": ["快炒"],
  "main_ingredient_types": ["海鮮"],
  "course": "主菜",
  "spice_level": "不辣",
  "created_at": "ISO date",
  "raw_input": "原始貼上的文字，保留備查/重新解析用"
}
```

- `amount` 一律存成字串，因為「適量」「少許」這類非數值必然存在，若存成數字型別會在解析時炸掉。原文沒提供份量時，`amount`/`unit` 整個欄位省略，不強迫填值、也不要求你每次補——上傳量一大，逐筆確認份量會讓這個工具失去「快速整理」的意義。網站不顯示、也不管理「幾人份」「烹調時間」，schema 沒有 `servings`、`time_minutes` 欄位。
- 保留 `raw_input`：AI 解析錯誤時，你需要對照原文手動修正，這個欄位不能省略，否則校正介面沒有依據。
- 分類欄位拆成多個獨立維度（見第 7 節），而非單一 `tags` 陣列或巢狀分類樹，理由見第 7 節第 1 點。
- `ingredients[].category` 沿用素材庫的 9 大分類（`taxonomy.pantry_categories`），不再另外維護一套食譜專用的食材分類——食譜詳細頁跟食材庫分頁用同一套詞彙表分組顯示，兩邊看到的分類概念一致，也省去維護兩份分類邏輯。
- `spice_level` 由 Claude Code 依關鍵字＋份量規則自動判斷（見 `CLAUDE.md`），不再每則食譜都詢問你——辣度本來就主觀，但用一套一致的規則估算，比每次臨場判斷更穩定，你事後覺得不準再個別調整即可。

## 5. 個人素材庫比對邏輯（v2：同義詞庫查表，AI 只在離線維護時輔助）

放棄純字面包含匹配（原因：會誤判「蝦皮」「薑黃粉」這類包含關鍵字但實際是不同商品的情況，也無法關聯「花枝/透抽/小卷」這類同物異名）。改用**離線建立、執行期查表**的同義詞庫方案：

- **維護時（離線，在 Claude / Claude Code 對話中）**：你新增/修改素材庫項目時，請 Claude 協助列出常見別名，你 review 後才寫入 `/data/synonyms.json`。AI 只在這個當下被使用一次，不參與網站執行期的任何運算。
- **執行時（瀏覽器，純查表，無 API 呼叫）**：網站載入 `synonyms.json`，把每個食譜食材的文字對照到某個同義詞群組，若該群組包含素材庫裡的項目，就標記為「已有」並套用高亮樣式。這一步是單純的字典查詢，不需要任何 AI 呼叫，維持純靜態架構、零延遲、零額外成本。
- 資料結構草案（`/data/synonyms.json`）：
  ```json
  {
    "花枝": ["花枝", "透抽", "小卷"],
    "蔥": ["蔥", "青蔥", "珠蔥", "大蔥"]
  }
  ```
  key 為素材庫使用的正式名稱，value 為該群組所有已知別名（含正式名稱本身）。比對邏輯：食材文字若等於/包含某個 value 陣列裡的任一別名，就視為屬於該 key 群組。
- 已知限制：只能涵蓋同義詞庫裡已收錄的別名，遇到完全沒預料到的新別名（例如某食譜寫「軟絲」而庫裡沒收錄）仍會漏判，需你事後手動補進 `synonyms.json`。這比純字面比對的誤判率低很多，但不是 100% 自動化，仍需要你偶爾維護。
- 重要提醒：合併同義詞前必須先確認語意上真的是同一食材，例如「蒜苗」不是「蔥」的別名，不能因為長得像就合併，否則會製造新的誤判。這件事沒辦法靠程式規則防呆，只能靠你（或你要求 Claude）在生成同義詞時做食材知識上的把關。

## 6. 校正流程（brief 中遺漏、但必要的環節）
- 解析既然發生在 Claude / Claude Code 對話裡，校正也在同一個對話中完成：Claude 產出 JSON 後，你 review 一次再確認 commit，而不是無條件信任解析結果直接寫入。
- 原因：AI 對「適量」「少許」「一把」等模糊份量、以及台式/中式料理的食材別名，錯誤率不會是 0。
- 建議：在 repo 根目錄放一份 `CLAUDE.md`，寫清楚第 4 節的 JSON schema、第 5 節的同義詞庫維護規則、以及分類詞彙表的既有值，這樣每次開新的 Claude Code 對話要求「幫我整理這則食譜」或「幫我把新素材加進素材庫並想同義詞」時，不用重新解釋規格，Claude Code 會自動照既定格式輸出並直接寫檔。這份 CLAUDE.md 可以之後請 Claude Code 依本文件內容自動產生。

## 7. 分類體系與規模（已定案）

### 7.1 分類體系：多維度標籤，不用單一階層樹
你提出的問題本質是對的：「用國家/菜系當第二層」會失敗，因為很多菜（例如打拋豬算東南亞還是中式？塔香雞丁算不算中式？）本來就不是單一國家能歸類的，硬塞階層只會逼你每次都在邊界案例上猶豫、資料品質反而變差。

解法是放棄「一個食譜只能屬於一個分類」的階層式思維，改用**互相獨立的分類維度（facet）**，一個食譜可以同時在每個維度各自歸類一次，查找時用維度交叉篩選（例如「烹調方式=炒」+「主食材=海鮮」同時勾選），而不是沿著樹狀目錄一路點下去：

- **菜系 `cuisine`**（單選，允許為空/不分類）：中式、西式、其他 — 你已確認這是最大分類，且明確表示不想在第二層繼續用國家細分，所以這裡就停在最粗的一層，不再往下分東南亞/日式/韓式等，遇到難歸類的菜就填「其他」或留空，不強迫湊進中式或西式。
- **烹調方式 `cooking_methods`**（可複選）：炒、滷、蒸、烤、炸、燙/汆燙、涼拌、燉、湯、生食。這個維度不受國別限制，泰式打拋豬跟中式塔香雞丁可以同時被標「炒」，查找時自然被歸在一起，不需要先決定它是哪一國菜。
- **主食材類型 `main_ingredient_types`**（可複選）：肉類、海鮮、蛋豆製品、蔬食、澱粉/主食、加工品。
- **餐點角色 `course`**（單選）：主菜、配菜、湯品、甜點、醬料/沾醬、早餐。
- **辣度 `spice_level`**（單選，可選填）：不辣、微辣、中辣、大辣。

這五個維度各自建一份固定詞彙表存在 `/data/taxonomy.json`（例如 `cooking_methods` 目前允許哪些值），Claude Code 解析新食譜時對照這份詞彙表填值；遇到詞彙表沒有的新詞由你決定是否要擴充詞彙表，避免同義詞氾濫（例如「熱炒」「快炒」都算「炒」）。網站篩選介面就是把這五個維度做成核取方塊/下拉選單的交叉篩選，不是巢狀選單。

### 7.2 規模
短期內 100 筆以內。這個量級前端可以直接把所有食譜摘要一次載入（不需要分頁、不需要建索引檔、不需要處理效能問題），先前規格草案裡「量級若破千才需要處理」的但書可以直接排除，v1 不用考慮這件事。
```

### ./README.md
```md
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
```

### ./assets/app.js
```js
// 食譜筆記本 — 純前端靜態網站
// 資料來源：/data/*.json，無任何後端或 API 呼叫（食材庫寫入除外，見下方 GitHub 直接寫入區塊）。
// 素材庫比對邏輯見 PROJECT_SPEC.md 第 5 節（同義詞庫查表）。

const state = {
  recipes: [],
  pantry: {},
  pantryFlat: [],
  pantryCategories: [],
  synonyms: {},
  ingredientFamilies: {},
  taxonomy: {},
  selectedPantryCategory: null,
  activeFilters: {
    cuisine: null,
    cooking_methods: new Set(),
    main_ingredient_types: new Set(),
    course: null,
    spice_level: null,
  },
};

const FACETS = [
  { key: "cuisine", label: "菜系", multi: false },
  { key: "cooking_methods", label: "烹調方式", multi: true },
  { key: "main_ingredient_types", label: "主食材類型", multi: true },
  { key: "course", label: "餐點角色", multi: false },
  { key: "spice_level", label: "辣度", multi: false },
];

async function loadData() {
  const [taxonomy, pantry, synonyms, families, index] = await Promise.all([
    fetch("data/taxonomy.json").then(r => r.json()),
    fetch("data/pantry.json").then(r => r.json()),
    fetch("data/synonyms.json").then(r => r.json()),
    fetch("data/ingredient_families.json").then(r => r.json()),
    fetch("data/recipes/index.json").then(r => r.json()),
  ]);
  const recipes = await Promise.all(
    index.map(id => fetch(`data/recipes/${id}.json`).then(r => r.json()))
  );
  state.taxonomy = taxonomy;
  state.pantryCategories = taxonomy.pantry_categories || [];
  state.pantry = pantry;
  state.pantryFlat = flattenPantry(pantry);
  state.synonyms = synonyms;
  state.ingredientFamilies = families;
  state.recipes = recipes;
}

function flattenPantry(pantry) {
  return Object.values(pantry).flat();
}

// 食材名稱是否跟某個已知的「家族代表詞」有關（例：「青花椒」跟家族代表詞「花椒」有關）。
// 有關的話，比對時不能用寬鬆的雙向 substring 比對，否則會因為「青花椒粉」這種複合詞字面上
// 包含「青花椒」而被誤判成同義詞命中（實際上形態不同，不該直接判定已有）。
function relatesToFamily(name) {
  return Object.keys(state.ingredientFamilies).some(root => looseMatch(root, name));
}

const MIN_LOOSE_MATCH_LEN = 2;
function looseMatch(a, b) {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  if (shorter.length < MIN_LOOSE_MATCH_LEN) return false;
  return a.includes(b) || b.includes(a);
}

// 中文很多食材名是「字＋字」直接黏在一起組成完全不同的食材，不是原本那個食材的變體
// （米→米酒、醬油→醬油膏、花→花椒，都是「較長字串包含較短字串」但其實是不同東西）。
// 只有兩種情況可以放心把「較長字串包含較短字串」當作同一食材的延伸寫法：
//   1. 較短字串出現在開頭，後面接的是括號備註（例：「辣椒（切末）」延伸自「辣椒」）。
//   2. 較短字串出現在結尾，前面是「新鮮/乾燥/生/熟」這類不影響食材本身的敘述性前綴。
// 其餘一律視為不同食材，不可放心比對，避免「醬油膏」被誤判成「醬油」已有。
const SAFE_DESCRIPTIVE_PREFIXES = ["新鮮", "乾燥", "生", "熟", "冷凍", "有機", "去皮", "帶皮"];
function safeExtension(longer, shorter) {
  if (longer === shorter) return true;
  if (shorter.length < MIN_LOOSE_MATCH_LEN) return false;
  const idx = longer.indexOf(shorter);
  if (idx === -1) return false;
  const before = longer.slice(0, idx);
  const after = longer.slice(idx + shorter.length);
  const beforeOk = before === "" || SAFE_DESCRIPTIVE_PREFIXES.includes(before);
  const afterOk = after === "" || after.startsWith("（") || after.startsWith("(");
  return beforeOk && afterOk;
}

// ---- 素材庫比對（同義詞庫查表，見規格 5 節）----
function isInPantry(ingredientName) {
  const name = ingredientName.trim();
  const ambiguous = relatesToFamily(name);
  let matchedGroup = false;
  for (const [canonical, aliases] of Object.entries(state.synonyms)) {
    const hit = aliases.some(alias => {
      if (alias === name) return true;
      if (safeExtension(name, alias)) return true; // 食譜寫得比同義詞更具體（安全的前綴/備註延伸）
      if (looseMatch(alias, name) && name.length < alias.length) return !ambiguous;
      return false;
    });
    if (hit) {
      matchedGroup = true;
      if (state.pantryFlat.includes(canonical)) return true;
    }
  }
  if (matchedGroup) return false; // 同義詞群組存在，但素材庫沒有該項目
  if (ambiguous) return false; // 跟家族有關的籠統詞交給 familyStatus 處理，這裡不用寬鬆比對誤判成已有
  // 回退：沒有對應同義詞群組時，直接對素材庫做安全延伸比對
  return state.pantryFlat.some(p => safeExtension(name, p));
}

// 「同一家族但品種/形態不確定」的軟比對（例：食譜寫「花椒」，庫存有「紅花椒粒」「青花椒粉」，
// 兩者都不是嚴格同義詞，但值得提醒使用者自己確認，而不是直接判定「還需要買」）
function familyStatus(ingredientName) {
  const name = ingredientName.trim();
  for (const [family, members] of Object.entries(state.ingredientFamilies)) {
    if (looseMatch(family, name)) {
      if (members.some(m => state.pantryFlat.includes(m))) return true;
    }
  }
  return false;
}

// 三態判斷：have（已有）／maybe（同家族但品種或形態不確定，需自行確認）／missing（還需要買）
function pantryStatus(ingredientName) {
  if (isInPantry(ingredientName)) return "have";
  if (familyStatus(ingredientName)) return "maybe";
  return "missing";
}

// ---- 篩選 ----
function matchesFilters(recipe) {
  const f = state.activeFilters;
  if (f.cuisine && recipe.cuisine !== f.cuisine) return false;
  if (f.course && recipe.course !== f.course) return false;
  if (f.spice_level && recipe.spice_level !== f.spice_level) return false;
  if (f.cooking_methods.size > 0) {
    const methods = recipe.cooking_methods || [];
    if (![...f.cooking_methods].every(m => methods.includes(m))) return false;
  }
  if (f.main_ingredient_types.size > 0) {
    const types = recipe.main_ingredient_types || [];
    if (![...f.main_ingredient_types].every(t => types.includes(t))) return false;
  }
  return true;
}

function renderFilters() {
  const el = document.getElementById("filters");
  el.innerHTML = "";

  const resetBtn = document.createElement("button");
  resetBtn.className = "filter-reset";
  resetBtn.textContent = "清除所有篩選";
  resetBtn.onclick = () => {
    state.activeFilters = {
      cuisine: null, cooking_methods: new Set(), main_ingredient_types: new Set(),
      course: null, spice_level: null,
    };
    renderFilters();
    renderList();
  };
  el.appendChild(resetBtn);

  FACETS.forEach(facet => {
    const values = state.taxonomy[facet.key] || [];
    const group = document.createElement("div");
    group.className = "filter-group";
    const h3 = document.createElement("h3");
    h3.textContent = facet.label;
    group.appendChild(h3);

    values.forEach(val => {
      const chip = document.createElement("span");
      chip.className = "filter-chip";
      chip.textContent = val;
      const isActive = facet.multi
        ? state.activeFilters[facet.key].has(val)
        : state.activeFilters[facet.key] === val;
      if (isActive) chip.classList.add("active");
      chip.onclick = () => {
        if (facet.multi) {
          const set = state.activeFilters[facet.key];
          set.has(val) ? set.delete(val) : set.add(val);
        } else {
          state.activeFilters[facet.key] = state.activeFilters[facet.key] === val ? null : val;
        }
        renderFilters();
        renderList();
      };
      group.appendChild(chip);
    });
    el.appendChild(group);
  });
}

function renderList() {
  const el = document.getElementById("recipe-list");
  el.innerHTML = "";
  const filtered = state.recipes.filter(matchesFilters);

  if (filtered.length === 0) {
    el.innerHTML = `<div class="empty-state">沒有符合篩選條件的食譜。</div>`;
    return;
  }

  filtered.forEach(recipe => {
    const card = document.createElement("div");
    card.className = "recipe-card";
    card.onclick = () => showDetail(recipe.id);
    const tags = [recipe.cuisine, ...(recipe.cooking_methods || []), recipe.course]
      .filter(Boolean);
    card.innerHTML = `
      <h3>${escapeHtml(recipe.title)}</h3>
      <div class="tag-row">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
    `;
    el.appendChild(card);
  });
}

// 把「洋蔥（切絲）」拆成 { base: "洋蔥", note: "切絲" }，讓卡片可以把備註獨立成小字第二行，
// 不用把處理方式/可選說明全部擠在食材名稱裡。
function splitIngredientNote(name) {
  const match = name.match(/^(.*?)[（(]([^）(]*)[）)]\s*$/);
  if (!match) return { base: name.trim(), note: "" };
  return { base: match[1].trim(), note: match[2].trim() };
}

function renderIngredientList(items) {
  if (!items || items.length === 0) return "<p class=\"legend\">（無）</p>";
  return `<ul class="ingredient-list">${items.map(item => {
    const status = pantryStatus(item.name);
    const hint = status === "maybe" ? `<span class="ing-hint" title="家族相近，品種或形態可能不同，請自行確認">？</span>` : "";
    const { base, note } = splitIngredientNote(item.name);
    const isOptionalNote = /可選|推薦/.test(note);
    const noteHtml = note
      ? `<div class="ing-note${isOptionalNote ? " ing-note-optional" : ""}">${escapeHtml(note)}</div>`
      : "";
    return `<li class="${status}">
      <div class="ing-main">
        <span class="ing-name">${escapeHtml(base)}${hint}</span>
        <span class="ing-amount">${escapeHtml([item.amount, item.unit].filter(Boolean).join(" "))}</span>
      </div>
      ${noteHtml}
    </li>`;
  }).join("")}</ul>`;
}

// 食材區塊依 taxonomy.pantry_categories 的順序分組顯示，該食譜沒用到的分類不顯示
// （跟食材庫分頁會列出全部 9 類含空分類不同，這裡只顯示食譜實際用到的分類）
function renderIngredientsByCategory(recipe) {
  const items = recipe.ingredients || [];
  const known = new Set(state.pantryCategories);
  const blocks = state.pantryCategories
    .filter(cat => items.some(i => i.category === cat))
    .map(cat => `<div class="section-block">
      <h4>${escapeHtml(cat)}</h4>
      ${renderIngredientList(items.filter(i => i.category === cat))}
    </div>`);

  const uncategorized = items.filter(i => !known.has(i.category));
  if (uncategorized.length) {
    blocks.push(`<div class="section-block">
      <h4>其他</h4>
      ${renderIngredientList(uncategorized)}
    </div>`);
  }
  return `<div class="ingredients-grid">${blocks.join("")}</div>`;
}

// 購物清單只顯示食材本名，「（切絲）」「（可選，推薦加入…）」這類備註留給下面完整的食材清單顯示
function stripNotes(name) {
  return name.replace(/[（(][^）)]*[）)]/g, "").trim();
}

function renderShoppingList(recipe) {
  const items = recipe.ingredients || [];
  const statused = items.map(item => ({ name: stripNotes(item.name), status: pantryStatus(item.name) }));
  const missingNames = [...new Set(statused.filter(i => i.status === "missing").map(i => i.name))];
  const maybeNames = [...new Set(statused.filter(i => i.status === "maybe").map(i => i.name))];

  if (missingNames.length === 0 && maybeNames.length === 0) {
    return `<div class="shopping-list"><p class="legend">✅ 素材庫都有，不用額外採購！</p></div>`;
  }
  const missingBlock = missingNames.length
    ? `<h4>🛒 還需要買</h4>
       <div class="tag-row">${missingNames.map(n => `<span class="tag missing">${escapeHtml(n)}</span>`).join("")}</div>`
    : "";
  const maybeBlock = maybeNames.length
    ? `<h4>🤔 可能已有，請確認品種/形態</h4>
       <div class="tag-row">${maybeNames.map(n => `<span class="tag maybe">${escapeHtml(n)}</span>`).join("")}</div>`
    : "";
  return `<div class="shopping-list">${missingBlock}${maybeBlock}</div>`;
}

function showDetail(id) {
  const recipe = state.recipes.find(r => r.id === id);
  if (!recipe) return;

  document.getElementById("list-view").classList.add("hidden");
  const detail = document.getElementById("detail-view");
  detail.classList.remove("hidden");

  detail.innerHTML = `
    <div class="detail-top-bar">
      <button class="back-btn" id="back-btn">← 回列表</button>
      <button class="delete-recipe-btn" id="delete-recipe-btn">🗑 刪除食譜</button>
    </div>
    <h2 class="detail-title">${escapeHtml(recipe.title)}</h2>
    ${recipe.source ? `<div class="detail-meta">來源：${escapeHtml(recipe.source)}</div>` : ""}
    ${renderShoppingList(recipe)}
    <p class="legend"><span class="dot"></span>綠色底色代表素材庫已有此項目</p>

    ${renderIngredientsByCategory(recipe)}
    <div class="section-block">
      <h4>做法</h4>
      <ol class="steps">
        ${(recipe.steps || []).sort((a, b) => a.order - b.order)
          .map(s => `<li>${escapeHtml(s.text)}</li>`).join("")}
      </ol>
    </div>
  `;
  document.getElementById("back-btn").onclick = () => {
    detail.classList.add("hidden");
    document.getElementById("list-view").classList.remove("hidden");
  };
  document.getElementById("delete-recipe-btn").onclick = async () => {
    if (!getGhToken()) {
      alert("尚未設定 GitHub token，請先到食材庫分頁貼上 token（刪除食譜共用同一組 token）。");
      return;
    }
    if (!confirm(`確定要刪除「${recipe.title}」嗎？此動作無法從網站復原（但 git 歷史紀錄還找得回來）。`)) return;

    const btn = document.getElementById("delete-recipe-btn");
    btn.disabled = true;
    btn.textContent = "刪除中…";
    try {
      await deleteRecipe(recipe.id);
      detail.classList.add("hidden");
      document.getElementById("list-view").classList.remove("hidden");
      renderList();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "🗑 刪除食譜";
      alert(err.message);
    }
  };
  window.scrollTo(0, 0);
}

// ---- GitHub 直接寫入 ----
// 只有食材庫的新增/刪除、食譜的刪除會呼叫 GitHub API；其餘資料（食譜新增/編輯、分類詞彙表等）
// 仍照 CLAUDE.md 既定流程，由 Claude Code 離線寫入 + git push。
const GH_OWNER = "w731124";
const GH_REPO = "recipe-platform";
const GH_BRANCH = "main";
const GH_PANTRY_PATH = "data/pantry.json";
const GH_RECIPES_INDEX_PATH = "data/recipes/index.json";
const GH_TOKEN_KEY = "recipe_platform_gh_token";

function getGhToken() {
  return localStorage.getItem(GH_TOKEN_KEY) || "";
}
function setGhToken(token) {
  localStorage.setItem(GH_TOKEN_KEY, token.trim());
}
function clearGhToken() {
  localStorage.removeItem(GH_TOKEN_KEY);
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function ghHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
}

async function readJsonFileFromGitHub(path) {
  const token = getGhToken();
  if (!token) throw new Error("尚未設定 GitHub token");
  const res = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}&_=${Date.now()}`,
    { headers: ghHeaders(token), cache: "no-store" }
  );
  if (!res.ok) throw new Error(`讀取 ${path} 失敗（HTTP ${res.status}）`);
  const data = await res.json();
  return { sha: data.sha, json: JSON.parse(base64ToUtf8(data.content)) };
}

// mutateFn(currentJson) -> newJson，永遠是「先抓 GitHub 上真正最新的內容，套用變更，再寫回去」，
// 不依賴頁面載入時的 state（那份可能是 GitHub Pages 部署延遲下的舊版），避免連續操作互相覆蓋。
async function updateJsonFileOnGitHub(path, mutateFn, message, attempt = 0) {
  const token = getGhToken();
  if (!token) throw new Error("尚未設定 GitHub token");

  const { sha, json: current } = await readJsonFileFromGitHub(path);
  const newJson = mutateFn(current);

  const content = utf8ToBase64(JSON.stringify(newJson, null, 2) + "\n");
  const putRes = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`,
    {
      method: "PUT",
      headers: { ...ghHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ message, content, sha, branch: GH_BRANCH }),
    }
  );
  if (!putRes.ok) {
    if (putRes.status === 409 && attempt < 3) {
      // sha 剛好在這瞬間被別的變更超前，重抓最新內容再套用一次變更
      await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
      return updateJsonFileOnGitHub(path, mutateFn, message, attempt + 1);
    }
    if (putRes.status === 409) {
      throw new Error("有其他變更同時發生（衝突），已自動重試多次仍失敗，請重新整理頁面後再試一次。");
    }
    const err = await putRes.json().catch(() => ({}));
    throw new Error(`寫入 ${path} 失敗（HTTP ${putRes.status}）：${err.message || "未知錯誤"}`);
  }
  return newJson;
}

async function deleteFileOnGitHub(path, message, attempt = 0) {
  const token = getGhToken();
  if (!token) throw new Error("尚未設定 GitHub token");

  const getRes = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}&_=${Date.now()}`,
    { headers: ghHeaders(token), cache: "no-store" }
  );
  if (!getRes.ok) throw new Error(`讀取 ${path} 失敗（HTTP ${getRes.status}）`);
  const getData = await getRes.json();

  const delRes = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`,
    {
      method: "DELETE",
      headers: { ...ghHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ message, sha: getData.sha, branch: GH_BRANCH }),
    }
  );
  if (!delRes.ok) {
    if (delRes.status === 409 && attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
      return deleteFileOnGitHub(path, message, attempt + 1);
    }
    if (delRes.status === 409) {
      throw new Error("有其他變更同時發生（衝突），已自動重試多次仍失敗，請重新整理頁面後再試一次。");
    }
    const err = await delRes.json().catch(() => ({}));
    throw new Error(`刪除 ${path} 失敗（HTTP ${delRes.status}）：${err.message || "未知錯誤"}`);
  }
}

async function addPantryItem(category, name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const newPantry = await updateJsonFileOnGitHub(GH_PANTRY_PATH, current => {
    const updated = JSON.parse(JSON.stringify(current));
    if (!updated[category]) updated[category] = [];
    if (updated[category].includes(trimmed)) throw new Error("這個項目已經在食材庫裡了");
    updated[category].push(trimmed);
    return updated;
  }, `素材庫：新增「${trimmed}」`);
  state.pantry = newPantry;
  state.pantryFlat = flattenPantry(newPantry);
}

async function removePantryItem(category, name) {
  const newPantry = await updateJsonFileOnGitHub(GH_PANTRY_PATH, current => {
    const updated = JSON.parse(JSON.stringify(current));
    updated[category] = (updated[category] || []).filter(n => n !== name);
    return updated;
  }, `素材庫：移除「${name}」`);
  state.pantry = newPantry;
  state.pantryFlat = flattenPantry(newPantry);
}

// 先更新 index.json 移除該 id，再刪除食譜檔案本身——順序反過來的話，
// 萬一中途失敗，index.json 會留著一個指向已刪除檔案的 id，讀取食譜清單時整批 fetch 會失敗。
async function deleteRecipe(id) {
  await updateJsonFileOnGitHub(
    GH_RECIPES_INDEX_PATH,
    current => current.filter(x => x !== id),
    `更新食譜清單：移除 ${id}`
  );
  await deleteFileOnGitHub(`data/recipes/${id}.json`, `刪除食譜：${id}`);
  state.recipes = state.recipes.filter(r => r.id !== id);
}

function renderPantryView() {
  const el = document.getElementById("pantry-view");
  const token = getGhToken();

  const tokenPanel = token
    ? `<div class="pantry-token-controls">
        <button class="btn-secondary" id="gh-token-clear">清除 Token</button>
      </div>`
    : `<div class="token-panel">
        <p>要在網站上新增/刪除食材庫項目，需要一組只給這個 repo 寫入權限的 GitHub token（沒有 token 也可以瀏覽目前的素材庫）：</p>
        <ol class="token-steps">
          <li>GitHub → 右上角頭像 → Settings → Developer settings → Fine-grained tokens → Generate new token</li>
          <li>Repository access 選「Only select repositories」，選這個 repo（${GH_OWNER}/${GH_REPO}）</li>
          <li>Permissions → Repository permissions → Contents 設為 <strong>Read and write</strong>，其餘保持沒有權限</li>
          <li>建立後複製 token，貼到下面欄位並儲存</li>
        </ol>
        <div class="token-input-row">
          <input type="password" id="gh-token-input" placeholder="貼上 GitHub token" autocomplete="off">
          <button class="btn-primary" id="gh-token-save">儲存 Token</button>
        </div>
        <p class="legend">Token 只會存在這個瀏覽器的 localStorage，不會寫進原始碼或 repo，只用來呼叫 GitHub API。</p>
      </div>`;

  const selectedCategory = token ? state.selectedPantryCategory : null;

  const categoriesHtml = state.pantryCategories.map(cat => {
    const items = state.pantry[cat] || [];
    const chips = items.length
      ? items.map(name => `
          <span class="pantry-chip">
            ${escapeHtml(name)}
            ${token ? `<button class="chip-remove" data-cat="${escapeHtml(cat)}" data-name="${escapeHtml(name)}" title="移除">×</button>` : ""}
          </span>`).join("")
      : `<span class="legend">（尚無項目）</span>`;
    const classes = ["pantry-category"];
    if (token) classes.push("selectable");
    if (cat === selectedCategory) classes.push("selected");
    return `<div class="${classes.join(" ")}" data-category="${escapeHtml(cat)}">
      <h3>${escapeHtml(cat)}</h3>
      <div class="pantry-chips">${chips}</div>
    </div>`;
  }).join("");

  const addForm = token
    ? `<div class="pantry-add-form">
        <h3>新增食材${selectedCategory ? `到「${escapeHtml(selectedCategory)}」` : ""}</h3>
        ${!selectedCategory ? `<p class="legend">先點選下方一個食材分類的卡片，再輸入食材名稱。</p>` : ""}
        <div class="token-input-row">
          <input type="text" id="pantry-add-name" placeholder="食材名稱，例如：肉桂" ${selectedCategory ? "" : "disabled"}>
          <button class="btn-primary" id="pantry-add-btn" ${selectedCategory ? "" : "disabled"}>新增</button>
        </div>
      </div>`
    : "";

  el.innerHTML = `
    ${tokenPanel}
    ${addForm}
    <div id="pantry-status"></div>
    <div class="pantry-categories">${categoriesHtml}</div>
  `;

  const statusEl = document.getElementById("pantry-status");
  const showStatus = (msg, isError) => {
    statusEl.innerHTML = `<p class="${isError ? "pantry-error" : "pantry-ok"}">${escapeHtml(msg)}</p>`;
  };
  const setBusy = busy => {
    el.querySelectorAll("button, input, select").forEach(elm => { elm.disabled = busy; });
  };

  if (!token) {
    document.getElementById("gh-token-save").onclick = () => {
      const val = document.getElementById("gh-token-input").value;
      if (!val.trim()) return;
      setGhToken(val);
      renderPantryView();
    };
  } else {
    document.getElementById("gh-token-clear").onclick = () => {
      clearGhToken();
      state.selectedPantryCategory = null;
      renderPantryView();
    };

    el.querySelectorAll(".pantry-category.selectable").forEach(card => {
      card.onclick = () => {
        const cat = card.dataset.category;
        state.selectedPantryCategory = state.selectedPantryCategory === cat ? null : cat;
        renderPantryView();
      };
    });

    el.querySelectorAll(".chip-remove").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation(); // 不要觸發外層卡片的分類選取
        const { cat, name } = btn.dataset;
        setBusy(true);
        showStatus(`移除「${name}」中…`, false);
        try {
          await removePantryItem(cat, name);
          renderPantryView();
        } catch (err) {
          setBusy(false);
          showStatus(err.message, true);
        }
      };
    });

    if (selectedCategory) {
      document.getElementById("pantry-add-btn").onclick = async () => {
        const nameInput = document.getElementById("pantry-add-name");
        const name = nameInput.value;
        if (!name.trim()) return;
        setBusy(true);
        showStatus(`新增「${name}」中…`, false);
        try {
          await addPantryItem(selectedCategory, name);
          renderPantryView();
        } catch (err) {
          setBusy(false);
          showStatus(err.message, true);
        }
      };
    }
  }
}

// ---- 分頁切換 ----
function showRecipesTab() {
  document.getElementById("tab-recipes").classList.add("active");
  document.getElementById("tab-pantry").classList.remove("active");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("pantry-app").classList.add("hidden");
}
function showPantryTab() {
  document.getElementById("tab-pantry").classList.add("active");
  document.getElementById("tab-recipes").classList.remove("active");
  document.getElementById("pantry-app").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
  renderPantryView();
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function init() {
  try {
    await loadData();
    renderFilters();
    renderList();
    document.getElementById("tab-recipes").onclick = showRecipesTab;
    document.getElementById("tab-pantry").onclick = showPantryTab;
  } catch (err) {
    document.getElementById("recipe-list").innerHTML =
      `<div class="empty-state">資料載入失敗：${escapeHtml(err.message)}</div>`;
    console.error(err);
  }
}

init();
```

### ./assets/style.css
```css
:root {
  --bg: #faf7f2;
  --card-bg: #ffffff;
  --border: #e4ddd0;
  --text: #2b2620;
  --muted: #7a7267;
  --accent: #c9622a;
  --pantry-yes: #dcefdc;
  --pantry-yes-text: #2e6b32;
  --pantry-maybe: #fdecc8;
  --pantry-maybe-text: #8a5b13;
  font-family: -apple-system, "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

.site-header {
  padding: 24px 32px 12px;
  border-bottom: 1px solid var(--border);
}
.site-header h1 { margin: 0 0 4px; font-size: 1.6rem; }
.subtitle { margin: 0 0 12px; color: var(--muted); font-size: 0.9rem; }

.tabs { display: flex; gap: 8px; }
.tab-btn {
  background: none; border: 1px solid var(--border); border-radius: 999px;
  padding: 6px 16px; font-size: 0.9rem; cursor: pointer; color: var(--muted);
}
.tab-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

#app, #pantry-app { max-width: 1100px; margin: 0 auto; padding: 24px 32px; }

#list-view { display: flex; gap: 24px; align-items: flex-start; }

.filters {
  width: 220px;
  flex-shrink: 0;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  position: sticky;
  top: 16px;
}
.filter-group { margin-bottom: 16px; }
.filter-group h3 { font-size: 0.85rem; color: var(--muted); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.03em; }
.filter-chip {
  display: inline-block;
  margin: 0 6px 6px 0;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 0.85rem;
  cursor: pointer;
  background: #fff;
  user-select: none;
}
.filter-chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.filter-reset { font-size: 0.8rem; color: var(--accent); cursor: pointer; background: none; border: none; padding: 0; }

.recipe-list { flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }

.recipe-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}
.recipe-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
.recipe-card h3 { margin: 0 0 6px; font-size: 1.05rem; }
.recipe-meta { color: var(--muted); font-size: 0.82rem; margin-bottom: 8px; }
.tag-row { display: flex; flex-wrap: wrap; gap: 4px; }
.tag {
  font-size: 0.72rem;
  background: #f1ece2;
  color: var(--muted);
  padding: 2px 8px;
  border-radius: 999px;
}

.hidden { display: none !important; }

#detail-view { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 24px; }
.detail-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; }
.back-btn {
  background: none; border: 1px solid var(--border); border-radius: 8px;
  padding: 6px 14px; cursor: pointer; font-size: 0.85rem;
}
.delete-recipe-btn {
  background: none; border: 1px solid #c0392b; color: #c0392b; border-radius: 8px;
  padding: 6px 14px; cursor: pointer; font-size: 0.85rem; flex-shrink: 0;
}
.delete-recipe-btn:hover { background: #c0392b; color: #fff; }
.delete-recipe-btn:disabled { opacity: 0.6; cursor: default; }
.detail-title { margin: 0 0 4px; font-size: 1.5rem; }
.detail-meta { color: var(--muted); font-size: 0.9rem; margin-bottom: 20px; }

.section-block {
  margin-bottom: 24px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
}
.section-block h4 { font-size: 1rem; margin: 0 0 10px; border-left: 4px solid var(--accent); padding-left: 8px; }

.ingredients-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}
.ingredients-grid .section-block { margin-bottom: 0; }

ul.ingredient-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
ul.ingredient-list li {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 10px; border: 1px solid #cfc6b8; border-radius: 8px; font-size: 0.9rem;
  background: var(--card-bg);
  box-shadow: 0 1px 2px rgba(43, 38, 32, 0.07);
}
.ing-main { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
ul.ingredient-list li.have { background: var(--pantry-yes); border-color: var(--pantry-yes-text); }
ul.ingredient-list li.have .ing-name { color: var(--pantry-yes-text); font-weight: 600; }
ul.ingredient-list li.maybe { background: var(--pantry-maybe); border-color: var(--pantry-maybe-text); }
ul.ingredient-list li.maybe .ing-name { color: var(--pantry-maybe-text); font-weight: 600; }
.ing-amount { color: var(--muted); flex-shrink: 0; }
.ing-note { font-size: 0.75rem; color: var(--muted); }
.ing-note-optional { color: var(--accent); font-weight: 600; }
.ing-hint {
  display: inline-flex; align-items: center; justify-content: center;
  width: 15px; height: 15px; border-radius: 50%; margin-left: 4px;
  background: var(--pantry-maybe-text); color: #fff; font-size: 0.7rem; font-weight: 700;
  cursor: help; vertical-align: middle;
}

ol.steps { padding-left: 20px; margin: 0; }
ol.steps li { margin-bottom: 8px; }

.legend { font-size: 0.8rem; color: var(--muted); margin-top: 4px; }
.legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--pantry-yes-text); margin-right: 4px; }

.site-footer { text-align: center; color: var(--muted); font-size: 0.8rem; padding: 24px; }

.empty-state { color: var(--muted); padding: 40px; text-align: center; }

/* ---- 購物清單 ---- */
.shopping-list {
  background: #fff8ec; border: 1px solid #f0dfb8; border-radius: 8px;
  padding: 12px 16px; margin-bottom: 16px;
}
.shopping-list h4 { margin: 0 0 8px; font-size: 0.95rem; }
.shopping-list h4 + h4 { margin-top: 12px; }
.tag.missing { background: #f9e2d0; color: #a1481a; }
.tag.maybe { background: var(--pantry-maybe); color: var(--pantry-maybe-text); }

/* ---- 食材庫 ---- */
.token-panel {
  background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px;
  padding: 16px; margin-bottom: 20px; font-size: 0.9rem;
}
.pantry-token-controls { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.token-steps { margin: 8px 0; padding-left: 20px; }
.token-steps li { margin-bottom: 4px; }
.token-input-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.token-input-row input[type="password"],
.token-input-row input[type="text"] {
  flex: 1; min-width: 180px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.9rem;
}
.token-input-row select {
  padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.9rem;
}
.btn-primary, .btn-secondary {
  padding: 8px 16px; border-radius: 6px; font-size: 0.9rem; cursor: pointer; border: 1px solid var(--accent);
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-secondary { background: none; color: var(--accent); }

#pantry-status { min-height: 1.2em; margin-bottom: 8px; }
.pantry-ok { color: var(--pantry-yes-text); font-size: 0.85rem; }
.pantry-error { color: #a1481a; font-size: 0.85rem; }

.pantry-categories {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;
  margin-bottom: 24px;
}
.pantry-category {
  background: var(--card-bg); border: 2px solid var(--border); border-radius: 10px; padding: 16px;
  transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}
.pantry-category.selectable { cursor: pointer; }
.pantry-category.selectable:hover { border-color: var(--accent); }
.pantry-category.selected {
  border-color: var(--accent);
  box-shadow: 0 6px 16px rgba(201, 98, 42, 0.25);
  transform: translateY(-3px);
}
.pantry-category h3 { margin: 0 0 10px; font-size: 0.95rem; border-left: 4px solid var(--accent); padding-left: 8px; }
.pantry-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pantry-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--pantry-yes); color: var(--pantry-yes-text);
  padding: 4px 4px 4px 10px; border-radius: 999px; font-size: 0.85rem;
}
.chip-remove {
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%;
  background: rgba(0, 0, 0, 0.12); color: var(--pantry-yes-text);
  border: none; cursor: pointer; font-size: 0.85rem; line-height: 1;
  transition: background 0.15s ease, color 0.15s ease;
}
.chip-remove:hover, .chip-remove:focus-visible {
  background: #c0392b; color: #fff;
}

.pantry-add-form {
  background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 16px;
  margin-bottom: 20px;
}
.pantry-add-form h3 { margin: 0 0 8px; font-size: 0.95rem; }

@media (max-width: 720px) {
  #list-view { flex-direction: column; }
  .filters { width: 100%; position: static; }
}
```

### ./data/ingredient_families.json
```json
{
  "花椒": ["紅花椒", "青花椒粉"],
  "白胡椒": ["白胡椒粒", "白胡椒粉"],
  "黑胡椒": ["黑胡椒粉"]
}
```

### ./data/pantry.json
```json
{
  "香料": [
    "孜然",
    "丁香",
    "綠荳蔻",
    "乾辣椒",
    "紅花椒",
    "白胡椒粒"
  ],
  "香草": [
    "義大利綜合香料",
    "羅勒",
    "巴西里",
    "蒔蘿",
    "迷迭香",
    "九層塔"
  ],
  "調味粉": [
    "咖哩粉",
    "五香粉",
    "白胡椒粉",
    "黑胡椒粉"
  ],
  "調味料": [
    "醬油",
    "香油",
    "白醋",
    "烏醋",
    "味醂",
    "巴薩米克醋",
    "米酒",
    "清酒",
    "魚露",
    "鹽巴",
    "白糖",
    "醬油膏"
  ],
  "醬": [
    "番茄醬",
    "芥末籽醬",
    "黃芥末醬",
    "美乃滋",
    "豆瓣醬",
    "五味醬"
  ],
  "辛香蔬菜": [
    "薑",
    "蒜頭",
    "洋蔥",
    "蔥",
    "辣椒"
  ],
  "起司": [
    "帕瑪森",
    "切達",
    "Brie"
  ],
  "罐頭/醃漬": [
    "酸豆",
    "醃漬綠橄欖",
    "墨西哥綠辣椒",
    "鯷魚",
    "鱈魚肝"
  ],
  "主食": [
    "米",
    "義大利麵"
  ],
  "生鮮食材": [
    "蝦仁",
    "牛排"
  ]
}
```

### ./data/recipes/braised-pork-belly-taiwanese.json
```json
{
  "id": "braised-pork-belly-taiwanese",
  "title": "家常滷肉",
  "source": "",
  "ingredients": [
    { "name": "五花肉", "amount": "1", "unit": "斤", "category": "生鮮食材" },
    { "name": "鳥蛋", "category": "生鮮食材" },
    { "name": "海帶", "amount": "3", "unit": "條", "category": "生鮮食材" },
    { "name": "油豆腐", "amount": "2", "unit": "塊", "category": "生鮮食材" },
    { "name": "麵輪", "amount": "少許", "category": "生鮮食材" },
    { "name": "豆干", "amount": "3", "unit": "塊", "category": "生鮮食材" },
    { "name": "乾香菇", "amount": "3", "unit": "朵", "category": "生鮮食材" },
    { "name": "白蘿蔔", "category": "生鮮食材" },
    { "name": "蔥（切段）", "amount": "2", "unit": "根", "category": "辛香蔬菜" },
    { "name": "薑片", "amount": "6", "unit": "片", "category": "辛香蔬菜" },
    { "name": "蒜頭（拍扁）", "amount": "6", "unit": "顆", "category": "辛香蔬菜" },
    { "name": "辣椒", "amount": "1", "unit": "根", "category": "辛香蔬菜" },
    { "name": "滷包", "amount": "1", "unit": "包", "category": "香料" },
    { "name": "砂糖（可用冰糖5顆替代）", "amount": "2", "unit": "大匙", "category": "調味料" },
    { "name": "蠔油", "amount": "1", "unit": "大匙", "category": "調味料" },
    { "name": "醬油", "amount": "200", "unit": "ml", "category": "調味料" },
    { "name": "醬油膏（可選，有的話加分）", "amount": "2", "unit": "大匙", "category": "調味料" },
    { "name": "米酒", "amount": "100", "unit": "ml", "category": "調味料" },
    { "name": "白胡椒粉", "amount": "少許", "category": "調味粉" },
    { "name": "五香粉", "amount": "少許", "category": "調味粉" }
  ],
  "steps": [
    { "order": 1, "text": "五花肉切塊，水沖洗過、吸乾（走活水）。" },
    { "order": 2, "text": "五花肉小火乾煎至出油。" },
    { "order": 3, "text": "蔥、薑、蒜放入炒香（不用炒太久）。" },
    { "order": 4, "text": "加一些醬油、砂糖、米酒炒到變金黃色。" },
    { "order": 5, "text": "將炒好的肉放入鍋中，加水蓋過肉。" },
    { "order": 6, "text": "加入全部的料頭 & 調味料。" },
    { "order": 7, "text": "小火燉約20-30分鐘，取出滷包。" },
    { "order": 8, "text": "小火再燉30分鐘，起鍋前煮沸一下。" }
  ],
  "cuisine": "中式",
  "cooking_methods": ["炒", "滷"],
  "main_ingredient_types": ["肉類", "蛋豆製品", "蔬食"],
  "course": "主菜",
  "spice_level": "不辣",
  "created_at": "2026-07-31",
  "raw_input": "家常滷肉\t\n五花肉1斤\t五花肉切塊水沖洗過吸乾 (走活水)\n鳥蛋\t五花肉小火乾煎至出油\n海帶3條\t蔥、薑、蒜放入炒香 (不用炒太久)\n油豆腐兩塊\t加一些醬油、砂糖、米酒炒到變金黃色\n麵輪少許\t將炒好的肉放入鍋中，加水蓋過肉\n豆干3塊\t加入全部的料頭 & 調味料\n乾香菇3朵\t小火燉約20-30分鐘，取出滷包\n白蘿蔔\t小火再燉30分鐘，起鍋前煮沸一下\n\t\n蔥2根 (切段)\t砂糖2大匙 (or冰糖5顆)\n薑片6片\t蠔油1大匙\n蒜頭6顆 (拍扁)\t醬油200ml\n辣椒1根\t醬油膏兩大匙 (有的話加分)\n滷包1包\t米酒100ml\n白胡椒少許\n五香粉少許"
}
```

### ./data/recipes/index.json
```json
[
  "shrimp-stirfry-scallion",
  "lobster-bisque-shrimp-pasta",
  "mala-celery-minced-pork",
  "pan-seared-steak-garlic-butter",
  "braised-pork-belly-taiwanese"
]
```

### ./data/recipes/lobster-bisque-shrimp-pasta.json
```json
{
  "id": "lobster-bisque-shrimp-pasta",
  "title": "龍蝦濃湯蝦仁蘑菇奶油義大利麵",
  "source": "",
  "ingredients": [
    { "name": "義大利麵", "amount": "180～200", "unit": "g", "category": "主食" },
    { "name": "好市多龍蝦濃湯", "amount": "250～300", "unit": "ml", "category": "生鮮食材" },
    { "name": "蝦仁", "amount": "200", "unit": "g", "category": "生鮮食材" },
    { "name": "洋蔥（切絲）", "amount": "半", "unit": "顆", "category": "辛香蔬菜" },
    { "name": "蘑菇（切片）", "amount": "150", "unit": "g", "category": "生鮮食材" },
    { "name": "蒜頭（切末）", "amount": "2～3", "unit": "瓣", "category": "辛香蔬菜" },
    { "name": "小番茄（切半，可選）", "amount": "6～8", "unit": "顆", "category": "生鮮食材" },
    { "name": "菠菜（可選，與蘆筍擇一）", "amount": "約50（1小把）", "unit": "g", "category": "生鮮食材" },
    { "name": "蘆筍（可選，與菠菜擇一）", "amount": "5～6", "unit": "根", "category": "生鮮食材" },
    { "name": "奶油", "amount": "15", "unit": "g", "category": "調味料" },
    { "name": "橄欖油", "amount": "1", "unit": "大匙", "category": "調味料" },
    { "name": "鮮奶油（推薦加入，可讓醬汁更滑順）", "amount": "50", "unit": "ml", "category": "調味料" },
    { "name": "帕瑪森起司", "amount": "適量", "category": "起司" },
    { "name": "麵水（煮麵時保留）", "amount": "約200", "unit": "ml", "category": "調味料" },
    { "name": "乾白酒（如 Sauvignon Blanc、Pinot Grigio、Chardonnay 等不甜白酒，推薦加入）", "amount": "50", "unit": "ml", "category": "調味料" },
    { "name": "檸檬汁（起鍋前加入，可提鮮）", "amount": "1", "unit": "茶匙", "category": "調味料" },
    { "name": "黑胡椒粉", "amount": "適量", "category": "調味粉" },
    { "name": "巴西里（乾燥或新鮮）", "amount": "適量", "category": "香草" },
    { "name": "辣椒碎（可選）", "amount": "1/4～1/2茶匙", "category": "香料" }
  ],
  "steps": [
    { "order": 1, "text": "義大利麵下鍋煮至九分熟，撈起前保留約200ml麵水備用。" },
    { "order": 2, "text": "另起鍋，橄欖油熱鍋，將蝦仁煎至兩面上色後取出備用。" },
    { "order": 3, "text": "鍋中加入奶油，放入洋蔥絲、蒜末、蘑菇片拌炒至軟化上色。" },
    { "order": 4, "text": "倒入白酒，煮至收乾約1分鐘。" },
    { "order": 5, "text": "加入小番茄，續炒約1分鐘。" },
    { "order": 6, "text": "倒入龍蝦濃湯與鮮奶油，煮滾後轉小火。" },
    { "order": 7, "text": "視醬汁濃稠度，慢慢加入保留的麵水調整稠度。" },
    { "order": 8, "text": "放入煮好的義大利麵，與醬汁拌炒均勻。" },
    { "order": 9, "text": "若使用菠菜，起鍋前30秒加入拌炒；若使用蘆筍，先汆燙後與麵一起拌入。" },
    { "order": 10, "text": "蝦仁回鍋，續煮約30秒。" },
    { "order": 11, "text": "起鍋前拌入帕瑪森起司、黑胡椒，辣椒碎可依喜好加入。" },
    { "order": 12, "text": "熄火後加入檸檬汁拌勻提鮮。" },
    { "order": 13, "text": "盛盤後撒上巴西里即可。" }
  ],
  "cuisine": "西式",
  "cooking_methods": ["炒", "燙/汆燙"],
  "main_ingredient_types": ["海鮮", "澱粉/主食", "蔬食"],
  "course": "主菜",
  "spice_level": "不辣",
  "created_at": "2026-07-31",
  "raw_input": "龍蝦濃湯蝦仁蘑菇奶油義大利麵（2 人份）\n主食\n義大利麵 180～200 g\n海鮮\n好市多龍蝦濃湯 250～300 ml\n蝦仁 200 g\n蔬菜\n洋蔥 半顆（切絲）\n蘑菇 150 g（切片）\n蒜頭 2～3瓣（切末）\n小番茄 6～8顆（切半，可選）\n菠菜 1小把（約50 g，可選）\n或蘆筍 5～6根（可選，與菠菜擇一即可）\n醬汁\n奶油 15 g\n橄欖油 1大匙\n鮮奶油 50 ml（推薦加入，可讓醬汁更滑順）\n帕瑪森起司（Parmesan）適量\n麵水 約200 ml（煮麵時保留）\n調味\n黑胡椒 適量\n巴西里（乾燥或新鮮）適量\n辣椒碎（可選，約1/4～1/2茶匙）\n檸檬汁 1茶匙（起鍋前加入，可提鮮）\n提升香氣（推薦）\n乾白酒 50 ml（如 Sauvignon Blanc、Pinot Grigio、Chardonnay 等不甜的白酒皆可）\n食材使用時機\n食材\t何時加入\n橄欖油\t一開始煎蝦\n奶油\t炒洋蔥、蘑菇時加入\n洋蔥、蒜末、蘑菇\t蝦盛起後開始炒\n白酒\t蘑菇炒至上色後加入，收乾約1分鐘\n小番茄\t白酒收乾後一起炒約1分鐘\n龍蝦濃湯\t接著倒入鍋中\n鮮奶油\t與龍蝦濃湯一起加入\n麵水\t視醬汁濃度慢慢加入\n義大利麵\t醬汁完成後放入拌炒\n菠菜\t起鍋前30秒加入即可\n蘆筍\t先汆燙，再與麵一起拌入\n蝦仁\t最後30秒回鍋\nParmesan\t起鍋前拌入少量\n黑胡椒\t起鍋前\n辣椒碎\t起鍋前或炒洋蔥時加入皆可\n檸檬汁\t熄火後最後加入\n巴西里\t擺盤後撒上"
}
```

### ./data/recipes/mala-celery-minced-pork.json
```json
{
  "id": "mala-celery-minced-pork",
  "title": "椒麻芹菜肉末",
  "source": "",
  "ingredients": [
    { "name": "絞肉", "category": "生鮮食材" },
    { "name": "芹菜（切丁）", "category": "生鮮食材" },
    { "name": "米酒", "amount": "2", "unit": "大匙", "category": "調味料" },
    { "name": "郫縣豆瓣醬", "amount": "1", "unit": "小匙", "category": "醬" },
    { "name": "醬油", "amount": "2", "unit": "大匙", "category": "調味料" },
    { "name": "糖", "amount": "適量", "category": "調味料" },
    { "name": "乾辣椒", "amount": "少許", "category": "香料" },
    { "name": "青花椒", "amount": "1/2", "unit": "小匙", "category": "香料" },
    { "name": "新鮮辣椒（切末）", "amount": "少許", "category": "辛香蔬菜" },
    { "name": "蒜頭（切末）", "amount": "2~3", "unit": "瓣", "category": "辛香蔬菜" },
    { "name": "薑（切末）", "amount": "1", "unit": "小匙", "category": "辛香蔬菜" }
  ],
  "steps": [
    { "order": 1, "text": "下油開中火，下花椒和乾辣椒炒出香氣。" },
    { "order": 2, "text": "測試油中有無麻香味，關火取出花椒。" },
    { "order": 3, "text": "絞肉下鍋，炒至快熟時加米酒去腥。" },
    { "order": 4, "text": "加入蒜末、薑末和辣椒末炒香。" },
    { "order": 5, "text": "加入豆瓣醬炒出紅油。" },
    { "order": 6, "text": "加入芹菜。" },
    { "order": 7, "text": "加入醬油＆糖。" }
  ],
  "cuisine": "中式",
  "cooking_methods": ["炒"],
  "main_ingredient_types": ["肉類", "蔬食"],
  "course": "主菜",
  "spice_level": "中辣",
  "created_at": "2026-07-31",
  "raw_input": "椒麻芹菜肉末\t\t\n調料\t\t作法\n米酒\t2大匙\t下油開中火，下花椒和乾辣椒炒出香氣\n郫縣豆瓣醬\t1小匙\t測試油中有無麻香味，關火取出花椒\n醬油\t2大匙\t絞肉下鍋，炒至快熟時加米酒去腥\n糖 \t適量\t加入蒜末、薑末和辣椒末炒香\n料頭\t\t加入豆瓣醬炒出紅油\n芹菜(切丁)\t\t加入芹菜\n乾辣椒\t少許\t加入醬油＆糖\n青花椒\t 1/2小匙\t\n新鮮辣椒(切末) \t少許\t\n蒜頭(切末) \t2~3瓣\t\n薑(切末) \t1小匙"
}
```

### ./data/recipes/pan-seared-steak-garlic-butter.json
```json
{
  "id": "pan-seared-steak-garlic-butter",
  "title": "煎牛排",
  "source": "",
  "ingredients": [
    { "name": "牛排", "category": "生鮮食材" },
    { "name": "大蒜（切片）", "amount": "6~8", "unit": "瓣", "category": "辛香蔬菜" },
    { "name": "鹽巴", "amount": "少許", "category": "調味料" },
    { "name": "奶油", "amount": "20", "unit": "g", "category": "調味料" },
    { "name": "迷迭香", "amount": "4", "unit": "支", "category": "香草" }
  ],
  "steps": [
    { "order": 1, "text": "牛排退冰至室溫，用紙巾擦乾表面水分。" },
    { "order": 2, "text": "大蒜切片，洗掉黏液。" },
    { "order": 3, "text": "小火加油，放入蒜片炸香。" },
    { "order": 4, "text": "蒜片一轉金黃色就取出，油留著。" },
    { "order": 5, "text": "牛排下鍋前撒上鹽巴，按摩均勻。" },
    { "order": 6, "text": "開大火熱鍋，熱到冒煙。" },
    { "order": 7, "text": "轉中火，一面煎1.5分鐘。" },
    { "order": 8, "text": "各面煎完後，下奶油、迷迭香。" },
    { "order": 9, "text": "傾斜鍋面，用湯匙撈奶油淋在牛排上。" },
    { "order": 10, "text": "起鍋後靜置5分鐘，再回去加熱1分鐘。" }
  ],
  "cuisine": "西式",
  "cooking_methods": ["煎"],
  "main_ingredient_types": ["肉類"],
  "course": "主菜",
  "created_at": "2026-07-31",
  "raw_input": "煎牛排\t\n材料\t作法\n牛排\t牛排退冰退到室溫　用紙巾擦乾\n大蒜6-8瓣\t蒜片黏液洗乾淨\n鹽巴少許\t小火加油炸蒜片\n奶油20g\t蒜片一轉金黃色就取出，油留著\n迷迭香4支\t牛排下鍋前撒上鹽巴後按摩\n\t開大火熱鍋熱到冒煙\n\t轉中火一面煎1.5分鐘\n\t各面煎完後，下奶油、迷迭香\n\t傾斜鍋面用湯匙撈奶油淋在牛排上\n\t起鍋後靜置5分鐘，再回去加熱1分鐘"
}
```

### ./data/recipes/shrimp-stirfry-scallion.json
```json
{
  "id": "shrimp-stirfry-scallion",
  "title": "蔥爆蝦仁",
  "source": "範例資料，示範用",
  "ingredients": [
    { "name": "蝦仁", "amount": "300", "unit": "g", "category": "生鮮食材" },
    { "name": "青蔥", "amount": "3", "unit": "根", "category": "辛香蔬菜" },
    { "name": "醬油", "amount": "1", "unit": "大匙", "category": "調味料" },
    { "name": "米酒", "amount": "1", "unit": "大匙", "category": "調味料" },
    { "name": "白胡椒粉", "amount": "適量", "category": "調味粉" }
  ],
  "steps": [
    { "order": 1, "text": "蝦仁洗淨去腸泥，用廚房紙巾拍乾。" },
    { "order": 2, "text": "蔥切段，蔥白與蔥綠分開。" },
    { "order": 3, "text": "熱鍋下油，先煸香蔥白，再放入蝦仁快炒至變色。" },
    { "order": 4, "text": "嗆入米酒，加醬油、白胡椒粉拌炒均勻。" },
    { "order": 5, "text": "起鍋前放入蔥綠拌炒幾下即可。" }
  ],
  "cuisine": "中式",
  "cooking_methods": ["炒"],
  "main_ingredient_types": ["海鮮"],
  "course": "主菜",
  "spice_level": "不辣",
  "created_at": "2026-07-30",
  "raw_input": "（範例資料）蔥爆蝦仁：蝦仁300g、蔥3根、醬油1大匙、米酒1大匙、白胡椒粉適量。蝦仁去腸泥拍乾，蔥切段蔥白蔥綠分開，熱鍋煸香蔥白，下蝦仁炒至變色，嗆酒下醬油白胡椒粉拌炒，起鍋前下蔥綠。"
}
```

### ./data/synonyms.json
```json
{
  "蝦仁": ["蝦仁"],
  "蔥": ["蔥", "青蔥", "珠蔥", "大蔥"],
  "蒜頭": ["蒜頭", "蒜仁", "蒜末", "蒜"],
  "醬油": ["醬油"],
  "醬油膏": ["醬油膏"],
  "孜然": ["孜然", "孜然粉"],
  "丁香": ["丁香"],
  "綠荳蔻": ["綠荳蔻", "小豆蔻"],
  "紅花椒": ["紅花椒", "紅花椒粒"],
  "青花椒粉": ["青花椒粉", "青花椒粉末"],
  "豆瓣醬": ["豆瓣醬", "郫縣豆瓣醬", "辣豆瓣醬"],
  "乾辣椒": ["乾辣椒", "辣椒乾", "乾辣椒段"],
  "義大利綜合香料": ["義大利綜合香料", "義式香料"],
  "羅勒": ["羅勒", "甜羅勒"],
  "巴西里": ["巴西里", "洋香菜"],
  "蒔蘿": ["蒔蘿", "dill"],
  "迷迭香": ["迷迭香", "rosemary"],
  "九層塔": ["九層塔", "塔羅勒"],
  "咖哩粉": ["咖哩粉", "咖哩"],
  "辣椒粉": ["辣椒粉"],
  "五香粉": ["五香粉"],
  "白胡椒粉": ["白胡椒粉"],
  "白胡椒粒": ["白胡椒粒"],
  "黑胡椒粉": ["黑胡椒粉"],
  "香油": ["香油"],
  "白醋": ["白醋"],
  "烏醋": ["烏醋", "黑醋"],
  "味醂": ["味醂", "米霖"],
  "巴薩米克醋": ["巴薩米克醋", "balsamic", "義大利黑醋"],
  "米酒": ["米酒", "料理米酒"],
  "米": ["米", "白米"],
  "鹽巴": ["鹽巴", "鹽"],
  "白糖": ["白糖", "砂糖", "細砂糖"],
  "清酒": ["清酒", "日本酒", "sake"],
  "魚露": ["魚露", "fish sauce"],
  "五味醬": ["五味醬"],
  "番茄醬": ["番茄醬", "蕃茄醬"],
  "芥末籽醬": ["芥末籽醬", "顆粒芥末醬"],
  "黃芥末醬": ["黃芥末醬", "黃芥末", "美式芥末醬"],
  "美乃滋": ["美乃滋", "美奶滋", "mayo"],
  "薑": ["薑", "生薑", "老薑", "嫩薑"],
  "洋蔥": ["洋蔥"],
  "辣椒": ["辣椒", "紅辣椒", "青辣椒", "小辣椒"],
  "帕瑪森": ["帕瑪森", "帕瑪森起司", "Parmesan"],
  "切達": ["切達", "切達起司", "cheddar"],
  "Brie": ["Brie", "brie", "布里起司"],
  "酸豆": ["酸豆", "續隨子", "capers"],
  "醃漬綠橄欖": ["醃漬綠橄欖", "綠橄欖"],
  "墨西哥綠辣椒": ["墨西哥綠辣椒", "墨西哥辣椒", "jalapeño", "jalapeno"],
  "鯷魚": ["鯷魚", "鯷魚罐頭", "anchovy"],
  "鱈魚肝": ["鱈魚肝", "鱈魚肝罐頭"]
}
```

### ./data/taxonomy.json
```json
{
  "cuisine": ["中式", "西式", "其他"],
  "cooking_methods": ["炒", "煎", "滷", "蒸", "烤", "炸", "燙/汆燙", "涼拌", "燉", "湯", "生食"],
  "main_ingredient_types": ["肉類", "海鮮", "蛋豆製品", "蔬食", "澱粉/主食", "加工品"],
  "course": ["主菜", "配菜", "湯品", "甜點", "醬料/沾醬", "早餐"],
  "spice_level": ["不辣", "微辣", "中辣", "大辣"],
  "pantry_categories": ["香料", "香草", "調味粉", "調味料", "醬", "辛香蔬菜", "起司", "罐頭/醃漬", "主食", "生鮮食材"]
}
```

### ./index.html
```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>食譜筆記本</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
  <header class="site-header">
    <h1>食譜筆記本</h1>
    <p class="subtitle">統一格式整理的個人食譜資料庫</p>
    <nav class="tabs">
      <button class="tab-btn active" id="tab-recipes" type="button">食譜</button>
      <button class="tab-btn" id="tab-pantry" type="button">食材庫</button>
    </nav>
  </header>

  <main id="app">
    <div id="list-view">
      <aside class="filters" id="filters"></aside>
      <section class="recipe-list" id="recipe-list"></section>
    </div>
    <div id="detail-view" class="hidden"></div>
  </main>

  <main id="pantry-app" class="hidden">
    <div id="pantry-view"></div>
  </main>

  <footer class="site-footer">
    <p>資料以人工整理維護，僅供個人參考。</p>
  </footer>

  <script src="assets/app.js"></script>
</body>
</html>
```
