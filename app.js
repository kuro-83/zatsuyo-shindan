// 16ZATSUYO 雑用タイプ診断

// 軸の定義（plus = 合計が0以上のときの文字）
const AXES = [
  { name: "立ち位置", plus: "A", plusLabel: "前に出る", minus: "S", minusLabel: "裏で支える" },
  { name: "進め方", plus: "P", plusLabel: "段取り派", minus: "F", minusLabel: "臨機応変派" },
  { name: "関心", plus: "H", plusLabel: "人と関わる", minus: "T", minusLabel: "モノ・作業" },
  { name: "周囲への意識", plus: "C", plusLabel: "気配り", minus: "M", minusLabel: "マイペース" },
];

// 軸コード → 表示コード
const TYPE_MAP = {
  APHC: "NMKJ", APHM: "YSGK", APTC: "BSTR", APTM: "DNKS",
  AFHC: "DNWT", AFHM: "BNTC", AFTC: "TKFK", AFTM: "MDAK",
  SPHC: "OCKM", SPHM: "GJRK", SPTC: "BHHC", SPTM: "HNKO",
  SFHC: "OMYG", SFHM: "EBOS", SFTC: "MZYR", SFTM: "GMST",
};

// 左（そう思う）→ 右（そう思わない）
const CHOICES = [
  { value: 2, label: "とてもそう思う" },
  { value: 1, label: "そう思う" },
  { value: 0, label: "どちらでもない" },
  { value: -1, label: "そう思わない" },
  { value: -2, label: "全くそう思わない" },
];

let questions = [];
let answers = [];
let current = 0;

const $ = (id) => document.getElementById(id);

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  $("screen-" + name).classList.add("active");
  window.scrollTo(0, 0);
}

async function loadQuestions() {
  const res = await fetch("data/questions.json", { cache: "no-store" });
  if (!res.ok) throw new Error("questions.json を読み込めませんでした");
  questions = await res.json();
}

function renderChoices() {
  const box = $("choices");
  box.innerHTML = "";
  CHOICES.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.dataset.v = c.value;
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-label", c.label);
    btn.title = c.label;
    btn.addEventListener("click", () => answer(c.value));
    box.appendChild(btn);
  });
}

function renderQuestion() {
  const q = questions[current];
  $("question-text").textContent = q.text;
  $("progress-text").textContent = `${current + 1} / ${questions.length}`;
  $("progress-bar").style.width = `${(current / questions.length) * 100}%`;
  $("btn-back").disabled = current === 0;
  document.querySelectorAll(".choice").forEach((btn) => {
    const selected = Number(btn.dataset.v) === answers[current];
    btn.classList.toggle("selected", selected);
    btn.setAttribute("aria-checked", selected);
  });
}

let advancing = false;
function answer(value) {
  if (advancing) return;
  answers[current] = value;
  renderQuestion();
  advancing = true;
  setTimeout(() => {
    advancing = false;
    if (current < questions.length - 1) {
      current++;
      renderQuestion();
    } else {
      $("progress-bar").style.width = "100%";
      showResult();
    }
  }, 220);
}

function back() {
  if (current > 0) {
    current--;
    renderQuestion();
  }
}

// 軸ごとの合計（−10〜+10）
function calcScores() {
  const scores = [0, 0, 0, 0];
  questions.forEach((q, i) => {
    const v = answers[i] ?? 0;
    scores[q.axis - 1] += q.reverse ? -v : v;
  });
  return scores;
}

// .md を「役割名・キャッチコピー・本文」に分ける
function parseResult(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let role = "";
  let catchCopy = "";
  const rest = [];
  for (const line of lines) {
    if (!role && /^#\s+/.test(line)) {
      role = line.replace(/^#\s+/, "").trim();
    } else if (!catchCopy && /^>\s?/.test(line)) {
      catchCopy = line.replace(/^>\s?/, "").trim();
    } else {
      rest.push(line);
    }
  }
  return { role, catchCopy, body: rest.join("\n").trim() };
}

function renderAxes(scores) {
  const box = $("result-axes");
  box.innerHTML = "";
  AXES.forEach((axis, i) => {
    const plusPct = Math.round(((scores[i] + 10) / 20) * 100);
    const minusPct = 100 - plusPct;
    const plusWins = scores[i] >= 0;
    const el = document.createElement("div");
    el.className = "axis";
    el.innerHTML = `
      <div class="axis-name">${axis.name}</div>
      <div class="axis-labels">
        <span class="${plusWins ? "win" : ""}">${axis.plusLabel} ${plusPct}%</span>
        <span class="${plusWins ? "" : "win"}">${minusPct}% ${axis.minusLabel}</span>
      </div>
      <div class="axis-track"><div class="axis-fill" style="width:${plusPct}%"></div></div>`;
    box.appendChild(el);
  });
}

async function showResult() {
  const scores = calcScores();
  const axisCode = AXES.map((a, i) => (scores[i] >= 0 ? a.plus : a.minus)).join("");
  const code = TYPE_MAP[axisCode];

  $("result-code").textContent = code;
  $("result-role").textContent = "";
  $("result-catch").textContent = "";
  $("result-body").innerHTML = "";
  renderAxes(scores);
  showScreen("result");

  let role = code;
  try {
    const res = await fetch(`results/${code}.md`, { cache: "no-store" });
    if (!res.ok) throw new Error();
    const parsed = parseResult(await res.text());
    role = parsed.role || code;
    $("result-role").textContent = parsed.role;
    $("result-catch").textContent = parsed.catchCopy;
    $("result-body").innerHTML = marked.parse(parsed.body, { breaks: true });
  } catch {
    $("result-body").innerHTML = `<p class="error">結果の文章（results/${code}.md）を読み込めませんでした。</p>`;
  }

  const siteUrl = location.origin + location.pathname;
  const text = `私は ${code}（${role}）型でした。#16ZATSUYO`;
  $("btn-share").href =
    "https://x.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(siteUrl);
}

function start() {
  answers = new Array(questions.length);
  current = 0;
  renderQuestion();
  showScreen("quiz");
}

async function init() {
  renderChoices();
  $("btn-start").addEventListener("click", start);
  $("btn-back").addEventListener("click", back);
  $("btn-retry").addEventListener("click", () => showScreen("start"));
  try {
    await loadQuestions();
  } catch (e) {
    $("btn-start").disabled = true;
    $("btn-start").insertAdjacentHTML("afterend", `<p class="error">${e.message}</p>`);
  }
}

init();
