// 16ZATSUYO 全タイプ一覧

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function renderCard(code, result) {
  const card = el("a", "type-card");
  card.href = `./?type=${code}`;
  card.append(
    el("span", "type-card-code", code),
    el("span", "type-card-role", result ? result.role : ""),
    el("span", "type-card-catch", result ? result.catchCopy : "")
  );
  return card;
}

async function init() {
  const box = document.getElementById("groups");
  try {
    const groups = await loadGroups();
    // 役割名・キャッチコピーは results/◯◯◯◯.md から読み込む
    const codes = groups.flatMap((g) => g.types);
    const results = await Promise.all(codes.map((code) => loadResult(code).catch(() => null)));
    const byCode = Object.fromEntries(codes.map((code, i) => [code, results[i]]));

    groups.forEach((g) => {
      const section = el("section", "group");
      section.id = g.id;
      const head = el("div", "group-head");
      head.append(el("h2", "group-name", g.name), el("p", "group-desc", g.description));
      const grid = el("div", "type-grid");
      g.types.forEach((code) => grid.append(renderCard(code, byCode[code])));
      section.append(head, grid);
      box.append(section);
    });

    // 中身を描画し終えてから、#uragata などのアンカー位置へ移動する
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  } catch (e) {
    box.append(el("p", "error", e.message));
  }
}

init();
