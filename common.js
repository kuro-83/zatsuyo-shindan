// index.html と types.html で共通の処理

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

// results/◯◯◯◯.md を読み込んで分解する
async function loadResult(code) {
  const res = await fetch(`results/${code}.md`, { cache: "no-store" });
  if (!res.ok) throw new Error(`results/${code}.md を読み込めませんでした`);
  return parseResult(await res.text());
}

// data/groups.json（グループ名・説明文・並び順）
async function loadGroups() {
  const res = await fetch("data/groups.json", { cache: "no-store" });
  if (!res.ok) throw new Error("groups.json を読み込めませんでした");
  return res.json();
}
