(() => {
  "use strict";

  const binaryColumns = (conditionCount) => Array.from({ length: 2 ** conditionCount }, (_, columnIndex) =>
    Array.from({ length: conditionCount }, (_, conditionIndex) => {
      const blockSize = 2 ** (conditionCount - conditionIndex - 1);
      return Math.floor(columnIndex / blockSize) % 2 === 0 ? "T" : "F";
    })
  );

  const makeFullColumns = (conditionCount, results) => binaryColumns(conditionCount).map((conditions, index) => ({
    conditions,
    result: results[index]
  }));

  window.DT_EXERCISES = [
    {
      id: "practice-1",
      number: "01",
      section: "練習問題 01",
      navLabel: "練習問題①",
      navTitle: "表の作成と最小化",
      title: "市民プール 利用料金",
      difficulty: "基礎",
      goal: "条件の数から完全な組み合わせを作り、結果に無関係な条件を「−」にまとめる基本を身につけます。",
      specs: [
        "市民プール 利用料金シミュレータ",
        "基本利用料は800円とする。",
        "市内在住である場合は300円引き（500円）。",
        "回数券を利用する場合は200円引き（600円）。",
        "65歳以上である場合は400円引き（400円）。",
        "割引は併用できない。割引額が大きい方のみを適用する。"
      ],
      conditions: ["市内在住である", "回数券を利用する", "65歳以上である"],
      actions: ["利用料 800円（割引なし）", "利用料 600円", "利用料 500円", "利用料 400円"],
      fullColumns: makeFullColumns(3, [3, 2, 3, 2, 3, 1, 3, 0]),
      minimizedExample: [
        { conditions: ["-", "-", "T"], result: 3 },
        { conditions: ["T", "-", "F"], result: 2 },
        { conditions: ["F", "T", "F"], result: 1 },
        { conditions: ["F", "F", "F"], result: 0 }
      ],
      steps: [
        {
          id: "count",
          label: "条件数",
          type: "formula",
          prompt: "条件はいくつありますか。すべての条件をT/Fで組み合わせると、何通りになりますか。",
          fields: [
            { key: "conditions", label: "条件の数", inputMode: "numeric", answer: 3, answerDisplay: "3個" },
            { key: "columns", label: "全組み合わせの数", inputMode: "numeric", answer: 8, answerDisplay: "8通り（8列）" }
          ]
        },
        { id: "full", label: "全組み合わせ", type: "table", columns: 8, prompt: "T/Fの全8通りを並べ、各列で発生するアクションを1つ選んでください。" },
        { id: "min", label: "最小化", type: "minimized", columns: 8, prompt: "同じアクションになる列をまとめ、4列まで減らしてください。01ではN/Aは使いません。" }
      ],
      explanations: [
        "65歳以上の400円引きが最も大きいため、65歳以上がTなら他の2条件は結果に無関係です。",
        "最小化は表の整理です。「4列にまとまったから4件だけテストすればよい」という意味ではありません。"
      ]
    },
    {
      id: "practice-2",
      number: "02",
      section: "練習問題 02",
      navLabel: "練習問題②",
      navTitle: "N/Aとカバレッジ",
      title: "市民プール 仕様変更後",
      difficulty: "応用",
      goal: "実行不可能な組み合わせを表に反映し、最小化したテストのカバレッジを確認します。",
      specs: [
        "市民プール 利用料金シミュレータ（仕様変更後）",
        "基本利用料は800円とする。",
        "市内在住である場合は300円引き（500円）。",
        "回数券を利用する場合は200円引き（600円）。",
        "未就学児である場合は無料（0円）。",
        "割引は併用できない。割引額が大きい方のみを適用する。",
        "回数券は中学生以上が対象。未就学児は回数券を利用できない。"
      ],
      conditions: ["市内在住である", "回数券を利用する", "未就学児である"],
      actions: ["利用料 800円（割引なし）", "利用料 600円", "利用料 500円", "利用料 0円（無料）"],
      fullColumns: makeFullColumns(3, ["NA", 2, 3, 2, "NA", 1, 3, 0]),
      minimizedExample: [
        { conditions: ["-", "T", "T"], result: "NA" },
        { conditions: ["-", "F", "T"], result: 3 },
        { conditions: ["T", "-", "F"], result: 2 },
        { conditions: ["F", "T", "F"], result: 1 },
        { conditions: ["F", "F", "F"], result: 0 }
      ],
      steps: [
        { id: "full", label: "全組み合わせ", type: "table", columns: 8, prompt: "T/Fの全8通りを並べ、実行不可能な列はN/Aにしてください。" },
        { id: "min", label: "最小化", type: "minimized", columns: 8, prompt: "N/Aを含めて表を5列まで減らしてください。漏れと重複は答え合わせ時に自動検算します。", reference: "自動検算で、元の8通りを漏れなく・重複なく覆っていることを確認しました。" },
        {
          id: "coverage",
          label: "カバレッジ",
          type: "coverageChoice",
          prompt: "最小化後の実行可能4列を1回ずつ実施します。カバレッジの分母に使う数を選んでください。",
          total: 8,
          naBefore: 2,
          feasible: 6,
          minimized: 5,
          naAfter: 1,
          numerator: 4,
          answer: 6,
          percent: 66.7,
          options: [
            { value: 8, label: "全組み合わせ", note: "N/Aも含む8通り" },
            { value: 6, label: "実行可能な組み合わせ", note: "8通りからN/A 2通りを除く" },
            { value: 5, label: "最小化後の列", note: "N/A 1列を含む5列" }
          ],
          reference: "分母は6です。全8通りからN/Aの2通りを除いた、実行可能な6通りを基準にします。実施4 ÷ 実行可能6 ＝ 66.7%です。"
        }
      ],
      explanations: [
        "N/Aは『仕様上そもそも実行できない』、−は『実行できるが結果に無関係』です。",
        "最小化表の漏れと重複は、アプリが元の8通りへ展開して自動検算します。",
        "カバレッジの分母には、最小化前の実行可能列数を使います。"
      ]
    },
    {
      id: "production",
      number: "03",
      section: "本番問題",
      navLabel: "本番問題",
      navTitle: "アクセス権限判定",
      title: "文書管理システム",
      difficulty: "本番",
      goal: "練習問題と同じ手順で、別の題材のデシジョンテーブルを作成し、理解度を確認します。",
      specs: [
        "文書管理システム 文書の閲覧権限判定",
        "管理者権限を持つユーザーは、すべての文書を閲覧・編集できる。",
        "管理者権限を持たないログイン済みユーザーは、自部署の文書を閲覧できる。",
        "公開設定の文書は、誰でも閲覧できる。",
        "上記のいずれにも当てはまらない場合は、閲覧できない。",
        "管理者権限は、ログイン済みユーザーにのみ付与される。",
        "未ログインのユーザーが管理者権限を持つことはない。"
      ],
      conditions: ["ログイン済みである", "管理者権限を持つ", "自部署の文書である", "文書が公開設定である"],
      actions: ["閲覧・編集できる", "閲覧のみできる", "閲覧できない"],
      fullColumns: makeFullColumns(4, [0, 0, 0, 0, 1, 1, 1, 2, "NA", "NA", "NA", "NA", 1, 2, 1, 2]),
      minimizedExample: [
        { conditions: ["F", "T", "-", "-"], result: "NA" },
        { conditions: ["T", "T", "-", "-"], result: 0 },
        { conditions: ["T", "F", "T", "F"], result: 1 },
        { conditions: ["-", "F", "-", "T"], result: 1 },
        { conditions: ["T", "F", "F", "F"], result: 2 },
        { conditions: ["F", "F", "-", "F"], result: 2 }
      ],
      steps: [
        { id: "full", label: "全組み合わせ", type: "table", columns: 16, prompt: "T/Fの全16通りを並べ、実行不可能な列はN/Aにしてください。" },
        { id: "min", label: "最小化", type: "minimized", columns: 16, prompt: "N/Aを含めて表を6列まで減らしてください。漏れと重複は答え合わせ時に自動検算します。", reference: "自動検算で、元の16通りを漏れなく・重複なく覆っていることを確認しました。" },
        {
          id: "coverage",
          label: "カバレッジ",
          type: "coverageChoice",
          prompt: "最小化後の実行可能5列を1回ずつ実施します。カバレッジの分母に使う数を選んでください。",
          total: 16,
          naBefore: 4,
          feasible: 12,
          minimized: 6,
          naAfter: 1,
          numerator: 5,
          answer: 12,
          percent: 41.7,
          options: [
            { value: 16, label: "全組み合わせ", note: "N/Aも含む16通り" },
            { value: 12, label: "実行可能な組み合わせ", note: "16通りからN/A 4通りを除く" },
            { value: 6, label: "最小化後の列", note: "N/A 1列を含む6列" }
          ],
          reference: "分母は12です。全16通りからN/Aの4通りを除いた、実行可能な12通りを基準にします。実施5 ÷ 実行可能12 ＝ 41.7%です。"
        },
        {
          id: "quiz",
          label: "理解度チェック",
          type: "quiz",
          prompt: "デシジョンテーブルの使い方について、各問で最も適切なものを1つ選んでください。",
          notification: {
            source: "decision-table-assignment",
            event: "production_quiz_completed",
            url: "https://script.google.com/macros/s/AKfycbygAfjSXMDKffFoNqGw2AsGSTtw8thyIPcbm3AdxaZE4aGuikqflrrCPYrJxQ818n_K/exec"
          },
          questions: [
            {
              id: "q1",
              text: "N/Aと「−」の違いとして正しいものはどれですか？",
              options: ["どちらも入力漏れを表す", "N/Aは実行不可能、「−」は結果に無関係", "N/Aは未実施、「−」は実施済み", "どちらも同じ意味"],
              answer: 1,
              explanation: "N/Aは仕様上実行できない組み合わせです。「−」はT/Fどちらでも結果が変わらない条件です。"
            },
            {
              id: "q2",
              text: "最小化表の「−」をテストするとき、基本となる考え方はどれですか？",
              options: ["Tだけを確認する", "Fだけを確認する", "T/Fの両方を確認する", "その条件は確認しなくてよい"],
              answer: 2,
              explanation: "「−」はT/Fのどちらでも同じ結果になることを表します。原則は両方へ展開して確認します。"
            },
            {
              id: "q3",
              text: "今回のカバレッジの分母として使う数はどれですか？",
              options: ["全組み合わせの16", "実行可能な組み合わせの12", "最小化後の6", "実施する5"],
              answer: 1,
              explanation: "分母は、最小化前の実行可能な組み合わせ数です。N/A 4通りを除いた12を使います。"
            },
            {
              id: "q4",
              text: "デシジョンテーブルだけでは確認しにくいものはどれですか？",
              options: ["条件の組み合わせ", "組み合わせごとの結果", "数値の境界や時系列の状態変化", "実行不可能な組み合わせ"],
              answer: 2,
              explanation: "数値の境界には境界値分析、時系列の状態変化には状態遷移テストなどを併用します。"
            }
          ]
        }
      ],
      explanations: [
        "未ログインで管理者権限を持つ4通りは、仕様上実行できないためN/Aです。",
        "最小化表の漏れと重複は、アプリが元の16通りへ展開して自動検算します。",
        "カバレッジの分母には、最小化前の実行可能列数を使います。",
        "理解度チェックでは、表を作った後のテスト実行まで含めて確認します。"
      ]
    }
  ];
})();
