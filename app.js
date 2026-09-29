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

// 16タイプのコード
const TYPE_CODES = Object.values(TYPE_MAP);

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

  renderAxes(scores);
  const role = await renderType(code, "result");
  setupShare(`私は ${code}（${role}）型でした。#16ZATSUYO`, `${location.origin}${location.pathname}?type=${code}`);
}

// タイプ紹介画面（?type=◯◯◯◯ で開いたとき）
function showIntro(code) {
  renderType(code, "intro");
}

// 結果画面・紹介画面の共通部分。役割名を返す
async function renderType(code, mode) {
  const isResult = mode === "result";
  $("result-eyebrow").textContent = isResult ? "あなたのタイプ" : "タイプ紹介";
  $("result-only").hidden = !isResult;
  $("intro-only").hidden = isResult;

  $("result-code").textContent = code;
  $("result-role").textContent = "";
  $("result-catch").textContent = "";
  $("result-body").innerHTML = "";
  $("result-group").hidden = true;
  showScreen("result");

  renderGroup(code);

  try {
    const parsed = await loadResult(code);
    $("result-role").textContent = parsed.role;
    $("result-catch").textContent = parsed.catchCopy;
    $("result-body").innerHTML = marked.parse(parsed.body, { breaks: true });
    linkCompatibleTypes($("result-body"));
    return parsed.role || code;
  } catch {
    $("result-body").innerHTML = `<p class="error">結果の文章（results/${code}.md）を読み込めませんでした。</p>`;
    return code;
  }
}

// グループ名（types.html の該当グループへのリンク）
async function renderGroup(code) {
  const group = (await groupsReady).find((g) => g.types.includes(code));
  if (!group || $("result-code").textContent !== code) return;
  const el = $("result-group");
  el.textContent = group.name;
  el.href = `types.html#${group.id}`;
  el.hidden = false;
}

// 「相性のいいタイプ」見出しより後のタイプコードを、紹介ページへのリンクにする
function linkCompatibleTypes(body) {
  const heading = [...body.querySelectorAll("h2")].find((h) => h.textContent.includes("相性のいいタイプ"));
  if (!heading) return;
  const pattern = new RegExp(`\\b(${TYPE_CODES.join("|")})\\b(（[^）]*）)?`, "g");
  for (let el = heading.nextElementSibling; el; el = el.nextElementSibling) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const text = node.textContent;
      pattern.lastIndex = 0;
      if (!pattern.test(text)) return;
      const frag = document.createDocumentFragment();
      let last = 0;
      text.replace(pattern, (match, code, _role, offset) => {
        frag.append(text.slice(last, offset));
        const a = document.createElement("a");
        a.href = `?type=${code}`;
        a.textContent = match;
        frag.append(a);
        last = offset + match.length;
      });
      frag.append(text.slice(last));
      node.replaceWith(frag);
    });
  }
}

// 共有ボタン（文章とURLは全ボタン共通）
let share = { text: "", url: "" };

function setupShare(text, url) {
  share = { text, url };
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  $("share-x").href = `https://x.com/intent/tweet?text=${t}&url=${u}`;
  // LINE Social Plugins「LINEで送る」（カスタムアイコン用リンク）
  $("share-line").href = `https://social-plugins.line.me/lineit/share?url=${u}&text=${t}`;
  // Threads Web Intent
  $("share-threads").href = `https://www.threads.com/intent/post?text=${t}&url=${u}`;
}

function copyWithTextarea(str) {
  const ta = document.createElement("textarea");
  ta.value = str;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("copy failed");
}

let copyTimer;
async function copyLink() {
  const btn = $("share-copy");
  const str = `${share.text}\n${share.url}`;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(str);
    } else {
      copyWithTextarea(str);
    }
  } catch {
    try {
      copyWithTextarea(str);
    } catch {
      return;
    }
  }
  btn.textContent = "コピーしました";
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => (btn.textContent = "リンクをコピー"), 2000);
}

async function nativeShare() {
  try {
    await navigator.share({ title: "16ZATSUYO｜雑用タイプ診断", text: share.text, url: share.url });
  } catch (e) {
    if (e.name !== "AbortError") console.warn(e);
  }
}

let groupsReady;
let questionsReady;

function start() {
  // 紹介ページ（?type=）から始めたときは、URLをトップに戻す
  if (location.search) history.replaceState(null, "", location.pathname);
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
  $("btn-try").addEventListener("click", async () => {
    await questionsReady;
    if (questions.length) start();
  });
  $("share-copy").addEventListener("click", copyLink);
  if (typeof navigator.share === "function") {
    $("share-native").hidden = false;
    $("share-native").addEventListener("click", nativeShare);
  }
  groupsReady = loadGroups().catch(() => []);
  questionsReady = loadQuestions();

  const type = (new URLSearchParams(location.search).get("type") || "").toUpperCase();
  if (TYPE_CODES.includes(type)) showIntro(type);

  try {
    await questionsReady;
  } catch (e) {
    $("btn-start").disabled = true;
    $("btn-start").insertAdjacentHTML("afterend", `<p class="error">${e.message}</p>`);
  }
}

init();
