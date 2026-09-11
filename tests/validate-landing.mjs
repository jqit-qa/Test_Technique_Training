import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const context = {
  window: { addEventListener() {} },
  document: { querySelectorAll() { return []; }, querySelector() { return null; } },
  localStorage: { getItem() { return null; } }
};
vm.createContext(context);
vm.runInContext(app, context);

assert.equal(context.window.TRAINING_LANDING.isTrainingComplete(JSON.stringify({ version: 1, completed: ["production:quiz"] }), 1), true);
assert.equal(context.window.TRAINING_LANDING.isTrainingComplete(JSON.stringify({ version: 1, completed: ["production:usage"] }), 1), false);
assert.equal(context.window.TRAINING_LANDING.isTrainingComplete("not-json", 1), false);
assert.equal((html.match(/data-training/g) || []).length, 5, "5技法の完了状態を表示します");
assert.equal((html.match(/class="clear-mark"/g) || []).length, 5, "各技法にClearマークを用意します");
assert.match(css, /\.clear-mark\[hidden\] \+ b\s*\{\s*margin-left:\s*auto;/, "Clearが非表示でも矢印を右端に固定します");
assert.match(html, /decision-table\//, "デシジョンテーブルへのリンクが必要です");
console.log("landing completion indicators validated");
