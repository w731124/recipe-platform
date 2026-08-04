#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`錯誤：找不到檔案 ${filePath}`);
    process.exit(1);
  }
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`錯誤：無法讀取檔案 ${filePath}\n${err.message}`);
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`錯誤：${filePath} 不是合法的 JSON\n${err.message}`);
    process.exit(1);
  }
}

function main() {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const pantryPath = path.join(root, 'data', 'pantry.json');
  const synonymsPath = path.join(root, 'data', 'synonyms.json');

  const pantry = readJson(pantryPath);
  const synonyms = readJson(synonymsPath);

  const pantryItems = [];
  for (const [category, items] of Object.entries(pantry)) {
    for (const item of items) {
      pantryItems.push({ item, category });
    }
  }

  const synonymKeys = new Set(Object.keys(synonyms));

  const gaps = pantryItems.filter(({ item }) => !synonymKeys.has(item));

  const pantryItemNames = new Set(pantryItems.map(({ item }) => item));
  const referenceOnly = [...synonymKeys].filter((key) => !pantryItemNames.has(key));

  console.log('== 食材庫 / 同義詞庫 一致性檢查 ==\n');

  if (gaps.length === 0) {
    console.log('✅ 通過：食材庫裡的每個項目，在同義詞庫中都有對應的同義詞群組。');
  } else {
    console.log(`❌ 發現 ${gaps.length} 個缺口：以下食材庫項目在同義詞庫中沒有對應的同義詞群組\n`);
    for (const { item, category } of gaps) {
      console.log(`  - ${item}（分類：${category}）`);
    }
  }

  if (referenceOnly.length > 0) {
    console.log(`\n僅供參考：以下同義詞群組的正式名稱，目前食材庫裡沒有對應項目（共 ${referenceOnly.length} 個，不影響檢查結果）\n`);
    for (const key of referenceOnly) {
      console.log(`  - ${key}`);
    }
  }

  process.exit(gaps.length === 0 ? 0 : 1);
}

main();
