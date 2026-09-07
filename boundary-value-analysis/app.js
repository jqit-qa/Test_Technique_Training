(() => {
  "use strict";
  const exercises = window.TRAINING_EXERCISES;
  const meta = window.TRAINING_META;
  const validator = window.TRAINING_VALIDATOR;
  const STORAGE_KEY = meta.storageKey;
  const blank = () => ({ version: meta.version, activeExerciseId: exercises[0].id, activeStep: 0, answers: {}, completed: [] });
  let state = load();
  let guideIndex = 0;
  const guideCaptions = ["① 問題を選ぶ", "② 仕様を読む", "③ 回答を入力する", "④ 答え合わせをする", "⑤ 本番問題のみ：理解度チェック"];
  const $ = (selector) => document.querySelector(selector);
  const el = {
    nav: $("#exerciseNav"), section: $("#sectionLabel"), title: $("#exerciseTitle"), goal: $("#learningGoal"), specs: $("#specList"),
    tabs: $("#stepTabs"), area: $("#answerArea"), progress: $("#progressLabel"), percent: $("#progressPercent"), save: $("#saveStatus"),
    reset: $("#resetButton"), check: $("#checkButton"), dialog: $("#resultDialog"), result: $("#resultContent"), help: $("#helpDialog"),
    guideCounter: $("#guideCounter"), guideCaption: $("#guideCaption"), guidePrev: $("#guidePrev"), guideNext: $("#guideNext")
  };

  function renderGuide(index) {
    guideIndex = (index + guideCaptions.length) % guideCaptions.length;
    el.help.querySelectorAll("[data-guide-scene]").forEach((scene, sceneIndex) => {
      const active = sceneIndex === guideIndex;
      scene.classList.toggle("active", active);
      scene.hidden = !active;
    });
    el.help.querySelectorAll("[data-guide-step]").forEach((item, stepIndex) => {
      const active = stepIndex === guideIndex;
      item.closest("li").classList.toggle("active", active);
      item.setAttribute("aria-current", active ? "step" : "false");
    });
    el.guideCounter.textContent = `${guideIndex + 1} / ${guideCaptions.length}`;
    el.guideCaption.textContent = guideCaptions[guideIndex];
  }

  document.title = `${meta.displayName}技法課題`;
  $("#pageTitle").textContent = `${meta.displayName}技法課題`;
  $("#brandMark").textContent = meta.code;
  $("#brandSubtitle").textContent = `${meta.displayName}技法`;
  $("#versionLabel").textContent = meta.revision || "rev1.00";
  document.documentElement.style.setProperty("--primary", meta.colors.primary);
  document.documentElement.style.setProperty("--primary-dark", meta.colors.dark);
  document.documentElement.style.setProperty("--primary-soft", meta.colors.soft);
  document.documentElement.style.setProperty("--accent", meta.colors.accent);

  function load() { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); return saved?.version === meta.version ? { ...blank(), ...saved } : blank(); } catch (_) { return blank(); } }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); el.save.textContent = "保存済み"; renderProgress(); }
  function exercise() { return exercises.find((item) => item.id === state.activeExerciseId) || exercises[0]; }
  function step() { return exercise().steps[state.activeStep] || exercise().steps[0]; }
  function answer() { state.answers[exercise().id] ||= {}; state.answers[exercise().id][step().id] ||= { value: "", values: [], fields: {}, rows: [] }; return state.answers[exercise().id][step().id]; }
  function key() { return `${exercise().id}:${step().id}`; }
  function isStepUnlocked(index) { return exercise().steps.slice(0, index).every((current) => state.completed.includes(`${exercise().id}:${current.id}`)) || Boolean(state.answers[exercise().id]?.[exercise().steps[index]?.id]); }
  function isExerciseUnlocked(index) { return exercises.slice(0, index).every((entry) => entry.steps.every((current) => state.completed.includes(`${entry.id}:${current.id}`))) || Boolean(Object.keys(state.answers[exercises[index]?.id] || {}).length); }
  function invalidateFrom(index) { const active = exercise(); const invalid = active.steps.slice(index).map((current) => `${active.id}:${current.id}`); state.completed = state.completed.filter((item) => !invalid.includes(item)); }
  function esc(value) { return String(value ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function attrs(value) { return esc(value); }

  function render() {
    const item = exercise();
    if (state.activeStep >= item.steps.length) state.activeStep = 0;
    const isProduction = item.id === "production";
    el.section.textContent = item.section;
    el.title.textContent = item.title;
    el.goal.textContent = item.goal;
    el.specs.innerHTML = item.specs.map((spec) => `<li>${esc(spec)}</li>`).join("");
    $("#difficulty").textContent = isProduction ? "実践" : item.id === "practice-2" ? "応用" : "基礎";
    $("#assignmentTitle").textContent = isProduction ? "本番問題" : "練習問題";
    $("#assignmentJumpLabel").textContent = isProduction ? "本番問題" : "練習問題";
    $("#techniqueLegend").innerHTML = meta.legend.map((entry) => `<span><b class="legend-symbol">${esc(entry.term)}</b>${esc(entry.description)}</span>`).join("");
    el.nav.innerHTML = exercises.map((entry, index) => {
      const done = entry.steps.filter((current) => state.completed.includes(`${entry.id}:${current.id}`)).length;
      const complete = done === entry.steps.length;
      const navLabel = entry.id === "production" ? "本番問題" : `練習問題${index === 0 ? "①" : "②"}`;
      const unlocked = isExerciseUnlocked(index); return `<button class="course-button ${entry.id === item.id ? "active" : ""}" type="button" data-exercise="${attrs(entry.id)}" ${unlocked ? "" : "disabled title=\"前の問題を完了すると開始できます\""}><span class="course-index">${String(index + 1).padStart(2, "0")}</span><span class="course-copy"><strong>${navLabel}</strong><small><span>${esc(entry.navTitle)}</span><b>${done} / ${entry.steps.length} ステップ</b></small></span><span class="course-state ${complete ? "complete" : ""}" aria-label="${complete ? "完了" : "未完了"}"></span></button>`;
    }).join("");
    el.tabs.innerHTML = item.steps.map((current, index) => `<button class="step-tab ${state.completed.includes(`${item.id}:${current.id}`) ? "complete" : ""}" type="button" role="tab" aria-selected="${index === state.activeStep}" data-step="${index}" ${isStepUnlocked(index) ? "" : "disabled"}>${state.completed.includes(`${item.id}:${current.id}`) ? "✓" : `${index + 1}.`} ${esc(current.label)}</button>`).join("");
    renderAnswer();
    renderProgress();
  }

  function renderAnswer() {
    const current = step(); const a = answer(); let control = "";
    if (current.type === "choice" || current.type === "multiChoice") control = renderOptions(current, current.type === "choice" ? a.value : a.values, current.type === "multiChoice");
    else if (current.type === "numericGroup") control = `<div class="form-grid">${current.fields.map((field) => `<label class="form-field"><span>${esc(field.label)}</span><input type="number" step="any" data-field="${attrs(field.id)}" value="${attrs(a.fields[field.id] ?? "")}"></label>`).join("")}</div>`;
    else if (current.type === "caseSet") control = renderCaseSet(current, a);
    else if (current.type === "recordSet") control = renderRecordSet(current, a);
    else if (current.type === "stateTable") control = renderStateTable(current, a);
    else if (current.type === "pairwise") control = renderPairwise(current, a);
    else if (current.type === "quiz") control = renderQuiz(current, a.fields);
    el.area.innerHTML = `<div class="task-intro"><span class="task-label">設問 ${state.activeStep + 1}</span><div><p>${esc(current.prompt)}</p>${current.hint ? `<details><summary>ヒント</summary><p>${esc(current.hint)}</p></details>` : ""}</div></div>${control}`;
  }

  function renderOptions(current, selected, multiple) {
    const values = multiple ? selected.map(Number) : [Number(selected)];
    return `<div class="choice-list">${current.options.map((option, index) => `<label class="choice-option ${values.includes(index) ? "selected" : ""}"><input type="${multiple ? "checkbox" : "radio"}" ${multiple ? "data-multi" : "data-choice"} value="${index}" ${values.includes(index) ? "checked" : ""}><span>${esc(option)}</span></label>`).join("")}</div>`;
  }

  function select(choices, value, extra = "") { return `<select ${extra}><option value="">選択</option>${choices.map((choice) => `<option value="${attrs(choice)}" ${choice === value ? "selected" : ""}>${esc(choice)}</option>`).join("")}</select>`; }
  function ensureRows(a, count, factory = () => ({})) { while (a.rows.length < count) a.rows.push(factory()); }
  function tableShell(content, label) { return `<div class="table-help"><span>各セルから該当する値を選択します</span><span>表は左右にスクロールできます</span></div><div class="training-table-wrap" role="region" aria-label="${esc(label)}（横スクロール可能）" tabindex="0">${content}</div>`; }
  function renderCaseSet(current, a) {
    ensureRows(a, current.rowCount, () => ({ input: "", outcome: "" }));
    return tableShell(`<table class="training-table"><thead><tr><th>No.</th><th>${esc(current.inputLabel)}</th><th>${esc(current.outcomeLabel)}</th></tr></thead><tbody>${a.rows.slice(0, current.rowCount).map((row, index) => `<tr><th>${index + 1}</th><td>${select(current.inputOptions, row.input, `data-row="${index}" data-cell="input"`)}</td><td>${select(current.outcomeOptions, row.outcome, `data-row="${index}" data-cell="outcome"`)}</td></tr>`).join("")}</tbody></table>`, current.label);
  }
  function renderRecordSet(current, a) {
    ensureRows(a, current.answer.length);
    return tableShell(`<table class="training-table"><thead><tr><th>No.</th>${current.columns.map((column) => `<th>${esc(column.label)}</th>`).join("")}</tr></thead><tbody>${a.rows.slice(0, current.answer.length).map((row, index) => `<tr><th>${index + 1}</th>${current.columns.map((column) => `<td>${select(column.options, row[column.id], `data-row="${index}" data-cell="${attrs(column.id)}"`)}</td>`).join("")}</tr>`).join("")}</tbody></table>`, current.label);
  }
  function renderStateTable(current, a) {
    return tableShell(`<table class="training-table state-table"><thead><tr><th>状態＼イベント</th>${current.events.map((event) => `<th>${esc(event.label)}</th>`).join("")}</tr></thead><tbody>${current.states.map((stateItem) => `<tr><th>${esc(stateItem.label)}</th>${current.events.map((event) => { const id = `${stateItem.id}:${event.id}`; const cell = current.cells[id]; const saved = a.fields[id]; return `<td><select data-state-cell="${attrs(id)}"><option value="">選択</option>${cell.options.map((option, index) => `<option value="${index}" ${saved !== "" && saved !== undefined && Number(saved) === index ? "selected" : ""}>${esc(option)}</option>`).join("")}</select></td>`; }).join("")}</tr>`).join("")}</tbody></table>`, current.label);
  }
  function renderPairwise(current, a) {
    if (!a.rows.length) ensureRows(a, current.initialRows);
    const tools = `<div class="table-tools"><span>現在 ${a.rows.length}行 ／ 目標 ${current.maxRows}行以内</span><button type="button" class="button button-ghost" data-add-row>＋ 行を追加</button></div>`;
    return tools + tableShell(`<table class="training-table"><thead><tr><th>No.</th>${current.parameters.map((parameter) => `<th>${esc(parameter.label)}</th>`).join("")}<th>操作</th></tr></thead><tbody>${a.rows.map((row, index) => `<tr><th>${index + 1}</th>${current.parameters.map((parameter) => `<td>${select(parameter.values, row[parameter.id], `data-row="${index}" data-cell="${attrs(parameter.id)}"`)}</td>`).join("")}<td><button type="button" class="delete-button" data-remove-row="${index}" aria-label="${index + 1}行目を削除">削除</button></td></tr>`).join("")}</tbody></table>`, current.label) + `<p class="table-note">行の順序は採点に影響しません。禁則を除く全ての2因子間ペアを含めてください。</p>`;
  }
  function renderQuiz(current, fields) {
    return `<div class="quiz-list">${current.questions.map((question, questionIndex) => `<fieldset class="quiz-question"><legend><span>問${questionIndex + 1}</span>${esc(question.text)}</legend><div class="quiz-options">${question.options.map((option, optionIndex) => `<label class="quiz-option ${Number(fields[question.id]) === optionIndex ? "selected" : ""}"><input type="radio" name="${attrs(question.id)}" data-quiz="${attrs(question.id)}" value="${optionIndex}" ${Number(fields[question.id]) === optionIndex ? "checked" : ""}><span>${esc(option)}</span></label>`).join("")}</div></fieldset>`).join("")}</div>`;
  }

  function renderProgress() {
    const total = exercises.reduce((sum, item) => sum + item.steps.length, 0);
    const completed = new Set(state.completed.filter((item) => exercises.some((entry) => entry.steps.some((current) => `${entry.id}:${current.id}` === item)))).size;
    const percent = Math.round((completed / total) * 100);
    el.percent.textContent = `${percent}%`;
    el.progress.textContent = completed === total ? "全課題完了" : completed ? `${completed} / ${total} ステップ完了` : "未着手";
  }

  function validate() {
    const current = step(); const a = answer(); let result;
    if (current.type === "choice") result = validator.validateChoice(current, a.value);
    else if (current.type === "multiChoice") result = validator.validateMultiChoice(current, a.values);
    else if (current.type === "numericGroup") result = validator.validateNumericGroup(current, a.fields);
    else if (current.type === "caseSet") result = validator.validateCaseSet(current, a.rows);
    else if (current.type === "recordSet") result = validator.validateRecordSet(current, a.rows);
    else if (current.type === "stateTable") result = validator.validateStateTable(current, a.fields);
    else if (current.type === "pairwise") result = validator.validatePairwise(current, a.rows);
    else result = validator.validateQuiz(current, a.fields);
    result = formatProductionFeedback(result);
    state.completed = state.completed.filter((item) => item !== key());
    if (result.pass) state.completed.push(key());
    save(); showResult(result, current); render();
  }

  function formatProductionFeedback(result) {
    if (result.pass || exercise().id !== "production") return result;
    return { ...result, issues: ["仕様と回答を見比べ、条件・値・期待結果をまとめて見直してください。本番問題では個別の正答ヒントは表示しません。"] };
  }

  function showResult(result, current) {
    const isProduction = exercise().id === "production";
    const quizAnswers = result.pass && current.type === "quiz" ? `<dl class="quiz-answer-list">${current.questions.map((question, index) => `<div><dt>問${index + 1}</dt><dd><strong>${esc(question.options[question.answer])}</strong><p>${esc(question.explanation)}</p></dd></div>`).join("")}</dl>` : "";
    const stats = (!isProduction || result.pass) && result.stats ? `<p class="result-tip">被覆：${result.stats.covered} / ${result.stats.required} ペア</p>` : "";
    const explanation = quizAnswers || ((!isProduction || result.pass) && current.explanation ? `<div class="reference-answer"><strong>解説</strong><p>${esc(current.explanation)}</p></div>` : "");
    el.result.innerHTML = `<div class="result-icon ${result.pass ? "pass" : "retry"}">${result.pass ? "✓" : "!"}</div><p class="eyebrow">${result.pass ? "回答完了" : "要確認"}</p><h2>${result.pass ? "正しくできています" : "もう一度確認しましょう"}</h2>${stats}${result.issues.length ? `<ul class="issue-list">${result.issues.map((issue) => `<li>${esc(issue)}</li>`).join("")}</ul>` : ""}${explanation}`;
    el.dialog.showModal();
  }

  el.nav.addEventListener("click", (event) => { const button = event.target.closest("[data-exercise]"); if (!button) return; const index = exercises.findIndex((entry) => entry.id === button.dataset.exercise); if (!isExerciseUnlocked(index)) return; state.activeExerciseId = button.dataset.exercise; state.activeStep = 0; save(); render(); });
  el.tabs.addEventListener("click", (event) => { const button = event.target.closest("[data-step]"); if (!button || !isStepUnlocked(Number(button.dataset.step))) return; state.activeStep = Number(button.dataset.step); save(); render(); });
  el.area.addEventListener("input", (event) => {
    const a = answer(); const target = event.target;
    if (target.matches("[data-choice]")) a.value = target.value;
    if (target.matches("[data-multi]")) a.values = [...el.area.querySelectorAll("[data-multi]:checked")].map((input) => input.value);
    if (target.dataset.field) a.fields[target.dataset.field] = target.value;
    if (target.dataset.quiz) a.fields[target.dataset.quiz] = target.value;
    if (target.dataset.stateCell) a.fields[target.dataset.stateCell] = target.value;
    if (target.dataset.row !== undefined) { a.rows[Number(target.dataset.row)] ||= {}; a.rows[Number(target.dataset.row)][target.dataset.cell] = target.value; }
    invalidateFrom(state.activeStep);
    save();
    if (target.matches("[data-choice], [data-multi], [data-quiz]")) renderAnswer();
  });
  el.area.addEventListener("click", (event) => {
    const a = answer();
    if (event.target.closest("[data-add-row]")) { a.rows.push({}); save(); renderAnswer(); }
    const remove = event.target.closest("[data-remove-row]");
    if (remove) { a.rows.splice(Number(remove.dataset.removeRow), 1); save(); renderAnswer(); }
  });
  el.reset.addEventListener("click", () => { if (!confirm("このステップの入力をリセットしますか？")) return; delete state.answers[exercise().id]?.[step().id]; state.completed = state.completed.filter((item) => item !== key()); save(); render(); });
  el.check.addEventListener("click", validate);
  $("#helpButton").addEventListener("click", () => { renderGuide(0); el.help.showModal(); });
  el.guidePrev.addEventListener("click", () => renderGuide(guideIndex - 1));
  el.guideNext.addEventListener("click", () => renderGuide(guideIndex + 1));
  el.help.querySelectorAll("[data-guide-step]").forEach((item) => item.addEventListener("click", () => renderGuide(Number(item.dataset.guideStep))));
  render();
})();
