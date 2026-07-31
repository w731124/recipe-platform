// 食譜筆記本 — 純前端靜態網站
// 資料來源：/data/*.json，無任何後端或 API 呼叫（食材庫寫入除外，見下方 GitHub 直接寫入區塊）。
// 素材庫比對邏輯見 PROJECT_SPEC.md 第 5 節（同義詞庫查表）。

const state = {
  recipes: [],
  pantry: {},
  pantryFlat: [],
  pantryCategories: [],
  synonyms: {},
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
  const [taxonomy, pantry, synonyms, index] = await Promise.all([
    fetch("data/taxonomy.json").then(r => r.json()),
    fetch("data/pantry.json").then(r => r.json()),
    fetch("data/synonyms.json").then(r => r.json()),
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
  state.recipes = recipes;
}

function flattenPantry(pantry) {
  return Object.values(pantry).flat();
}

// ---- 素材庫比對（同義詞庫查表，見規格 5 節）----
function isInPantry(ingredientName) {
  const name = ingredientName.trim();
  let matchedGroup = false;
  for (const [canonical, aliases] of Object.entries(state.synonyms)) {
    const hit = aliases.some(alias => name.includes(alias) || alias.includes(name));
    if (hit) {
      matchedGroup = true;
      if (state.pantryFlat.includes(canonical)) return true;
    }
  }
  if (matchedGroup) return false; // 同義詞群組存在，但素材庫沒有該項目
  // 回退：沒有對應同義詞群組時，直接對素材庫做包含比對
  return state.pantryFlat.some(p => name.includes(p) || p.includes(name));
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
    const have = isInPantry(item.name);
    return `<li class="${have ? "have" : ""}">
      <span class="ing-name">${escapeHtml(item.name)}</span>
      <span class="ing-amount">${escapeHtml([item.amount, item.unit].filter(Boolean).join(" "))}</span>
    </li>`;
  }).join("")}</ul>`;
}

function renderShoppingList(recipe) {
  const all = [
    ...(recipe.ingredients || []),
    ...(recipe.seasonings || []),
    ...(recipe.spices || []),
  ];
  const missingNames = [...new Set(
    all.filter(item => !isInPantry(item.name)).map(item => item.name)
  )];
  if (missingNames.length === 0) {
    return `<div class="shopping-list"><p class="legend">✅ 素材庫都有，不用額外採購！</p></div>`;
  }
  return `<div class="shopping-list">
    <h4>🛒 還需要買</h4>
    <div class="tag-row">${missingNames.map(n => `<span class="tag missing">${escapeHtml(n)}</span>`).join("")}</div>
  </div>`;
}

function showDetail(id) {
  const recipe = state.recipes.find(r => r.id === id);
  if (!recipe) return;

  document.getElementById("list-view").classList.add("hidden");
  const detail = document.getElementById("detail-view");
  detail.classList.remove("hidden");

  detail.innerHTML = `
    <button class="back-btn" id="back-btn">← 回列表</button>
    <h2 class="detail-title">${escapeHtml(recipe.title)}</h2>
    <div class="detail-meta">
      ${escapeHtml(recipe.servings || "")}
      ${recipe.time_minutes ? ` · ${recipe.time_minutes} 分鐘` : ""}
      ${recipe.source ? ` · 來源：${escapeHtml(recipe.source)}` : ""}
    </div>
    ${renderShoppingList(recipe)}
    <p class="legend"><span class="dot"></span>綠色底色代表素材庫已有此項目</p>

    <div class="section-block">
      <h4>食材</h4>
      ${renderIngredientList(recipe.ingredients)}
    </div>
    <div class="section-block">
      <h4>調味料</h4>
      ${renderIngredientList(recipe.seasonings)}
    </div>
    <div class="section-block">
      <h4>香辛料</h4>
      ${renderIngredientList(recipe.spices)}
    </div>
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
  window.scrollTo(0, 0);
}

// ---- 食材庫：GitHub 直接寫入 ----
// 只有食材庫的新增/刪除會呼叫 GitHub API；其餘資料（食譜、分類詞彙表等）
// 仍照 CLAUDE.md 既定流程，由 Claude Code 離線寫入 + git push。
const GH_OWNER = "w731124";
const GH_REPO = "recipe-platform";
const GH_BRANCH = "main";
const GH_PANTRY_PATH = "data/pantry.json";
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

async function commitPantryUpdate(newPantry, message) {
  const token = getGhToken();
  if (!token) throw new Error("尚未設定 GitHub token");

  const getRes = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_PANTRY_PATH}?ref=${GH_BRANCH}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (!getRes.ok) throw new Error(`讀取目前 GitHub 上的檔案失敗（HTTP ${getRes.status}）`);
  const getData = await getRes.json();

  const content = utf8ToBase64(JSON.stringify(newPantry, null, 2) + "\n");
  const putRes = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_PANTRY_PATH}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, content, sha: getData.sha, branch: GH_BRANCH }),
    }
  );
  if (!putRes.ok) {
    if (putRes.status === 409) {
      throw new Error("有其他變更同時發生（衝突），請重新整理頁面後再試一次。");
    }
    const err = await putRes.json().catch(() => ({}));
    throw new Error(`寫入 GitHub 失敗（HTTP ${putRes.status}）：${err.message || "未知錯誤"}`);
  }
  return putRes.json();
}

async function addPantryItem(category, name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const updated = JSON.parse(JSON.stringify(state.pantry));
  if (!updated[category]) updated[category] = [];
  if (updated[category].includes(trimmed)) throw new Error("這個項目已經在食材庫裡了");
  updated[category].push(trimmed);
  await commitPantryUpdate(updated, `素材庫：新增「${trimmed}」`);
  state.pantry = updated;
  state.pantryFlat = flattenPantry(updated);
}

async function removePantryItem(category, name) {
  const updated = JSON.parse(JSON.stringify(state.pantry));
  updated[category] = (updated[category] || []).filter(n => n !== name);
  await commitPantryUpdate(updated, `素材庫：移除「${name}」`);
  state.pantry = updated;
  state.pantryFlat = flattenPantry(updated);
}

function renderPantryView() {
  const el = document.getElementById("pantry-view");
  const token = getGhToken();

  const tokenPanel = token
    ? `<div class="token-panel token-panel-active">
        <span>✅ 已設定 GitHub Token，可以新增/刪除食材庫項目</span>
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
    <div id="pantry-status"></div>
    <div class="pantry-categories">${categoriesHtml}</div>
    ${addForm}
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
