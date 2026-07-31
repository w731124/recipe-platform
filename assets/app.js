// 食譜筆記本 — 純前端靜態網站
// 資料來源：/data/*.json，無任何後端或 API 呼叫。
// 素材庫比對邏輯見 PROJECT_SPEC.md 第 5 節（同義詞庫查表）。

const state = {
  recipes: [],
  pantry: [],
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
  state.pantry = pantry;
  state.synonyms = synonyms;
  state.recipes = recipes;
}

// ---- 素材庫比對（同義詞庫查表，見規格 5 節）----
function isInPantry(ingredientName) {
  const name = ingredientName.trim();
  let matchedGroup = false;
  for (const [canonical, aliases] of Object.entries(state.synonyms)) {
    const hit = aliases.some(alias => name.includes(alias) || alias.includes(name));
    if (hit) {
      matchedGroup = true;
      if (state.pantry.includes(canonical)) return true;
    }
  }
  if (matchedGroup) return false; // 同義詞群組存在，但素材庫沒有該項目
  // 回退：沒有對應同義詞群組時，直接對素材庫做包含比對
  return state.pantry.some(p => name.includes(p) || p.includes(name));
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
  } catch (err) {
    document.getElementById("recipe-list").innerHTML =
      `<div class="empty-state">資料載入失敗：${escapeHtml(err.message)}</div>`;
    console.error(err);
  }
}

init();
