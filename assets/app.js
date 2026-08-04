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
  currentDetailId: null,
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
//      括號本身就是明確的分界，不管較短字串是不是單一漢字（例如「鹽（醃肉用）」延伸自
//      「鹽」）都不會跟「字黏在一起變成不同食材」搞混，所以這個情況不受長度門檻限制。
//   2. 較短字串出現在結尾，前面是「熟/冷凍/有機/去皮/帶皮」這類不影響食材本身的敘述性前綴。
//      這個情況沒有括號這種明確分界，所以還是要滿足長度門檻，避免單一漢字字根誤判。
// 其餘一律視為不同食材，不可放心比對，避免「醬油膏」被誤判成「醬油」已有。
// 「新鮮／乾燥／生」刻意不放進這份清單——這三個詞剛好就是本專案「主食/乾貨」跟「生鮮食材」
// 分類的判斷軸線本身，對薑、蒜這類食材是安全的（新鮮/乾燥只是狀態，買的是同一樣東西），
// 但對香菇、蝦米這類食材，新鮮/乾燥根本是不同的商品，曾經導致「生香菇」被誤判成跟
// 乾香菇已有（見 CLAUDE.md 食材別名章節第四個真實案例）。這種食材依賴的安全比對，
// 一律用明確的同義詞別名處理（例如「辣椒」群組直接列「新鮮辣椒」），不要靠這份前綴清單。
const SAFE_DESCRIPTIVE_PREFIXES = ["熟", "冷凍", "有機", "去皮", "帶皮"];
function safeExtension(longer, shorter) {
  if (longer === shorter) return true;
  // 情況 1：括號備註，有明確分界，不受長度門檻限制
  if (longer.startsWith(shorter)) {
    const afterPrefix = longer.slice(shorter.length);
    if (afterPrefix.startsWith("（") || afterPrefix.startsWith("(")) return true;
  }
  // 情況 2：敘述性前綴 + 食材本名，沒有分界符號，單一漢字太容易跟其他複合詞混淆
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
// 回傳這個食材在 pantry.json 裡實際比對到的分類＋正式名稱（不是食譜自己寫的名稱／category）。
// 例如食譜寫「大蒜（切末）」，pantry.json 裡實際存的是「蒜頭」——「已有」狀態要提供移除按鈕時，
// 需要這組精準的分類＋名稱才能呼叫 removePantryItem，不能直接沿用食譜的 item.category/item.name。
// isInPantry 沿用同一套邏輯，只是只回傳布林值。
function findPantryMatch(ingredientName) {
  const name = ingredientName.trim();
  const ambiguous = relatesToFamily(name);
  let matchedGroup = false;
  for (const [canonical, aliases] of Object.entries(state.synonyms)) {
    const hit = aliases.some(alias => {
      if (alias === name) return true;
      if (safeExtension(name, alias)) return true; // 食譜寫得比同義詞更具體（安全的前綴/備註延伸）
      if (safeExtension(alias, name)) return !ambiguous; // 食譜寫得比同義詞更籠統，同樣要走安全延伸檢查，不能只看長度
      return false;
    });
    if (hit) {
      matchedGroup = true;
      if (state.pantryFlat.includes(canonical)) {
        const category = Object.keys(state.pantry).find(cat => (state.pantry[cat] || []).includes(canonical));
        if (category) return { category, name: canonical };
      }
    }
  }
  if (matchedGroup) return null; // 同義詞群組存在，但素材庫沒有該項目
  if (ambiguous) return null; // 跟家族有關的籠統詞交給 familyStatus 處理，這裡不用寬鬆比對誤判成已有
  // 回退：沒有對應同義詞群組時，直接對素材庫做安全延伸比對
  for (const [category, items] of Object.entries(state.pantry)) {
    const hitName = (items || []).find(p => safeExtension(name, p));
    if (hitName) return { category, name: hitName };
  }
  return null;
}

function isInPantry(ingredientName) {
  return !!findPantryMatch(ingredientName);
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
    // always_available（例如「水」）不算食材庫比對的對象，跳過 pantryStatus，
    // 不套用 have/missing/maybe 顏色、也不顯示「+ 加入」按鈕。
    const status = item.always_available ? null : pantryStatus(item.name);
    const hint = status === "maybe" ? `<span class="ing-hint" title="家族相近，品種或形態可能不同，請自行確認">？</span>` : "";
    const { base, note } = splitIngredientNote(item.name);
    const isOptionalNote = /可選|推薦/.test(note);
    const noteHtml = note
      ? `<div class="ing-note${isOptionalNote ? " ing-note-optional" : ""}">${escapeHtml(note)}</div>`
      : "";
    // have 的項目改顯示「移除」（用光了可以直接從這裡取消庫存標記）；always_available 的項目
    // 不需要追蹤，兩種按鈕都不顯示；其餘（missing/maybe）顯示「加入」。
    let addBtnHtml = "";
    if (status === "have") {
      const match = findPantryMatch(item.name);
      if (match) {
        addBtnHtml = `<button class="ing-remove-btn" type="button" data-category="${escapeHtml(match.category)}" data-name="${escapeHtml(match.name)}" title="從食材庫移除（用完了）">− 移除</button>`;
      }
    } else if (status) {
      addBtnHtml = `<button class="ing-add-btn" type="button" data-category="${escapeHtml(item.category || "")}" data-name="${escapeHtml(base)}">+ 加入</button>`;
    }
    return `<li class="${status || ""}">
      <div class="ing-main">
        <span class="ing-name">${escapeHtml(base)}${hint}</span>
        <div class="ing-right">
          <span class="ing-amount">${escapeHtml([item.amount, item.unit].filter(Boolean).join(" "))}</span>
          ${addBtnHtml}
        </div>
      </div>
      ${noteHtml}
    </li>`;
  }).join("")}</ul>`;
}

// 食材區塊預設依 taxonomy.pantry_categories 的順序分組顯示，該食譜沒用到的分類不顯示
// （跟食材庫分頁會列出全部 9 類含空分類不同，這裡只顯示食譜實際用到的分類）。
// 如果食譜的食材有填 component（多組件食譜自訂的組件分組，跟 category 是兩件事），
// 改成依 component 第一次出現的順序分組，不再疊加 category 二次分組。
function renderIngredientsByCategory(recipe) {
  const items = recipe.ingredients || [];
  const hasComponent = items.some(i => i.component);

  if (hasComponent) {
    const componentOrder = [...new Set(items.map(i => i.component || ""))];
    const blocks = componentOrder.map(comp => `<div class="section-block">
      <h4>${escapeHtml(comp || "其他")}</h4>
      ${renderIngredientList(items.filter(i => (i.component || "") === comp))}
    </div>`);
    return `<div class="ingredients-grid">${blocks.join("")}</div>`;
  }

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
  // always_available（例如「水」）根本不是採購行為的對象，不列入購物清單任何分類。
  const items = (recipe.ingredients || []).filter(item => !item.always_available);
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

// 做法區塊預設是單一攤平的 <ol>。如果食譜的步驟有填 stage（多階段食譜自訂的階段名稱，
// 例如「熬湯頭」「雞湯配料前處理」），改成依 stage 第一次出現的順序分組，各自渲染成
// 一個帶標題的區塊、步驟各自從 1 開始編號；stage_note（例如「與熬湯頭同時進行」）
// 有填的話用小字附加在標題旁邊。
// 每個 <li> 用 data-stage + data-order 標記這個步驟在 JSON 裡的正確位置（不是用文字內容比對，
// 避免文字重複的步驟被編輯功能改錯行）。編輯圖示只在有設定 GitHub token 時顯示。
function renderStepLi(s) {
  const canEdit = !!getGhToken();
  return `<li data-stage="${escapeHtml(s.stage || "")}" data-order="${s.order}">
    <div class="step-row">
      <span class="step-text">${escapeHtml(s.text)}</span>
      ${canEdit ? `<button class="edit-icon-btn step-edit-btn" type="button" title="編輯這個步驟">✏️</button>` : ""}
    </div>
  </li>`;
}

function renderSteps(recipe) {
  const steps = recipe.steps || [];
  const hasStage = steps.some(s => s.stage);

  if (!hasStage) {
    const sorted = steps.slice().sort((a, b) => a.order - b.order);
    return `<div class="section-block">
      <h4>做法</h4>
      <ol class="steps">
        ${sorted.map(renderStepLi).join("")}
      </ol>
    </div>`;
  }

  const stageOrder = [...new Set(steps.map(s => s.stage || ""))];
  return stageOrder.map(stage => {
    const stageSteps = steps.filter(s => (s.stage || "") === stage).slice().sort((a, b) => a.order - b.order);
    const note = stageSteps.map(s => s.stage_note).find(Boolean) || "";
    return `<div class="section-block">
      <h4>${escapeHtml(stage || "做法")}${note ? ` <span class="stage-note">${escapeHtml(note)}</span>` : ""}</h4>
      <ol class="steps">
        ${stageSteps.map(renderStepLi).join("")}
      </ol>
    </div>`;
  }).join("");
}

// 相關連結（reference_url）：教學影片或原始食譜網頁連結皆可，兩種用途共用同一欄位、
// 不依網址判斷內容種類，統一同一種顯示方式。
function renderReferenceLink(recipe) {
  const canEdit = !!getGhToken();
  const url = recipe.reference_url || "";
  const content = url
    ? `<a class="reference-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">🔗 相關連結</a>`
    : `<span class="legend">尚未新增相關連結</span>`;
  return `<div class="section-block reference-link-row" id="reference-link-row">
    <div class="reference-link-content" id="reference-link-content">${content}</div>
    ${canEdit ? `<button class="edit-icon-btn" id="edit-reference-btn" type="button" title="編輯相關連結">✏️</button>` : ""}
  </div>`;
}

// 標題／步驟文字的直接編輯（見 CLAUDE.md「網站直接寫入 GitHub」一節）：只有純文字內容，
// 不包含新增/刪除/搬動步驟，也不包含食材、分類、菜系這類需要判斷的欄位。
function wireTitleEdit(recipe) {
  const btn = document.getElementById("edit-title-btn");
  if (!btn) return;
  btn.onclick = () => {
    const row = btn.closest(".detail-title-row");
    const oldTitle = recipe.title;
    row.innerHTML = `
      <input type="text" class="title-edit-input" id="title-edit-input" value="${escapeHtml(oldTitle)}">
      <button class="btn-primary" id="title-save-btn" type="button">儲存</button>
      <button class="btn-secondary" id="title-cancel-btn" type="button">取消</button>
    `;
    const input = document.getElementById("title-edit-input");
    input.focus();
    input.select();
    document.getElementById("title-cancel-btn").onclick = () => showDetail(recipe.id);
    const save = async () => {
      const newTitle = input.value.trim();
      if (!newTitle) { alert("標題不能空白"); return; }
      if (newTitle === oldTitle) { showDetail(recipe.id); return; }
      const saveBtn = document.getElementById("title-save-btn");
      const cancelBtn = document.getElementById("title-cancel-btn");
      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      input.disabled = true;
      saveBtn.textContent = "儲存中…";
      try {
        await updateRecipeField(
          recipe.id,
          current => ({ ...current, title: newTitle }),
          `編輯食譜標題：${oldTitle} → ${newTitle}`
        );
        showToast("已更新標題", async () => {
          try {
            await updateRecipeField(
              recipe.id,
              current => ({ ...current, title: oldTitle }),
              `復原標題編輯：${newTitle} → ${oldTitle}`
            );
          } catch (err) {
            alert(err.message);
          }
        });
      } catch (err) {
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        input.disabled = false;
        saveBtn.textContent = "儲存";
        alert(err.message);
      }
    };
    document.getElementById("title-save-btn").onclick = save;
    input.onkeydown = (e) => {
      if (e.key === "Enter") save();
      if (e.key === "Escape") showDetail(recipe.id);
    };
  };
}

function wireStepEdit(recipe) {
  if (!getGhToken()) return;
  document.querySelectorAll(".step-edit-btn").forEach(btn => {
    btn.onclick = () => {
      const li = btn.closest("li");
      const stage = li.dataset.stage || "";
      const order = Number(li.dataset.order);
      const step = (recipe.steps || []).find(s => (s.stage || "") === stage && s.order === order);
      if (!step) return;
      const oldText = step.text;
      li.innerHTML = `
        <textarea class="step-edit-textarea">${escapeHtml(oldText)}</textarea>
        <div class="step-edit-actions">
          <button class="btn-primary" type="button" data-action="save">儲存</button>
          <button class="btn-secondary" type="button" data-action="cancel">取消</button>
        </div>
      `;
      const textarea = li.querySelector("textarea");
      textarea.focus();
      const saveBtn = li.querySelector('[data-action="save"]');
      const cancelBtn = li.querySelector('[data-action="cancel"]');
      cancelBtn.onclick = () => showDetail(recipe.id);
      saveBtn.onclick = async () => {
        const newText = textarea.value.trim();
        if (!newText) { alert("步驟內容不能空白"); return; }
        if (newText === oldText) { showDetail(recipe.id); return; }
        saveBtn.disabled = true;
        cancelBtn.disabled = true;
        textarea.disabled = true;
        saveBtn.textContent = "儲存中…";
        const applyText = text => current => {
          const steps = current.steps.map(s =>
            (s.stage || "") === stage && s.order === order ? { ...s, text } : s
          );
          return { ...current, steps };
        };
        try {
          await updateRecipeField(recipe.id, applyText(newText), `編輯食譜步驟：${recipe.title}`);
          showToast("已更新步驟", async () => {
            try {
              await updateRecipeField(recipe.id, applyText(oldText), `復原步驟編輯：${recipe.title}`);
            } catch (err) {
              alert(err.message);
            }
          });
        } catch (err) {
          saveBtn.disabled = false;
          cancelBtn.disabled = false;
          textarea.disabled = false;
          saveBtn.textContent = "儲存";
          alert(err.message);
        }
      };
    };
  });
}

// 跟 wireTitleEdit 同一套架構，差別是這個欄位允許存空字串（代表清除連結），
// 不能像標題那樣擋空值；儲存前只驗證「空字串，或以 http(s):// 開頭」，不限制網域。
function wireReferenceLinkEdit(recipe) {
  const btn = document.getElementById("edit-reference-btn");
  if (!btn) return;
  btn.onclick = () => {
    const row = btn.closest(".reference-link-row");
    const oldUrl = recipe.reference_url || "";
    row.innerHTML = `
      <input type="text" class="reference-edit-input" id="reference-edit-input" value="${escapeHtml(oldUrl)}" placeholder="https://…（留空可清除連結）">
      <button class="btn-primary" id="reference-save-btn" type="button">儲存</button>
      <button class="btn-secondary" id="reference-cancel-btn" type="button">取消</button>
    `;
    const input = document.getElementById("reference-edit-input");
    input.focus();
    input.select();
    document.getElementById("reference-cancel-btn").onclick = () => showDetail(recipe.id);
    const save = async () => {
      const newUrl = input.value.trim();
      if (newUrl !== "" && !/^https?:\/\//i.test(newUrl)) {
        alert("連結格式不正確：請留空，或輸入以 http:// 或 https:// 開頭的網址");
        return;
      }
      if (newUrl === oldUrl) { showDetail(recipe.id); return; }
      const saveBtn = document.getElementById("reference-save-btn");
      const cancelBtn = document.getElementById("reference-cancel-btn");
      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      input.disabled = true;
      saveBtn.textContent = "儲存中…";
      try {
        await updateRecipeField(
          recipe.id,
          current => ({ ...current, reference_url: newUrl }),
          `編輯食譜相關連結：${recipe.title}`
        );
        showToast("已更新相關連結", async () => {
          try {
            await updateRecipeField(
              recipe.id,
              current => ({ ...current, reference_url: oldUrl }),
              `復原相關連結編輯：${recipe.title}`
            );
          } catch (err) {
            alert(err.message);
          }
        });
      } catch (err) {
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        input.disabled = false;
        saveBtn.textContent = "儲存";
        alert(err.message);
      }
    };
    document.getElementById("reference-save-btn").onclick = save;
    input.onkeydown = (e) => {
      if (e.key === "Enter") save();
      if (e.key === "Escape") showDetail(recipe.id);
    };
  };
}

// 3~5 秒後自動消失的小提示條，附一個「復原」文字按鈕。一次只保留一個提示，
// 避免連續加好幾個食材時疊出一堆提示條。
function showToast(message, onUndo) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button class="toast-undo" type="button">復原</button>
  `;
  document.body.appendChild(toast);
  const timer = setTimeout(() => toast.remove(), 4000);
  toast.querySelector(".toast-undo").onclick = () => {
    clearTimeout(timer);
    toast.remove();
    onUndo();
  };
}

function showDetail(id) {
  const recipe = state.recipes.find(r => r.id === id);
  if (!recipe) return;
  state.currentDetailId = id;
  const canEdit = !!getGhToken();

  document.getElementById("list-view").classList.add("hidden");
  const detail = document.getElementById("detail-view");
  detail.classList.remove("hidden");

  detail.innerHTML = `
    <div class="detail-top-bar">
      <button class="back-btn" id="back-btn">← 回列表</button>
      <button class="delete-recipe-btn" id="delete-recipe-btn">🗑 刪除食譜</button>
    </div>
    <div class="detail-title-row">
      <h2 class="detail-title">${escapeHtml(recipe.title)}</h2>
      ${canEdit ? `<button class="edit-icon-btn" id="edit-title-btn" type="button" title="編輯標題">✏️</button>` : ""}
    </div>
    ${recipe.source ? `<div class="detail-meta">來源：${escapeHtml(recipe.source)}</div>` : ""}
    ${renderShoppingList(recipe)}
    <p class="legend"><span class="dot"></span>綠色底色代表素材庫已有此項目</p>

    ${renderIngredientsByCategory(recipe)}
    ${renderSteps(recipe)}
    ${renderReferenceLink(recipe)}
  `;
  document.getElementById("back-btn").onclick = () => {
    state.currentDetailId = null;
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
      state.currentDetailId = null;
      detail.classList.add("hidden");
      document.getElementById("list-view").classList.remove("hidden");
      renderList();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "🗑 刪除食譜";
      alert(err.message);
    }
  };
  detail.querySelectorAll(".ing-add-btn").forEach(addBtn => {
    addBtn.onclick = async () => {
      if (!getGhToken()) {
        alert("尚未設定 GitHub token，請先到食材庫分頁貼上 token（新增食材共用同一組 token）。");
        return;
      }
      const { category, name } = addBtn.dataset;
      addBtn.disabled = true;
      addBtn.textContent = "加入中…";
      try {
        await addPantryItem(category, name);
        showDetail(recipe.id);
        showToast(`已加入食材庫：${name}`, async () => {
          try {
            await removePantryItem(category, name);
            showDetail(recipe.id);
          } catch (err) {
            alert(err.message);
          }
        });
      } catch (err) {
        addBtn.disabled = false;
        addBtn.textContent = "+ 加入";
        alert(err.message);
      }
    };
  });
  detail.querySelectorAll(".ing-remove-btn").forEach(removeBtn => {
    removeBtn.onclick = async () => {
      if (!getGhToken()) {
        alert("尚未設定 GitHub token，請先到食材庫分頁貼上 token（移除食材共用同一組 token）。");
        return;
      }
      const { category, name } = removeBtn.dataset;
      removeBtn.disabled = true;
      removeBtn.textContent = "移除中…";
      try {
        await removePantryItem(category, name);
        showDetail(recipe.id);
        showToast(`已從食材庫移除：${name}`, async () => {
          try {
            await addPantryItem(category, name);
            showDetail(recipe.id);
          } catch (err) {
            alert(err.message);
          }
        });
      } catch (err) {
        removeBtn.disabled = false;
        removeBtn.textContent = "− 移除";
        alert(err.message);
      }
    };
  });
  wireTitleEdit(recipe);
  wireStepEdit(recipe);
  wireReferenceLinkEdit(recipe);
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

// 食譜只有單一檔案要改（不像刪除食譜要同時動 index.json 跟食譜檔案兩個檔案），
// 寫入成功後同步更新 state.recipes 快取、重新渲染詳細頁。
async function updateRecipeField(id, mutateFn, message) {
  const newRecipe = await updateJsonFileOnGitHub(`data/recipes/${id}.json`, mutateFn, message);
  const idx = state.recipes.findIndex(r => r.id === id);
  if (idx !== -1) state.recipes[idx] = newRecipe;
  showDetail(id);
  renderList(); // 列表頁（如標題）跟著更新，比照 deleteRecipe 寫入成功後的既有作法
  return newRecipe;
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
  // 切分頁只是切換顯示/隱藏，DOM 不會自動重算：如果離開時食譜詳細頁還開著，
  // 這段期間食材庫可能被改動過（在食材庫分頁新增/刪除），回來時要強制重新渲染，
  // 不然還是顯示切分頁之前那份舊的 have/missing 狀態。
  const detailView = document.getElementById("detail-view");
  if (state.currentDetailId && !detailView.classList.contains("hidden")) {
    showDetail(state.currentDetailId);
  }
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
