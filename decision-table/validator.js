(() => {
  "use strict";

  const normalizeText = (value) => String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s、。，．・「」『』（）()]/g, "");

  const keyOf = (conditions) => conditions.join("");

  function deriveResult(actions) {
    const hasNA = actions.some((value) => value === "NA");
    const selected = actions.reduce((indexes, value, index) => value === "X" ? [...indexes, index] : indexes, []);
    if (hasNA && selected.length === 0) return "NA";
    if (!hasNA && selected.length === 1) return selected[0];
    return null;
  }

  function expandConditions(conditions) {
    return conditions.reduce((patterns, value) => {
      if (value === "-") return patterns.flatMap((pattern) => [`${pattern}T`, `${pattern}F`]);
      return patterns.map((pattern) => `${pattern}${value}`);
    }, [""]);
  }

  function validateFullTable(exercise, columns) {
    const issues = [];
    if (columns.length !== exercise.fullColumns.length) issues.push("列数が全組み合わせの数と一致していません。");
    const expected = new Map(exercise.fullColumns.map((column) => [keyOf(column.conditions), column.result]));
    const received = new Set();
    columns.forEach((column, columnIndex) => {
      const conditionKey = keyOf(column.conditions);
      if (column.conditions.some((value) => !["T", "F"].includes(value))) {
        issues.push(`列${columnIndex + 1}の条件をすべてT/Fで入力してください。`);
        return;
      }
      if (!expected.has(conditionKey)) {
        issues.push(`列${columnIndex + 1}の条件の組み合わせを確認してください。`);
        return;
      }
      if (received.has(conditionKey)) issues.push(`列${columnIndex + 1}は、ほかの列と同じ条件の組み合わせです。`);
      received.add(conditionKey);
      const result = deriveResult(column.actions);
      if (result !== expected.get(conditionKey)) issues.push(`列${columnIndex + 1}のアクションを確認してください。`);
    });
    expected.forEach((_, conditionKey) => {
      if (!received.has(conditionKey)) issues.push("全ての条件の組み合わせを1回ずつ入力してください。");
    });
    return { pass: issues.length === 0, issues: [...new Set(issues)] };
  }

  function validateMinimizedTable(exercise, columns) {
    const expected = new Map(exercise.fullColumns.map((column) => [keyOf(column.conditions), column.result]));
    const covered = new Map();
    const issues = [];
    const usedColumns = columns.filter((column) => column.conditions.some(Boolean) || column.actions.some(Boolean));
    const minimumColumnCount = exercise.minimizedExample.length;

    if (!usedColumns.length) return { pass: false, issues: ["最小化した列を入力してください。"] };
    if (usedColumns.length !== minimumColumnCount) {
      issues.push(`${minimumColumnCount}列までまとめてください。現在は${usedColumns.length}列です。`);
    }

    usedColumns.forEach((column, usedIndex) => {
      const columnNumber = columns.indexOf(column) + 1;
      if (column.conditions.some((value) => !["T", "F", "-"].includes(value))) {
        issues.push(`列${columnNumber}の条件をすべて入力してください。`);
        return;
      }
      const result = deriveResult(column.actions);
      if (result === null) {
        issues.push(`列${columnNumber}はXを1つ、またはN/Aを指定してください。`);
        return;
      }
      expandConditions(column.conditions).forEach((key) => {
        if (!expected.has(key)) return;
        if (covered.has(key)) issues.push(`列${columnNumber}は、ほかの列と同じ組み合わせを重複して覆っています。`);
        covered.set(key, result);
      });
      if (!column.conditions.includes("-") && usedIndex > exercise.fullColumns.length) issues.push("未使用列は空欄にしてください。");
    });

    expected.forEach((result, key) => {
      if (!covered.has(key)) issues.push("元の組み合わせに、まだ覆えていない列があります。");
      else if (covered.get(key) !== result) issues.push("まとめた列のアクションが元の表と一致していません。");
    });

    return { pass: issues.length === 0, issues: [...new Set(issues)], usedColumns: usedColumns.length };
  }

  function mergeColumns(first, second) {
    const firstResult = deriveResult(first.actions);
    const secondResult = deriveResult(second.actions);
    if (firstResult === null || secondResult === null) {
      return { ok: false, error: "2列とも、条件とアクションを完成させてください。" };
    }
    if (firstResult !== secondResult) {
      return { ok: false, error: "アクションが同じ2列を選んでください。" };
    }
    if (first.conditions.some((value) => !["T", "F", "-"].includes(value)) || second.conditions.some((value) => !["T", "F", "-"].includes(value))) {
      return { ok: false, error: "2列とも、条件をすべて入力してください。" };
    }

    const differences = first.conditions.reduce((indexes, value, index) => value === second.conditions[index] ? indexes : [...indexes, index], []);
    if (differences.length !== 1) {
      return { ok: false, error: "条件が1つだけ違う2列を選んでください。" };
    }
    const differenceIndex = differences[0];
    const pair = [first.conditions[differenceIndex], second.conditions[differenceIndex]].sort().join("");
    if (pair !== "FT") {
      return { ok: false, error: "異なる条件がTとFになっている2列を選んでください。" };
    }

    const conditions = [...first.conditions];
    conditions[differenceIndex] = "-";
    return { ok: true, column: { conditions, actions: [...first.actions] }, differenceIndex };
  }

  function matchesKeywordGroups(value, groups = []) {
    const normalized = normalizeText(value);
    return groups.every((group) => group.some((keyword) => normalized.includes(normalizeText(keyword))));
  }

  function validateFields(fields, values) {
    const issues = [];
    fields.forEach((field) => {
      const value = values[field.key];
      if (field.answer !== undefined && Number(value) !== field.answer) issues.push(`「${field.label}」を確認してください。`);
      if (field.keywordGroups && !matchesKeywordGroups(value, field.keywordGroups)) issues.push(`「${field.label}」に必要な要素が不足しています。`);
      if (field.answer === undefined && !field.keywordGroups && !String(value ?? "").trim()) issues.push(`「${field.label}」を入力してください。`);
    });
    return { pass: issues.length === 0, issues };
  }

  function validateCoverage(config, values) {
    const issues = [];
    if (Number(values.numerator) !== config.answer.numerator) issues.push("分子を確認してください。");
    if (Number(values.denominator) !== config.answer.denominator) issues.push("分母を確認してください。");
    if (Math.abs(Number(values.percent) - config.answer.percent) > 0.11) issues.push("カバレッジの割合を確認してください。");
    if (!matchesKeywordGroups(values.reason, config.reasonKeywords)) issues.push("分母をその値にする理由を、最小化前の実行可能列と結び付けてください。");
    return { pass: issues.length === 0, issues };
  }

  function validateCoverageChoice(config, value) {
    const selected = Number(value);
    if (!selected) return { pass: false, issues: ["分母を1つ選んでください。"] };
    if (selected !== config.answer) return { pass: false, issues: ["N/Aを除いた、最小化前の実行可能な組み合わせ数を選んでください。"] };
    return { pass: true, issues: [] };
  }

  function validateQuiz(config, values) {
    const issues = [];
    config.questions.forEach((question, index) => {
      const value = values[question.id];
      if (value === undefined || value === "") {
        issues.push(`問${index + 1}を選択してください。`);
      } else if (Number(value) !== question.answer) {
        issues.push(`問${index + 1}を確認してください。`);
      }
    });
    return { pass: issues.length === 0, issues };
  }

  window.DT_VALIDATOR = { deriveResult, expandConditions, validateFullTable, validateMinimizedTable, mergeColumns, validateFields, validateCoverage, validateCoverageChoice, validateQuiz, matchesKeywordGroups };
})();
