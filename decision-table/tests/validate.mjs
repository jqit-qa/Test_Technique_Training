import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = vm.createContext({ window: {} });
for (const filename of ["data.js", "validator.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${filename}`, import.meta.url), "utf8"), context, { filename });
}

const exercises = context.window.DT_EXERCISES;
const validator = context.window.DT_VALIDATOR;

assert.equal(exercises.length, 3, "練習2問・本番1問であること");
assert.equal(exercises.map((exercise) => exercise.fullColumns.length).join(","), "8,8,16", "完全表の列数");
assert.equal(exercises.map((exercise) => exercise.navLabel).join(","), "練習問題①,練習問題②,本番問題", "コース選択で練習・本番の区別を明示すること");

function toAnswerColumns(exercise, sourceColumns, total = sourceColumns.length) {
  return Array.from({ length: total }, (_, index) => {
    const source = sourceColumns[index];
    if (!source) return { conditions: Array(exercise.conditions.length).fill(""), actions: Array(exercise.actions.length).fill("") };
    const actions = Array(exercise.actions.length).fill("");
    actions[source.result === "NA" ? 0 : source.result] = source.result === "NA" ? "NA" : "X";
    return { conditions: [...source.conditions], actions };
  });
}

for (const exercise of exercises) {
  const full = toAnswerColumns(exercise, exercise.fullColumns);
  assert.equal(validator.validateFullTable(exercise, full).pass, true, `${exercise.id}: 完全表の正解を受理`);
  assert.equal(validator.validateFullTable(exercise, [...full].reverse()).pass, true, `${exercise.id}: 完全表は列順が違っても受理`);
  full[0].conditions[0] = full[0].conditions[0] === "T" ? "F" : "T";
  assert.equal(validator.validateFullTable(exercise, full).pass, false, `${exercise.id}: 条件誤りを検出`);

  const minimized = toAnswerColumns(exercise, [...exercise.minimizedExample].reverse(), exercise.steps.find((step) => step.type === "minimized").columns);
  assert.equal(validator.validateMinimizedTable(exercise, minimized).pass, true, `${exercise.id}: 最小化表は列順が違っても受理`);
  minimized[0].conditions[0] = "";
  assert.equal(validator.validateMinimizedTable(exercise, minimized).pass, false, `${exercise.id}: 最小化表の未入力を検出`);

  const minimizedStep = exercise.steps.find((step) => step.type === "minimized");
  if (minimizedStep.columns >= exercise.fullColumns.length) {
    const copiedFullTable = toAnswerColumns(exercise, exercise.fullColumns, minimizedStep.columns);
    const copiedResult = validator.validateMinimizedTable(exercise, copiedFullTable);
    assert.equal(copiedResult.pass, false, `${exercise.id}: 全組み合わせ表のコピーを最小化として受理しない`);
    assert.ok(copiedResult.issues.some((issue) => issue.includes(`${exercise.minimizedExample.length}列まで`)), `${exercise.id}: 必要な最小列数を案内`);
  }
}

const conditionCountStep = exercises[0].steps.find((step) => step.id === "count");
assert.equal(conditionCountStep.fields.length, 2, "条件数タブの入力欄は2つだけであること");
assert.ok(conditionCountStep.fields.every((field) => field.answerDisplay), "入力欄ごとの解答表示があること");
assert.ok(!conditionCountStep.fields.some((field) => field.key === "formula"), "掛け算を手入力させないこと");
assert.equal(exercises[0].fullColumns.some((column) => column.result === "NA"), false, "01にはN/Aがないこと");

const action400 = ["", "", "", "X"];
const firstMerge = validator.mergeColumns(
  { conditions: ["T", "T", "T"], actions: action400 },
  { conditions: ["F", "T", "T"], actions: action400 }
);
assert.equal(firstMerge.ok, true, "同じ結果で1条件だけT/Fが違う2列を統合できること");
assert.equal(firstMerge.column.conditions.join(","), "-,T,T", "異なる条件をハイフンへ置換すること");

const secondMerge = validator.mergeColumns(
  firstMerge.column,
  { conditions: ["-", "F", "T"], actions: action400 }
);
assert.equal(secondMerge.ok, true, "ハイフンを含む列も段階的に統合できること");
assert.equal(secondMerge.column.conditions.join(","), "-,-,T", "2段階目の統合結果");

assert.equal(validator.mergeColumns(
  { conditions: ["T", "T", "T"], actions: action400 },
  { conditions: ["F", "F", "T"], actions: action400 }
).ok, false, "2条件が違う列は統合しないこと");

assert.equal(validator.mergeColumns(
  { conditions: ["T", "T", "T"], actions: action400 },
  { conditions: ["F", "T", "T"], actions: ["", "", "X", ""] }
).ok, false, "アクションが異なる列は統合しないこと");

assert.equal(exercises[1].steps.map((step) => step.id).join(","), "full,min,coverage", "02はN/A・検算の独立タブを持たないこと");
const practiceCoverage = exercises[1].steps.find((step) => step.type === "coverageChoice");
assert.equal(validator.validateCoverageChoice(practiceCoverage, 6).pass, true, "練習2の正しい分母を受理");
assert.equal(validator.validateCoverageChoice(practiceCoverage, 5).pass, false, "最小化後の列数を分母にしないこと");
assert.equal(validator.validateCoverageChoice(practiceCoverage, 8).pass, false, "N/Aを含む全組み合わせ数を分母にしないこと");

const production = exercises[2];
assert.equal(production.steps.map((step) => step.id).join(","), "full,min,coverage,quiz", "本番問題を練習問題と同じ流れにすること");
assert.ok(!production.steps.some((step) => ["na", "count", "ticket", "reflection"].includes(step.id)), "本番問題に重い記述式タブを残さないこと");
const productionCoverage = production.steps.find((step) => step.type === "coverageChoice");
assert.equal(validator.validateCoverageChoice(productionCoverage, 12).pass, true, "本番問題の正しい分母を受理");
assert.equal(validator.validateCoverageChoice(productionCoverage, 16).pass, false, "本番問題でN/Aを含む全組み合わせ数を分母にしないこと");
assert.equal(validator.validateCoverageChoice(productionCoverage, 6).pass, false, "本番問題で最小化後の列数を分母にしないこと");

const quiz = production.steps.find((step) => step.type === "quiz");
assert.equal(quiz.questions.length, 4, "理解度チェックは4問あること");
assert.ok(quiz.questions.every((question) => question.options.length === 4), "各問が4択であること");
assert.equal(quiz.notification.event, "production_quiz_completed", "本番の理解度チェックだけが完了通知を送ること");
const correctQuizAnswers = Object.fromEntries(quiz.questions.map((question) => [question.id, String(question.answer)]));
assert.equal(validator.validateQuiz(quiz, correctQuizAnswers).pass, true, "理解度チェックの正答を受理");
assert.equal(validator.validateQuiz(quiz, { ...correctQuizAnswers, q1: "0" }).pass, false, "理解度チェックの誤答を検出");
assert.equal(validator.validateQuiz(quiz, {}).pass, false, "理解度チェックの未回答を検出");

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
for (const asset of ["favicon.svg", "styles.css", "data.js", "validator.js", "app.js"]) {
  assert.ok(html.includes(asset), `${asset} がHTMLから読み込まれること`);
  assert.ok(fs.existsSync(new URL(`../${asset}`, import.meta.url)), `${asset} が存在すること`);
}

const specificationPosition = html.indexOf('id="specification"');
const assignmentPosition = html.indexOf('id="assignment"');
assert.ok(specificationPosition > -1 && assignmentPosition > specificationPosition, "仕様が問題・解答より先に表示されること");
assert.ok(!html.includes("組み合わせを、"), "不要なキャッチコピーが削除されていること");
assert.ok(html.includes('id="helpButton"') && html.includes(">使い方</button>"), "使い方の入口が文字で判別できること");
assert.equal((html.match(/data-guide-scene=/g) || []).length, 5, "操作デモが5場面あること");
assert.equal((html.match(/data-guide-step=/g) || []).length, 5, "操作手順が5段階で説明されること");
assert.ok(html.includes("練習問題から本番問題まで進めてください"), "練習問題から本番問題へ進む流れを案内すること");
assert.ok(html.includes("理解度チェックに全問正解すると、リーダーへ完了通知"), "理解度チェック全問正解時の通知条件を案内すること");
assert.ok(html.includes("本番問題の最後に実施します") && html.includes("本番問題のみ"), "理解度チェックが本番問題だけであると明記すること");
for (const control of ["guidePrev", "guideNext"]) {
  assert.ok(html.includes(`id="${control}"`), `${control}: 操作デモを手動操作できること`);
}
assert.ok(!html.includes("guideReplay"), "使い方に不要な再生ボタンを表示しないこと");

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
assert.ok(!appSource.includes("guideReplay"), "使い方の不要な再生処理を残さないこと");
assert.ok(appSource.includes("210 + columns.length * 56"), "列数に応じて表幅を計算すること");
assert.ok(appSource.includes("表は左右にスクロールできます"), "横長表にスクロール案内があること");
assert.match(cssSource, /\.table-cell\s*\{[^}]*min-width:\s*0;/s, "T/F入力がセル幅を超えないこと");
assert.ok(appSource.includes('data-min-action="copy"'), "全組み合わせ表のコピー操作があること");
assert.ok(appSource.includes('data-min-action="add"'), "列追加操作があること");
assert.ok(appSource.includes('data-min-action="merge"'), "選択した2列の統合操作があること");
assert.ok(appSource.includes('data-min-action="undo"') && appSource.includes("直前の操作に戻しました"), "統合順で行き詰まった場合に直前の操作を戻せること");
assert.ok(appSource.includes("AがTでもFでも結果は変わらないため"), "最小化でハイフンにできる理由を説明すること");
assert.ok(appSource.includes("data-select-column"), "統合対象の列選択操作があること");
assert.ok(appSource.includes("data-delete-column"), "列削除操作があること");
assert.ok(appSource.includes("data-mark-na"), "実行不可能な列を専用操作で指定できること");
assert.ok(appSource.includes("minimized-column-with-na"), "最小化表のN/A操作を列選択ボタンと分けて配置すること");
assert.match(cssSource, /\.minimized-column-with-na \.column-na\s*\{[^}]*top:\s*27px;/s, "最小化表のN/A操作を縦方向にずらすこと");
assert.ok(appSource.includes("decision-table-lab-rev3-state-v6"), "完了状態の仕様変更に古い保存状態を持ち込まないこと");
assert.ok(appSource.includes("coverageChoice"), "選択式カバレッジ画面を扱うこと");
assert.ok(appSource.includes("renderQuiz"), "4択の理解度チェック画面を扱うこと");
assert.ok(appSource.includes("invalidateFrom"), "入力変更時に後続の完了状態を解除すること");
assert.ok(appSource.includes("isStepUnlocked"), "前工程を完了するまで後続ステップを開始できないこと");
assert.ok(appSource.includes("一度入力済みのステップは、前の回答を修正して未完了に戻っても再確認・修正できる"), "見直しで未完了に戻っても後続ステップを開けること");
assert.ok(appSource.includes("○の選択は統合候補を示すだけで、表そのものは変えていない"), "最小化表の列選択だけでは完了状態を解除しないこと");
assert.ok(appSource.includes("resultNext"), "正解後に次へ進む導線があること");
assert.ok(appSource.includes("formatProductionFeedback"), "本番問題では列番号を示さないフィードバックにすること");
assert.ok(appSource.includes("renderMinimizedReference") && appSource.includes("最小化の解答例（列順は任意）"), "最小化の正解後に具体的な解答例を表示すること");
assert.ok(appSource.includes("本番問題では正解に直結する説明は表示しません"), "本番問題の不正解時は正解に直結する説明を隠すこと");
assert.ok(appSource.includes('!result.pass && exercise.id === "production"\n        ? ""'), "本番問題の不正解時は解答例・解説を表示しないこと");
assert.match(cssSource, /\.reference-table\s*\{[^}]*min-width:\s*520px;/s, "最小化の解答例を横スクロール可能な表で表示すること");
assert.ok(appSource.includes("course-copy") && appSource.includes("exercise.navLabel"), "コース選択に問題種別と学習テーマを併記すること");
assert.match(appSource, /result\.pass && step\.type === "quiz"/, "理解度チェックの正答・解説は合格後にだけ表示すること");
assert.ok(appSource.includes("sendCompletionNotification"), "理解度チェック全問正解時に通知を送ること");
assert.match(appSource, /activeStep\(\)\.type === "quiz" && event\.target\.type === "radio"/, "受講者名の入力中に理解度チェック全体を再描画しないこと");
assert.match(cssSource, /\.notification-name\s*\{[^}]*margin-bottom:\s*28px;/s, "受講者名と問1の間に十分な間隔を設けること");
assert.ok(!appSource.includes("setInterval"), "操作デモを自動送りしないこと");
assert.ok(appSource.includes('querySelectorAll("[data-guide-step]")'), "見たい手順を直接選べること");
assert.ok(cssSource.includes("prefers-reduced-motion: reduce"), "動きを抑える端末設定に対応すること");
assert.ok(!/Georgia|Yu Mincho/.test(cssSource), "明朝・セリフ体を使用しないこと");
assert.ok(cssSource.includes('--font-sans: -apple-system'), "OS標準のゴシック体スタックを使用すること");
assert.match(cssSource, /\.guide-layout\s*\{[^}]*grid-template-columns:/s, "操作デモと手順を見比べられること");
assert.match(cssSource, /@media \(max-width: 980px\)[\s\S]*?\.guide-layout\s*\{[^}]*grid-template-columns:\s*1fr;/, "狭い画面では使い方を1列表示すること");
assert.ok(!/PRACTICE|FINAL ASSIGNMENT|STEP COMPLETE|CHECK AGAIN|QUESTION/.test(`${html}\n${appSource}\n${fs.readFileSync(new URL("../data.js", import.meta.url), "utf8")}`), "主要な英字ラベルを日本語化すること");

console.log("Validation passed: 3 exercises, semantic table grading, coverage quiz, and assets.");
