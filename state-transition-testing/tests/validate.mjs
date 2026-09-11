import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("data.js", "utf8"), context);
vm.runInContext(fs.readFileSync("validator.js", "utf8"), context);
const exercises = context.window.TRAINING_EXERCISES;
const validator = context.window.TRAINING_VALIDATOR;
const meta = context.window.TRAINING_META;

assert.equal(exercises.length, 3, "練習2問と本番1問が必要です");
assert.equal(exercises.map((item) => item.section).join("|"), "練習問題 01|練習問題 02|本番問題");
assert.ok(meta.storageKey.includes("rev1"));
assert.match(meta.code, /^[A-Z]{2,3}$/);
assert.match(meta.colors.primary, /^#[0-9a-f]{6}$/i);
assert.notEqual(meta.colors.primary.toLowerCase(), "#17643e", "デシジョンテーブルの緑とは異なる主色にします");
assert.equal(meta.legend.length, 4);
assert.equal(exercises.at(-1).steps.at(-1).type, "quiz");
assert.ok(exercises.at(-1).steps.at(-1).questions.length >= 3);

for (const exercise of exercises) {
  assert.ok(exercise.specs.length, `${exercise.id}: 仕様が必要です`);
  for (const step of exercise.steps) {
    let correct; let wrong;
    if (step.type === "choice") {
      correct = validator.validateChoice(step, step.answer);
      wrong = validator.validateChoice(step, "");
    } else if (step.type === "multiChoice") {
      correct = validator.validateMultiChoice(step, step.answer);
      wrong = validator.validateMultiChoice(step, step.answer.slice(1));
    } else if (step.type === "numericGroup") {
      const fields = Object.fromEntries(step.fields.map((field) => [field.id, field.answer]));
      correct = validator.validateNumericGroup(step, fields);
      wrong = validator.validateNumericGroup(step, {});
    } else if (step.type === "caseSet") {
      correct = validator.validateCaseSet(step, structuredClone(step.answer).reverse());
      wrong = validator.validateCaseSet(step, step.answer.slice(1));
    } else if (step.type === "recordSet") {
      correct = validator.validateRecordSet(step, structuredClone(step.answer).reverse());
      wrong = validator.validateRecordSet(step, step.answer.slice(1));
    } else if (step.type === "stateTable") {
      const fields = Object.fromEntries(Object.entries(step.cells).map(([id, cell]) => [id, cell.answer]));
      correct = validator.validateStateTable(step, fields);
      const first = Object.keys(fields)[0]; fields[first] = "";
      wrong = validator.validateStateTable(step, fields);
    } else if (step.type === "pairwise") {
      assert.ok(step.sampleRows?.length, `${exercise.id}:${step.id}: 回帰テスト用の有効解が必要です`);
      correct = validator.validatePairwise(step, structuredClone(step.sampleRows));
      wrong = validator.validatePairwise(step, step.sampleRows.slice(1));
      assert.equal(correct.stats.covered, correct.stats.required);
    } else if (step.type === "quiz") {
      const fields = Object.fromEntries(step.questions.map((question) => [question.id, question.answer]));
      correct = validator.validateQuiz(step, fields);
      wrong = validator.validateQuiz(step, {});
    } else {
      assert.fail(`未テストの形式: ${step.type}`);
    }
    assert.equal(correct.pass, true, `${exercise.id}:${step.id}: 正答が合格すること`);
    assert.equal(wrong.pass, false, `${exercise.id}:${step.id}: 不完全な回答が不合格になること`);
  }
}

for (const file of ["index.html", "styles.css", "app.js", "validator.js", "data.js"]) assert.ok(fs.existsSync(file), `${file} が必要です`);
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const app = fs.readFileSync("app.js", "utf8");
assert.ok(app.includes("formatProductionFeedback") && app.includes("本番問題では個別の正答ヒントは表示しません"), "本番問題では個別の正答ヒントを隠すこと");
assert.match(app, /result\.pass && current\.type === "quiz"/, "本番の理解度チェックは正解後だけ解答を表示すること");
assert.match(html, /仕様/);
assert.match(html, /回答/);
assert.match(html, /自己学習用/);
assert.match(html, /id="helpButton"[^>]*>使い方<\//, "使い方ボタンは記号を付けずに表示します");
assert.match(html, /class="back-button" href="\.\.\/">一覧に戻る<\//, "一覧へ戻る明示的な導線があること");
assert.match(css, /\.back-button\s*\{[^}]*text-decoration:\s*none;/s, "一覧へ戻る導線をボタンとして表示すること");
assert.doesNotMatch(html, />\? 使い方</, "使い方ボタンの不要な記号を表示しません");
assert.match(css, /\.help-button[^}]*min-width: 64px/, "使い方ボタンの表示幅を確保します");
assert.equal((html.match(/data-guide-scene/g) || []).length, 5, "使い方には5場面の手動デモが必要です");
assert.match(html, /id="guidePrev"[\s\S]*＞/, "使い方には前後の場面を切り替える操作が必要です");
assert.match(app, /function renderGuide[\s\S]*data-guide-scene/, "使い方の場面を手動で切り替えられること");
assert.match(app, /data-guide-step/, "使い方は見たい場面を直接選べること");
assert.doesNotMatch(html, /https?:\/\//, "静的アセットは相対パスにします");
for (const requiredClass of ["topbar", "page-summary", "course-nav", "section-jump", "spec-panel", "answer-panel", "summary-progress"]) assert.match(html, new RegExp(`class="[^"]*${requiredClass}`), `DT共通レイアウトの${requiredClass}が必要です`);
assert.match(css, /@media \(max-width: 980px\)[\s\S]*\.course-nav \{ grid-template-columns: 1fr; \}/, "狭い画面では問題ナビを1列にします");
assert.match(css, /\.training-table-wrap[^}]*overflow-x: auto/, "幅広い表は表の領域内だけで横スクロールさせます");
console.log(`validated ${exercises.length} exercises`);
