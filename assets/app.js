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
  return Object.keys(state.ingredientFamilies).some(root => name.includes(root) || root.includes(name));
}

// ---- 素材庫比對（同義詞庫查表，見規格 5 節）----
function isInPantry(ingredientName) {
  const name = ingredientName.trim();
  const ambiguous = relatesToFamily(name);
  let matchedGroup = false;
  for (const [canonical, aliases] of Object.entries(state.synonyms)) {
    const hit = aliases.some(alias => {
      if (name.includes(alias)) return true;
      if (alias.includes(name)) return !ambiguous;
      return false;
    });
    if (hit) {
      matchedGroup = true;
      if (state.pantryFlat.includes(canonical)) return true;
    }
  }
  if (matchedGroup) return false; // 同義詞群組存在，但素材庫沒有該項目
  if (ambiguous) return false; // 跟家族有關的籠統詞交給 familyStatus 處理，這裡不用寬鬆比對誤判成已有
  // 回退：沒有對應同義詞群組時，直接對素材庫做包含比對
  return state.pantryFlat.some(p => name.includes(p) || p.includes(name));
}

// 「同一家族但品種/形態不確定」的軟比對（例：食譜寫「花椒」，庫存有「紅花椒粒」「青花椒粉」，
// 兩者都不是嚴格同義詞，但值得提醒使用者自己確認，而不是直接判定「還需要買」）
function familyStatus(ingredientName) {
  const name = ingredientName.trim();
  for (const [family, members] of Object.entries(state.ingredientFamilies)) {
    if (name.includes(family) || family.includes(name)) {
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
      <div class="recipe-meta">${escapeHtml(recipe.servings || "")}${recipe.time_minutes ? ` · ${recipe.time_minutes} 分鐘` : ""}</div>
      <div class="tag-row">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
    `;
    el.appendChild(card);
  });
}

function renderIngredientList(items) {
  if (!items || items.length === 0) return "<p class=\"legend\">（無）</p>";
  return `<ul class="ingredient-list">${items.map(item => {
    const status = pantryStatus(item.name);
    const hint = status === "maybe" ? `<span class="ing-hint" title="家族相近，品種或形態可能不同，請自行確認">？</span>` : "";
    return `<li class="${status}">
      <span class="ing-name">${escapeHtml(item.name)}${hint}</span>
      <span class="ing-amount">${escapeHtml([item.amount, item.unit].filter(Boolean).join(" "))}</span>
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
    <div class="detail-meta">
      ${escapeHtml(recipe.servings || "")}
      ${recipe.time_minutes ? ` · ${recipe.time_minutes} 分鐘` : ""}
      ${recipe.source ? ` · 來源：${escapeHtml(recipe.source)}` : ""}
    </div>
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

  const categoriesHtml = state.pantryCategories.map(cat => {
    const items = state.pantry[cat] || [];
    const chips = items.length
      ? items.map(name => `
          <span class="pantry-chip">
            ${escapeHtml(name)}
            ${token ? `<button class="chip-remove" data-cat="${escapeHtml(cat)}" data-name="${escapeHtml(name)}" title="移除">×</button>` : ""}
          </span>`).join("")
      : `<span class="legend">（尚無項目）</span>`;
    return `<div class="pantry-category">
      <h3>${escapeHtml(cat)}</h3>
      <div class="pantry-chips">${chips}</div>
    </div>`;
  }).join("");

  const addForm = token
    ? `<div class="pantry-add-form">
        <h3>新增食材</h3>
        <div class="token-input-row">
          <select id="pantry-add-category">
            ${state.pantryCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
          </select>
          <input type="text" id="pantry-add-name" placeholder="食材名稱，例如：肉桂">
          <button class="btn-primary" id="pantry-add-btn">新增</button>
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
      renderPantryView();
    };

    el.querySelectorAll(".chip-remove").forEach(btn => {
      btn.onclick = async () => {
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

    document.getElementById("pantry-add-btn").onclick = async () => {
      const category = document.getElementById("pantry-add-category").value;
      const nameInput = document.getElementById("pantry-add-name");
      const name = nameInput.value;
      if (!name.trim()) return;
      setBusy(true);
      showStatus(`新增「${name}」中…`, false);
      try {
        await addPantryItem(category, name);
        renderPantryView();
      } catch (err) {
        setBusy(false);
        showStatus(err.message, true);
      }
    };
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
