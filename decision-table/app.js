(() => {
  "use strict";

  const STORAGE_KEY = "decision-table-lab-rev3-state-v6";
  const exercises = window.DT_EXERCISES;
  const validator = window.DT_VALIDATOR;
  const cellCycles = {
    fullCondition: ["", "T", "F"],
    minimizedCondition: ["", "T", "F", "-"],
    action: ["", "X"],
    actionWithNA: ["", "X"]
  };

  const defaultState = { version: 6, activeExerciseId: exercises[0].id, activeStep: 0, answers: {}, completed: [] };
  let state = loadState();
  let guideIndex = 0;
  const guideCaptions = ["① 問題を選ぶ", "② 仕様を読む", "③ 回答を入力する", "④ 答え合わせをする", "⑤ 本番問題のみ：理解度チェック"];

  const elements = {
    courseNav: document.querySelector("#courseNav"),
    sectionNumber: document.querySelector("#sectionNumber"),
    exerciseTitle: document.querySelector("#exerciseTitle"),
    assignmentTitle: document.querySelector("#assignmentTitle"),
    assignmentJumpLabel: document.querySelector("#assignmentJumpLabel"),
    difficulty: document.querySelector("#difficulty"),
    learningGoal: document.querySelector("#learningGoal"),
    specList: document.querySelector("#specList"),
    naLegend: document.querySelector("#naLegend"),
    stepTabs: document.querySelector("#stepTabs"),
    answerArea: document.querySelector("#answerArea"),
    helpButton: document.querySelector("#helpButton"),
    helpDialog: document.querySelector("#helpDialog"),
    guideCounter: document.querySelector("#guideCounter"),
    guideCaption: document.querySelector("#guideCaption"),
    guidePrev: document.querySelector("#guidePrev"),
    guideNext: document.querySelector("#guideNext"),
    resetButton: document.querySelector("#resetButton"),
    checkButton: document.querySelector("#checkButton"),
    resultDialog: document.querySelector("#resultDialog"),
    resultContent: document.querySelector("#resultContent"),
    resultNext: document.querySelector("#resultNext"),
    saveStatus: document.querySelector("#saveStatus"),
    progressRing: document.querySelector("#progressRing"),
    progressPercent: document.querySelector("#progressPercent"),
    progressLabel: document.querySelector("#progressLabel")
  };

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || parsed.version !== 6 || !exercises.some((exercise) => exercise.id === parsed.activeExerciseId)) return structuredClone(defaultState);
      return { ...structuredClone(defaultState), ...parsed };
    } catch (_) {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    elements.saveStatus.textContent = "保存中…";
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.setTimeout(() => { elements.saveStatus.textContent = "保存済み"; }, 180);
    } catch (_) {
      elements.saveStatus.textContent = "保存できません";
    }
    updateProgress();
  }

  function renderGuide(index) {
    guideIndex = (index + guideCaptions.length) % guideCaptions.length;
    elements.helpDialog.querySelectorAll("[data-guide-scene]").forEach((scene, sceneIndex) => {
      const active = sceneIndex === guideIndex;
      scene.classList.remove("active");
      scene.hidden = !active;
      if (active) {
        void scene.offsetWidth;
        scene.classList.add("active");
      }
    });
    elements.helpDialog.querySelectorAll("[data-guide-step]").forEach((step, stepIndex) => {
      const active = stepIndex === guideIndex;
      step.closest("li").classList.toggle("active", active);
      step.setAttribute("aria-current", active ? "step" : "false");
    });
    elements.guideCounter.textContent = `${guideIndex + 1} / ${guideCaptions.length}`;
    elements.guideCaption.textContent = guideCaptions[guideIndex];
  }

  function activeExercise() {
    return exercises.find((exercise) => exercise.id === state.activeExerciseId) || exercises[0];
  }

  function activeStep() {
    return activeExercise().steps[state.activeStep] || activeExercise().steps[0];
  }

  function answerKey(exercise = activeExercise(), step = activeStep()) {
    return `${exercise.id}:${step.id}`;
  }

  function isStepUnlocked(exercise, stepIndex) {
    const prerequisitesComplete = exercise.steps.slice(0, stepIndex).every((step) => state.completed.includes(`${exercise.id}:${step.id}`));
    // 一度入力済みのステップは、前の回答を修正して未完了に戻っても再確認・修正できる。
    return prerequisitesComplete || Boolean(state.answers[exercise.id]?.[exercise.steps[stepIndex]?.id]);
  }

  function isExerciseUnlocked(exerciseIndex) {
    const prerequisitesComplete = exercises.slice(0, exerciseIndex).every((exercise) => exercise.steps.every((step) => state.completed.includes(`${exercise.id}:${step.id}`)));
    // いったん開始した問題は、前の問題を見直したあとも続きから再開できる。
    return prerequisitesComplete || Boolean(Object.keys(state.answers[exercises[exerciseIndex]?.id] || {}).length);
  }

  function invalidateFrom(exercise, stepIndex) {
    const invalidKeys = exercise.steps.slice(stepIndex).map((step) => `${exercise.id}:${step.id}`);
    state.completed = state.completed.filter((key) => !invalidKeys.includes(key));
  }

  function nextTarget(exercise, stepIndex) {
    if (stepIndex + 1 < exercise.steps.length) return { exerciseId: exercise.id, stepIndex: stepIndex + 1, label: "次のステップへ" };
    const exerciseIndex = exercises.findIndex((item) => item.id === exercise.id);
    if (exerciseIndex + 1 < exercises.length) return { exerciseId: exercises[exerciseIndex + 1].id, stepIndex: 0, label: "次の問題へ" };
    return null;
  }

  function blankColumn(exercise) {
    return {
      conditions: Array(exercise.conditions.length).fill(""),
      actions: Array(exercise.actions.length).fill("")
    };
  }

  function getAnswer(exercise = activeExercise(), step = activeStep()) {
    state.answers[exercise.id] ||= {};
    const answers = state.answers[exercise.id];
    if (!answers[step.id]) {
      if (["table", "minimized"].includes(step.type)) {
        const initialColumnCount = step.type === "minimized" ? 1 : step.columns;
        answers[step.id] = {
          columns: Array.from({ length: initialColumnCount }, () => blankColumn(exercise)),
          fields: {},
          selectedColumns: []
        };
      } else {
        answers[step.id] = { fields: {}, counts: {} };
      }
    }
    return answers[step.id];
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
  }

  function renderNavigation() {
    elements.courseNav.innerHTML = exercises.map((exercise, exerciseIndex) => {
      const exerciseSteps = exercise.steps.map((step) => `${exercise.id}:${step.id}`);
      const completeCount = exerciseSteps.filter((key) => state.completed.includes(key)).length;
      const isComplete = completeCount === exercise.steps.length;
      const unlocked = isExerciseUnlocked(exerciseIndex);
      return `
        <button class="course-button ${exercise.id === state.activeExerciseId ? "active" : ""} ${unlocked ? "" : "locked"}" type="button" data-exercise="${exercise.id}" ${unlocked ? "" : "disabled title=\"前の問題を完了すると開始できます\""}>
          <span class="course-index">${exercise.number}</span>
          <span class="course-copy"><strong>${exercise.navLabel}</strong><small><span>${exercise.navTitle}</span><b>${completeCount} / ${exercise.steps.length} ステップ</b></small></span>
          <span class="course-state ${isComplete ? "complete" : ""}" aria-label="${isComplete ? "完了" : "未完了"}"></span>
        </button>`;
    }).join("");
  }

  function renderExercise() {
    const exercise = activeExercise();
    if (state.activeStep >= exercise.steps.length) state.activeStep = 0;
    const step = activeStep();
    elements.sectionNumber.textContent = exercise.section;
    elements.exerciseTitle.textContent = exercise.title;
    const assignmentLabel = exercise.id === "production" ? "本番問題" : "練習問題";
    elements.assignmentTitle.textContent = assignmentLabel;
    elements.assignmentJumpLabel.textContent = assignmentLabel;
    elements.difficulty.textContent = exercise.difficulty;
    elements.learningGoal.textContent = exercise.goal;
    elements.specList.innerHTML = exercise.specs.map((spec) => `<li>${escapeHtml(spec)}</li>`).join("");
    elements.naLegend.hidden = !exercise.fullColumns.some((column) => column.result === "NA");
    elements.stepTabs.innerHTML = exercise.steps.map((item, index) => {
      const complete = state.completed.includes(`${exercise.id}:${item.id}`);
      const unlocked = isStepUnlocked(exercise, index);
      return `<button class="step-tab ${complete ? "complete" : ""} ${unlocked ? "" : "locked"}" type="button" role="tab" aria-selected="${index === state.activeStep}" data-step="${index}" ${unlocked ? "" : "disabled title=\"前のステップを完了すると開始できます\""}>${complete ? "✓" : index + 1 + "."} ${item.label}</button>`;
    }).join("");
    renderAnswerArea(step, exercise);
    renderNavigation();
    updateProgress();
  }

  function renderAnswerArea(step, exercise) {
    const answer = getAnswer(exercise, step);
    const introduction = `<div class="task-intro"><span class="task-label">設問 ${state.activeStep + 1}</span><p>${escapeHtml(step.prompt)}</p></div>`;
    if (step.type === "formula" || step.type === "writing") {
      const formulaGuide = step.type === "formula" ? renderFormulaGuide(answer.fields) : "";
      elements.answerArea.innerHTML = introduction + renderFields(step.fields, answer.fields) + formulaGuide;
    } else if (step.type === "table" || step.type === "minimized") {
      const preface = step.preface ? `<div class="inline-fields">${renderFields(step.preface.fields, answer.fields)}</div>` : "";
      const minimizedGuide = step.type === "minimized" ? renderMinimizedGuide(exercise) : "";
      const minimizedControls = step.type === "minimized" ? renderMinimizedControls(exercise, step, answer.columns) : "";
      elements.answerArea.innerHTML = introduction + preface + minimizedGuide + renderDecisionTable(exercise, step, answer.columns, answer.selectedColumns || []) + minimizedControls;
    } else if (step.type === "ruleCount") {
      elements.answerArea.innerHTML = introduction + renderRuleCount(exercise, answer);
    } else if (step.type === "coverage") {
      elements.answerArea.innerHTML = introduction + renderCoverage(step, answer.fields);
    } else if (step.type === "coverageChoice") {
      elements.answerArea.innerHTML = introduction + renderCoverageChoice(step, answer.fields);
    } else if (step.type === "quiz") {
      elements.answerArea.innerHTML = introduction + renderQuiz(step, answer.fields);
    } else if (step.type === "reflection") {
      elements.answerArea.innerHTML = introduction + renderCoverage(step.coverage, answer.fields, "coverage-") + renderFields(step.fields, answer.fields);
    }
  }

  function renderFields(fields, values) {
    return `<div class="form-grid">${fields.map((field) => {
      const value = escapeHtml(values[field.key] ?? "");
      const common = `data-field="${field.key}" placeholder="${escapeHtml(field.placeholder || "")}"`;
      return `<label class="form-field ${field.multiline ? "wide" : ""}"><span>${escapeHtml(field.label)}</span>${
        field.multiline
          ? `<textarea rows="5" ${common}>${value}</textarea>`
          : `<input type="text" inputmode="${field.inputMode || "text"}" value="${value}" ${common} />`
      }</label>`;
    }).join("")}</div>`;
  }

  function renderFormulaGuide(values) {
    const conditionCount = Number(values.conditions);
    const isUsableCount = Number.isInteger(conditionCount) && conditionCount > 0 && conditionCount <= 10;
    const expression = isUsableCount
      ? `${Array(conditionCount).fill("2").join(" × ")} ＝ ${2 ** conditionCount}`
      : "条件の数を入力すると、掛け算を自動表示します";
    return `<div class="formula-guide"><span>組み合わせ数の計算</span><strong id="formulaExpression">${expression}</strong><p>各条件には T / F の2通りがあります。</p></div>`;
  }

  function renderDecisionTable(exercise, step, columns, selectedColumns = []) {
    const isMinimized = step.type === "minimized";
    const hasNA = exercise.fullColumns.some((column) => column.result === "NA");
    const header = columns.map((_, index) => {
      const isSelected = selectedColumns.includes(index);
      const isNA = columns[index].actions.some((action) => action === "NA");
      return `<th scope="col" class="${isSelected ? "column-is-selected" : ""} ${isNA ? "column-is-na" : ""} ${isMinimized && hasNA ? "minimized-column-with-na" : ""}"><span>${index + 1}</span>${hasNA ? `<button class="column-na ${isNA ? "selected" : ""}" type="button" data-mark-na="${index}" aria-pressed="${isNA}" aria-label="列${index + 1}を実行不可能にする">N/A</button>` : ""}${isMinimized ? `
        <button class="column-select ${isSelected ? "selected" : ""}" type="button" data-select-column="${index}" aria-pressed="${isSelected}" aria-label="列${index + 1}を統合対象として選択">${isSelected ? "✓" : "○"}</button>
        <button class="column-delete" type="button" data-delete-column="${index}" aria-label="列${index + 1}を削除">×</button>` : ""}</th>`;
    }).join("");
    const columnSizes = `<colgroup><col class="label-column" />${columns.map(() => '<col class="data-column" />').join("")}</colgroup>`;
    const conditionRows = exercise.conditions.map((label, rowIndex) => `
      <tr><th scope="row"><small>条件</small>${escapeHtml(label)}</th>${columns.map((column, columnIndex) => renderCell(column.conditions[rowIndex], "condition", rowIndex, columnIndex, isMinimized)).join("")}</tr>`).join("");
    const actionRows = exercise.actions.map((label, rowIndex) => `
      <tr class="action-row"><th scope="row"><small>アクション</small>${escapeHtml(label)}</th>${columns.map((column, columnIndex) => renderCell(column.actions[rowIndex], "action", rowIndex, columnIndex, isMinimized)).join("")}</tr>`).join("");
    const scrollHint = columns.length > 8 ? " ／ 表は左右にスクロールできます" : "";
    const actionHint = hasNA ? "アクションはX ／ 実行不可能は列上部のN/A" : "アクションはX";
    return `<div class="table-help"><span>セルをクリックして入力を切り替えます</span><span>${isMinimized ? "T → F → −" : "T → F"} ／ ${actionHint}${scrollHint}</span></div>
      <div class="decision-table-wrap" role="region" aria-label="デシジョンテーブル（横スクロール可能）" tabindex="0"><table class="decision-table" style="--table-min-width:${210 + columns.length * 56}px;--table-mobile-min-width:${150 + columns.length * 52}px">${columnSizes}<thead><tr><th scope="col">項目</th>${header}</tr></thead><tbody>${conditionRows}${actionRows}</tbody></table></div>`;
  }

  function renderMinimizedGuide(exercise) {
    const hasNA = exercise.fullColumns.some((column) => column.result === "NA");
    return `<div class="minimized-guide">
      <strong>最小化の進め方</strong>
      <ol>
        <li>「全組み合わせからコピー」で、前のタブの表を持ってきます。</li>
        <li>同じアクションで、条件が1つだけT/Fで違う2列を「○」で選びます。</li>
        <li>「選択した2列をまとめる」を押すと、違う条件が「−」になり1列へまとまります。</li>
      </ol>
      <div class="merge-example">
        <strong>Aだけが違っても、どちらも同じ「X」になる場合の例です。</strong>
        <div><code>列1：A=T / B=T → X</code><b>＋</b><code>列2：A=F / B=T → X</code><b>＝</b><code>A=− / B=T → X</code></div>
        <p>つまり、AがTでもFでも結果は変わらないため、Aは「−」（どちらでもよい）にできます。Bは両方ともTなので、そのまま残します。</p>
      </div>
      <p>${hasNA ? "N/Aは、実行不可能な組み合わせをまとめるときに使います。" : "この問題に実行不可能な組み合わせはないため、N/Aは使いません。"}</p>
    </div>`;
  }

  function renderMinimizedControls(exercise, step, columns) {
    const canCopy = state.completed.includes(`${exercise.id}:full`);
    const answer = getAnswer(exercise, step);
    const selectedCount = (answer.selectedColumns || []).length;
    return `<div class="column-controls">
      <button class="button button-ghost" type="button" data-min-action="copy" ${canCopy ? "" : "disabled"}>全組み合わせからコピー</button>
      <button class="button button-merge" type="button" data-min-action="merge" ${selectedCount === 2 ? "" : "disabled"}>選択した2列をまとめる</button>
      <button class="button button-ghost" type="button" data-min-action="undo" ${(answer.history || []).length ? "" : "disabled"}>直前の統合を戻す</button>
      <button class="button button-ghost" type="button" data-min-action="add" ${columns.length >= step.columns ? "disabled" : ""}>＋ 列を追加</button>
      <span>${selectedCount}列選択中 ／ 現在${columns.length}列</span>
      ${canCopy ? "" : "<small>先に「全組み合わせ」で正解するとコピーできます。</small>"}
      ${answer.mergeMessage ? `<small class="merge-message" role="alert">${escapeHtml(answer.mergeMessage)}</small>` : ""}
    </div>`;
  }

  function renderCell(value, kind, row, column, isMinimized) {
    const label = value === "NA" ? "N/A" : value || "・";
    const className = value === "-" ? "dash" : value === "NA" ? "na" : value === "T" ? "true" : value === "F" ? "false" : value === "X" ? "selected" : "empty";
    const rowLabel = kind === "condition" ? activeExercise().conditions[row] : activeExercise().actions[row];
    return `<td><button class="table-cell ${className}" type="button" aria-label="列${column + 1} ${escapeHtml(rowLabel)}：${label}" data-cell-kind="${kind}" data-row="${row}" data-column="${column}" data-minimized="${isMinimized}">${label}</button></td>`;
  }

  function minimizedAnswer(exercise) {
    return state.answers[exercise.id]?.min;
  }

  function usedMinimizedColumns(exercise) {
    const answer = minimizedAnswer(exercise);
    if (!answer) return [];
    return answer.columns.map((column, index) => ({ ...column, index })).filter((column) => column.conditions.some(Boolean) || column.actions.some(Boolean));
  }

  function renderRuleCount(exercise, answer) {
    const columns = usedMinimizedColumns(exercise);
    if (!columns.length) return `<div class="empty-note"><strong>先に最小化表を作成してください</strong><p>入力した「−」の数を使って検算します。</p><button class="button button-ghost" type="button" data-go-step="min">最小化へ移動</button></div>`;
    const cards = columns.map((column) => {
      const dashCount = column.conditions.filter((value) => value === "-").length;
      return `<label class="count-card"><span>列 ${column.index + 1}</span><strong>「−」 ${dashCount}個</strong><span>2<sup>${dashCount}</sup> ＝</span><input type="number" min="1" data-count="${column.index}" value="${escapeHtml(answer.counts[column.index] ?? "")}" aria-label="列${column.index + 1}のルールカウント" /></label>`;
    }).join("");
    const total = Object.values(answer.counts).reduce((sum, value) => sum + (Number(value) || 0), 0);
    return `<div class="count-grid">${cards}</div><div class="count-total"><span>入力した合計</span><strong>${total}</strong><span>2<sup>${exercise.conditions.length}</sup> ＝ ${2 ** exercise.conditions.length} と一致するか確認</span></div>`;
  }

  function renderCoverage(config, values, prefix = "") {
    return `<div class="coverage-card">
      <div class="coverage-formula">
        <label><span>実施する列</span><input type="number" min="0" data-field="${prefix}numerator" value="${escapeHtml(values[`${prefix}numerator`] ?? "")}" /></label><b>÷</b>
        <label><span>実行可能列</span><input type="number" min="1" data-field="${prefix}denominator" value="${escapeHtml(values[`${prefix}denominator`] ?? "")}" /></label><b>＝</b>
        <label><span>カバレッジ</span><span class="percent-input"><input type="number" min="0" max="100" step="0.1" data-field="${prefix}percent" value="${escapeHtml(values[`${prefix}percent`] ?? "")}" />%</span></label>
      </div>
      <label class="form-field wide"><span>分母をその値にする理由</span><textarea rows="4" data-field="${prefix}reason" placeholder="最小化との関係も含めて説明">${escapeHtml(values[`${prefix}reason`] ?? "")}</textarea></label>
    </div>`;
  }

  function renderCoverageChoice(step, values) {
    const selected = Number(values.denominator) || 0;
    const calculatedPercent = selected ? Math.round((step.numerator / selected) * 1000) / 10 : null;
    return `<div class="coverage-breakdown">
      <div class="coverage-equation"><span><small>全組み合わせ</small><strong>${step.total}</strong></span><b>−</b><span><small>N/A</small><strong>${step.naBefore}</strong></span><b>＝</b><span class="emphasis"><small>実行可能</small><strong>${step.feasible}</strong></span></div>
      <div class="coverage-equation"><span><small>最小化後</small><strong>${step.minimized}</strong></span><b>−</b><span><small>N/A</small><strong>${step.naAfter}</strong></span><b>＝</b><span class="emphasis"><small>実施する列</small><strong>${step.numerator}</strong></span></div>
    </div>
    <fieldset class="coverage-options"><legend>カバレッジの分母はどれですか？</legend>${step.options.map((option) => `
      <label class="coverage-option ${selected === option.value ? "selected" : ""}"><input type="radio" name="coverage-denominator" data-field="denominator" value="${option.value}" ${selected === option.value ? "checked" : ""} /><span><strong>${option.value}：${escapeHtml(option.label)}</strong><small>${escapeHtml(option.note)}</small></span></label>
    `).join("")}</fieldset>
    <div class="coverage-result ${selected ? "visible" : ""}"><span>選んだ分母で計算</span><strong>${selected ? `${step.numerator} ÷ ${selected} ＝ ${calculatedPercent}%` : "分母を選ぶと式を表示します"}</strong></div>`;
  }

  function renderQuiz(step, values) {
    const notificationField = step.notification ? `<label class="notification-name form-field"><span>受講者名（リーダー通知に表示）</span><input type="text" data-field="learnerName" value="${escapeHtml(values.learnerName ?? "")}" placeholder="例：山田 太郎" autocomplete="name" /></label>` : "";
    return `${notificationField}<div class="quiz-list">${step.questions.map((question, questionIndex) => {
      const selected = Number(values[question.id]);
      return `<fieldset class="quiz-question"><legend><span>問${questionIndex + 1}</span>${escapeHtml(question.text)}</legend><div class="quiz-options">${question.options.map((option, optionIndex) => `
        <label class="quiz-option ${selected === optionIndex ? "selected" : ""}"><input type="radio" name="${question.id}" data-field="${question.id}" value="${optionIndex}" ${selected === optionIndex ? "checked" : ""} /><span>${escapeHtml(option)}</span></label>
      `).join("")}</div></fieldset>`;
    }).join("")}</div>`;
  }

  function createAttemptId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `dt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function sendCompletionNotification(step, answer) {
    if (!step.notification || answer.fields.notificationSent) return;
    answer.fields.notificationAttemptId ||= createAttemptId();
    const status = elements.resultContent.querySelector("#notificationStatus");
    if (status) status.textContent = "リーダーへ完了通知を送信しています…";
    try {
      await fetch(step.notification.url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({
          source: step.notification.source,
          event: step.notification.event,
          name: answer.fields.learnerName.trim(),
          attemptId: answer.fields.notificationAttemptId,
          correct: step.questions.length
        })
      });
      answer.fields.notificationSent = true;
      saveState();
      if (status) status.textContent = "リーダーへの完了通知を送信しました。Slack側で受信を確認してください。";
    } catch (_) {
      if (status) status.textContent = "通知を送信できませんでした。完了画面をリーダーへ提示してください。";
    }
  }

  function handleCellClick(button) {
    const answer = getAnswer();
    const column = answer.columns[Number(button.dataset.column)];
    const row = Number(button.dataset.row);
    const kind = button.dataset.cellKind;
    const values = kind === "condition" ? column.conditions : column.actions;
    if (kind === "action" && column.actions.some((value) => value === "NA")) values.fill("");
    const cycle = kind === "condition"
      ? (button.dataset.minimized === "true" ? cellCycles.minimizedCondition : cellCycles.fullCondition)
      : (activeExercise().fullColumns.some((column) => column.result === "NA") ? cellCycles.actionWithNA : cellCycles.action);
    values[row] = cycle[(cycle.indexOf(values[row]) + 1) % cycle.length];
    invalidateFrom(activeExercise(), state.activeStep);
    saveState();
    renderAnswerArea(activeStep(), activeExercise());
  }

  function markColumnAsNA(columnIndex) {
    const answer = getAnswer();
    const column = answer.columns[columnIndex];
    const isNA = column.actions.some((value) => value === "NA");
    column.actions.fill("");
    if (!isNA) column.actions[0] = "NA";
    invalidateFrom(activeExercise(), state.activeStep);
    saveState();
    renderAnswerArea(activeStep(), activeExercise());
  }

  function invalidateMinimizedProgress(exercise) {
    invalidateFrom(exercise, exercise.steps.findIndex((step) => step.id === "min"));
    if (state.answers[exercise.id]) delete state.answers[exercise.id].count;
  }

  function handleMinimizedAction(action, columnIndex) {
    const exercise = activeExercise();
    const step = activeStep();
    const answer = getAnswer();
    if (step.type !== "minimized") return;

    if (action === "undo") {
      const previous = answer.history?.pop();
      if (!previous) return;
      answer.columns = previous.columns;
      answer.selectedColumns = previous.selectedColumns;
      answer.mergeMessage = "直前の操作に戻しました。";
      invalidateMinimizedProgress(exercise);
      saveState();
      renderAnswerArea(step, exercise);
      return;
    }

    if (action === "copy") {
      if (!state.completed.includes(`${exercise.id}:full`)) return;
      const hasInput = answer.columns.some((column) => column.conditions.some(Boolean) || column.actions.some(Boolean));
      if (hasInput && !window.confirm("現在の最小化表を、全組み合わせ表で置き換えますか？")) return;
      answer.history = [];
      answer.columns = structuredClone(state.answers[exercise.id].full.columns);
      answer.selectedColumns = [];
      answer.mergeMessage = "コピーしました。まとめたい2列の○を押してください。";
    } else if (action === "add") {
      if (answer.columns.length >= step.columns) return;
      answer.history ||= [];
      answer.history.push(structuredClone({ columns: answer.columns, selectedColumns: answer.selectedColumns || [] }));
      answer.columns.push(blankColumn(exercise));
      answer.mergeMessage = "";
    } else if (action === "select") {
      answer.selectedColumns ||= [];
      if (answer.selectedColumns.includes(columnIndex)) {
        answer.selectedColumns = answer.selectedColumns.filter((index) => index !== columnIndex);
      } else {
        answer.selectedColumns = [...answer.selectedColumns.slice(-1), columnIndex];
      }
      answer.mergeMessage = "";
      // ○の選択は統合候補を示すだけで、表そのものは変えていない。
      // 完了状態を解除せず、選択表示だけ更新する。
      saveState();
      renderAnswerArea(step, exercise);
      return;
    } else if (action === "merge") {
      if ((answer.selectedColumns || []).length !== 2) return;
      const [firstIndex, secondIndex] = [...answer.selectedColumns].sort((a, b) => a - b);
      const mergeResult = validator.mergeColumns(answer.columns[firstIndex], answer.columns[secondIndex]);
      if (!mergeResult.ok) {
        answer.mergeMessage = mergeResult.error;
        saveState();
        renderAnswerArea(step, exercise);
        return;
      }
      answer.history ||= [];
      answer.history.push(structuredClone({ columns: answer.columns, selectedColumns: answer.selectedColumns || [] }));
      answer.columns[firstIndex] = mergeResult.column;
      answer.columns.splice(secondIndex, 1);
      answer.selectedColumns = [];
      answer.mergeMessage = `2列をまとめました。条件「${exercise.conditions[mergeResult.differenceIndex]}」を「−」にしています。`;
    } else if (action === "delete") {
      answer.history ||= [];
      answer.history.push(structuredClone({ columns: answer.columns, selectedColumns: answer.selectedColumns || [] }));
      if (answer.columns.length === 1) {
        answer.columns[0] = blankColumn(exercise);
      } else {
        answer.columns.splice(columnIndex, 1);
      }
      answer.selectedColumns = [];
      answer.mergeMessage = "";
    }

    invalidateMinimizedProgress(exercise);
    saveState();
    renderAnswerArea(step, exercise);
  }

  function validateCurrentStep() {
    const exercise = activeExercise();
    const step = activeStep();
    const answer = getAnswer();
    let result;
    if (step.type === "table") {
      result = validator.validateFullTable(exercise, answer.columns);
      if (step.preface) {
        const prefaceResult = validator.validateFields(step.preface.fields, answer.fields);
        result = { pass: result.pass && prefaceResult.pass, issues: [...prefaceResult.issues, ...result.issues] };
      }
    } else if (step.type === "minimized") {
      result = validator.validateMinimizedTable(exercise, answer.columns);
    } else if (step.type === "formula" || step.type === "writing") {
      result = validator.validateFields(step.fields, answer.fields);
    } else if (step.type === "coverage") {
      result = validator.validateCoverage(step, answer.fields);
    } else if (step.type === "coverageChoice") {
      result = validator.validateCoverageChoice(step, answer.fields.denominator);
    } else if (step.type === "quiz") {
      result = validator.validateQuiz(step, answer.fields);
      if (step.notification && !String(answer.fields.learnerName || "").trim()) {
        result = { pass: false, issues: [...result.issues, "リーダー通知に表示する受講者名を入力してください。"] };
      }
    } else if (step.type === "ruleCount") {
      const columns = usedMinimizedColumns(exercise);
      const issues = [];
      if (!columns.length) issues.push("先に最小化表を入力してください。");
      columns.forEach((column) => {
        const expected = 2 ** column.conditions.filter((value) => value === "-").length;
        if (Number(answer.counts[column.index]) !== expected) issues.push(`列${column.index + 1}のルールカウントを確認してください。`);
      });
      const total = columns.reduce((sum, column) => sum + (Number(answer.counts[column.index]) || 0), 0);
      if (total !== 2 ** exercise.conditions.length) issues.push(`合計を${2 ** exercise.conditions.length}にしてください。`);
      result = { pass: issues.length === 0, issues };
    } else if (step.type === "reflection") {
      const coverageValues = {
        numerator: answer.fields["coverage-numerator"], denominator: answer.fields["coverage-denominator"],
        percent: answer.fields["coverage-percent"], reason: answer.fields["coverage-reason"]
      };
      const coverageResult = validator.validateCoverage(step.coverage, coverageValues);
      const writingResult = validator.validateFields(step.fields, answer.fields);
      result = { pass: coverageResult.pass && writingResult.pass, issues: [...coverageResult.issues, ...writingResult.issues] };
    }
    showResult(formatProductionFeedback(exercise, step, result), step, exercise);
  }

  function formatProductionFeedback(exercise, step, result) {
    if (result.pass || exercise.id !== "production") return result;
    if (!["table", "minimized"].includes(step.type)) {
      return { ...result, issues: ["仕様と自分の入力を見比べて、計算の基準・選択した値・期待結果を見直してください。本番問題では正解に直結する説明は表示しません。"] };
    }
    const detailedIssues = result.issues.join("\n");
    const issues = [];
    if (/条件をすべて|条件の組み合わせ|同じ条件の組み合わせ|全ての条件の組み合わせ/.test(detailedIssues)) {
      issues.push(step.type === "table"
        ? "全16通りの条件の組み合わせを、重複・漏れなく1列ずつ作れているか確認してください。"
        : "条件を「−」にした列を含め、全16通りを重複・漏れなく覆えているか確認してください。");
    }
    if (/アクション|Xを1つ|N\/A/.test(detailedIssues)) {
      issues.push("各条件の組み合わせに対する結果を、仕様の権限ルールと照らして見直してください。");
    }
    if (!issues.length) issues.push("仕様と表を見比べ、条件・結果・列数を見直してください。");
    return { ...result, issues };
  }

  function renderMinimizedReference(exercise) {
    const rows = exercise.minimizedExample.map((column, index) => {
      const conditions = column.conditions.map((value, conditionIndex) => `${escapeHtml(exercise.conditions[conditionIndex])}：${value}`).join("<br>");
      const outcome = column.result === "NA" ? "実行不可能（N/A）" : escapeHtml(exercise.actions[column.result]);
      return `<tr><th scope="row">${index + 1}</th><td>${conditions}</td><td>${outcome}</td></tr>`;
    }).join("");
    return `<div class="reference-answer minimized-reference"><strong>最小化の解答例（列順は任意）</strong>
      <p>下の6列は解答の一例です。条件が「−」の箇所は、TでもFでも結果が変わらないことを表します。</p>
      <div class="reference-table-wrap"><table class="reference-table"><thead><tr><th>列</th><th>条件</th><th>結果</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p>自動検算では、この6列を全16通りへ展開し、各組み合わせの結果が仕様どおりかを確認しています。</p>
    </div>`;
  }

  function showResult(result, step, exercise) {
    const key = answerKey(exercise, step);
    if (result.pass && !state.completed.includes(key)) state.completed.push(key);
    if (!result.pass) state.completed = state.completed.filter((item) => item !== key);
    saveState();
    const reference = step.reference || (step.type === "minimized" ? "「−」を含む各列をT/Fへ展開したとき、全16通りそれぞれに結果が1つだけ対応するかを確認します。" : "");
    const fieldAnswers = (step.fields || []).filter((field) => field.answerDisplay).map((field) => `
      <div><dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(field.answerDisplay)}</dd></div>
    `).join("");
    const quizAnswers = result.pass && step.type === "quiz" ? step.questions.map((question, index) => `
      <div><dt>問${index + 1}</dt><dd><strong>${escapeHtml(question.options[question.answer])}</strong><p>${escapeHtml(question.explanation)}</p></dd></div>
    `).join("") : "";
    const minimizedReference = result.pass && step.type === "minimized" ? renderMinimizedReference(exercise) : "";
    const answerBlock = quizAnswers
      ? `<div class="reference-answer"><strong>理解度チェックの解答</strong><dl class="quiz-answer-list">${quizAnswers}</dl></div>`
      : fieldAnswers
      ? `<div class="reference-answer"><strong>入力欄ごとの解答</strong><dl class="answer-list">${fieldAnswers}</dl></div>`
      : minimizedReference
      ? minimizedReference
      : (!result.pass && exercise.id === "production"
        ? ""
        : (reference ? `<div class="reference-answer"><strong>解答例・解説</strong><p>${escapeHtml(reference)}</p></div>` : ""));
    elements.resultContent.innerHTML = `
      <div class="result-icon ${result.pass ? "pass" : "retry"}">${result.pass ? "✓" : "!"}</div>
      <p class="eyebrow">${result.pass ? "回答完了" : "要確認"}</p>
      <h2>${result.pass ? "正しくできています" : "もう一度確認しましょう"}</h2>
      ${result.issues.length ? `<ul class="issue-list">${result.issues.slice(0, 8).map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>` : ""}
      ${answerBlock}
      ${!result.pass && step.type === "quiz" ? "<p class=\"result-tip\">正しい選択肢と解説は、全問正解したあとに表示されます。まずは問題文とヒントを見直してください。</p>" : ""}
      ${result.pass && step.notification ? "<p class=\"result-tip notification-status\" id=\"notificationStatus\">リーダーへの完了通知を準備しています…</p>" : ""}
      ${result.pass && exercise.explanations ? `<p class="result-tip">${escapeHtml(exercise.explanations[Math.min(state.activeStep, exercise.explanations.length - 1)])}</p>` : ""}`;
    const next = result.pass ? nextTarget(exercise, state.activeStep) : null;
    elements.resultNext.hidden = !next;
    if (next) elements.resultNext.textContent = next.label;
    elements.resultDialog.showModal();
    if (result.pass && step.notification) sendCompletionNotification(step, getAnswer(exercise, step));
    renderExercise();
  }

  function updateProgress() {
    const allKeys = exercises.flatMap((exercise) => exercise.steps.map((step) => `${exercise.id}:${step.id}`));
    const completed = allKeys.filter((key) => state.completed.includes(key)).length;
    const percent = Math.round((completed / allKeys.length) * 100);
    elements.progressPercent.textContent = `${percent}%`;
    elements.progressRing.style.setProperty("--progress", `${percent * 3.6}deg`);
    elements.progressLabel.textContent = percent === 100 ? "全課題完了" : completed ? `${completed} / ${allKeys.length} 完了` : "未着手";
  }

  elements.courseNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-exercise]");
    if (!button) return;
    const exerciseIndex = exercises.findIndex((exercise) => exercise.id === button.dataset.exercise);
    if (!isExerciseUnlocked(exerciseIndex)) return;
    state.activeExerciseId = button.dataset.exercise;
    state.activeStep = 0;
    saveState();
    renderExercise();
    document.querySelector("#specification").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  elements.stepTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-step]");
    if (!button) return;
    const stepIndex = Number(button.dataset.step);
    if (!isStepUnlocked(activeExercise(), stepIndex)) return;
    state.activeStep = stepIndex;
    saveState();
    renderExercise();
  });

  elements.answerArea.addEventListener("click", (event) => {
    const markNA = event.target.closest("[data-mark-na]");
    if (markNA) {
      markColumnAsNA(Number(markNA.dataset.markNa));
      return;
    }
    const selectColumn = event.target.closest("[data-select-column]");
    if (selectColumn) {
      handleMinimizedAction("select", Number(selectColumn.dataset.selectColumn));
      return;
    }
    const deleteColumn = event.target.closest("[data-delete-column]");
    if (deleteColumn) {
      handleMinimizedAction("delete", Number(deleteColumn.dataset.deleteColumn));
      return;
    }
    const minimizedAction = event.target.closest("[data-min-action]");
    if (minimizedAction) {
      handleMinimizedAction(minimizedAction.dataset.minAction);
      return;
    }
    const cell = event.target.closest("[data-cell-kind]");
    if (cell) handleCellClick(cell);
    const jump = event.target.closest("[data-go-step]");
    if (jump) {
      const stepIndex = activeExercise().steps.findIndex((step) => step.id === jump.dataset.goStep);
      if (!isStepUnlocked(activeExercise(), stepIndex)) return;
      state.activeStep = stepIndex;
      saveState();
      renderExercise();
    }
  });

  elements.answerArea.addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    const count = event.target.dataset.count;
    const answer = getAnswer();
    if (field) answer.fields[field] = event.target.value;
    if (count !== undefined) answer.counts[count] = event.target.value;
    if (field || count !== undefined) invalidateFrom(activeExercise(), state.activeStep);
    saveState();
    if (field === "conditions" && activeStep().type === "formula") {
      const nextGuide = document.createElement("div");
      nextGuide.innerHTML = renderFormulaGuide(answer.fields);
      const expression = elements.answerArea.querySelector("#formulaExpression");
      const nextExpression = nextGuide.querySelector("#formulaExpression");
      if (expression && nextExpression) expression.textContent = nextExpression.textContent;
    }
    if (field === "denominator" && activeStep().type === "coverageChoice") {
      renderAnswerArea(activeStep(), activeExercise());
    }
    // 名前の入力中に全設問を再描画すると、1文字ごとにフォーカスが外れてしまう。
    // 再描画が必要なのは、選択状態の見た目を更新するラジオボタンだけ。
    if (field && activeStep().type === "quiz" && event.target.type === "radio") {
      renderAnswerArea(activeStep(), activeExercise());
    }
    if (count !== undefined) {
      const total = Object.values(answer.counts).reduce((sum, value) => sum + (Number(value) || 0), 0);
      const totalElement = elements.answerArea.querySelector(".count-total strong");
      if (totalElement) totalElement.textContent = total;
    }
  });

  elements.resetButton.addEventListener("click", () => {
    if (!window.confirm("このステップの入力内容をリセットしますか？")) return;
    const exercise = activeExercise();
    const step = activeStep();
    delete state.answers[exercise.id]?.[step.id];
    invalidateFrom(exercise, state.activeStep);
    saveState();
    renderExercise();
  });

  elements.checkButton.addEventListener("click", validateCurrentStep);
  elements.resultNext.addEventListener("click", () => {
    const target = nextTarget(activeExercise(), state.activeStep);
    if (!target) return;
    state.activeExerciseId = target.exerciseId;
    state.activeStep = target.stepIndex;
    saveState();
    elements.resultDialog.close();
    renderExercise();
    document.querySelector("#assignment").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  elements.helpButton.addEventListener("click", () => {
    renderGuide(0);
    elements.helpDialog.showModal();
  });
  elements.guidePrev.addEventListener("click", () => renderGuide(guideIndex - 1));
  elements.guideNext.addEventListener("click", () => renderGuide(guideIndex + 1));
  elements.helpDialog.querySelectorAll("[data-guide-step]").forEach((step) => {
    step.addEventListener("click", () => renderGuide(Number(step.dataset.guideStep)));
  });
  renderExercise();
})();
