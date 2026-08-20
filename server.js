const port = Number(Deno.env.get("PORT") ?? 8000);
const publicDir = new URL("./public/", import.meta.url);

const questions = [
  { id: "html-01", domain: "HTML", title: "フォームの送信先を指定する属性", prompt: "<form ____=\"/api/join\">", answer: "action", options: ["action", "target", "method", "route"], hint: "行動・動作を意味する属性です。" },
  { id: "css-01", domain: "CSS", title: "要素を縦横中央に配置", prompt: ".stack { display: flex; ____: center; align-items: center; }", answer: "justify-content", options: ["justify-content", "text-align", "place-items", "align-content"], hint: "主軸方向の配置を決めます。" },
  { id: "js-01", domain: "JavaScript", title: "配列を変換するメソッド", prompt: "const labels = users.____(user => user.name);", answer: "map", options: ["map", "filter", "reduce", "find"], hint: "各要素から新しい配列を作ります。" },
  { id: "deno-01", domain: "Deno", title: "HTTP サーバーの起動", prompt: "const server = Deno.____({ port: 8000 });", answer: "serve", options: ["serve", "listen", "start", "connect"], hint: "標準 API でリクエストを受け付けます。" },
  { id: "web-01", domain: "Web開発", title: "非同期処理の待機", prompt: "const response = await fetch(url); // この関数は ____ 関数内", answer: "async", options: ["async", "defer", "promise", "sync"], hint: "await と一緒に宣言します。" },
  { id: "js-02", domain: "JavaScript", title: "値がないときの代替値", prompt: "const port = env.PORT ____ 8000;", answer: "??", options: ["??", "||", "&&", "?:"], hint: "null と undefined のときだけ右辺を使います。" },
  { id: "js-code-01", type: "code", language: "javascript", domain: "JavaScript", title: "配列を2倍にする関数を書こう", prompt: "numbers の各要素を2倍にした配列を返す関数 doubleNumbers を完成させてください。", starter: "function doubleNumbers(numbers) {\n  // write your code here\n}", acceptedAnswers: ["function doubleNumbers(numbers) { return numbers.map(number => number * 2); }", "function doubleNumbers(numbers) { return numbers.map((number) => number * 2); }"], hint: "map は元の配列を変えずに、新しい配列を返します。" },
  { id: "deno-code-01", type: "code", language: "javascript", domain: "Deno", title: "Deno の JSON レスポンスを書こう", prompt: "status 200 と JSON の Content-Type を持つ Response を返してください。", starter: "function okJson(data) {\n  // write your code here\n}", acceptedAnswers: ["function okJson(data) { return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } }); }", "function okJson(data) { return new Response(JSON.stringify(data), { status: 200, headers: { \"content-type\": \"application/json\" } }); }"], hint: "JSON.stringify と Response の組み合わせを使います。" },
];

const rooms = new Map();
const domainKeys = ["Web開発", "HTML", "CSS", "JavaScript", "Deno"];

function makeCode() {
  let code;
  do code = Math.random().toString(36).slice(2, 6).toUpperCase(); while (rooms.has(code));
  return code;
}

function makeRoom(code) {
  const room = { code, phase: "lobby", createdAt: Date.now(), participants: new Map(), startedAt: null, completedAt: null };
  rooms.set(code, room);
  return room;
}

function getOrCreateRoom(code) { return rooms.get(code) ?? makeRoom(code); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
function publicQuestion(question) { return { id: question.id, type: question.type ?? "choice", language: question.language, domain: question.domain, title: question.title, prompt: question.prompt, starter: question.starter, options: question.options, hint: question.hint }; }

function normalizeCode(value) { return String(value).replace(/\/\/.*$/gm, "").replace(/\s+/g, " ").replace(/\s*([{}();,:=])\s*/g, "$1").trim(); }

function calculateTeam(room) {
  const people = [...room.participants.values()];
  const scores = Object.fromEntries(domainKeys.map((domain) => [domain, { total: 0, correct: 0 }]));
  for (const person of people) for (const result of person.answers) {
    scores[result.domain].total += 1;
    if (result.correct) scores[result.domain].correct += 1;
  }
  const coverage = domainKeys.map((domain) => scores[domain].total ? scores[domain].correct / scores[domain].total : 0);
  const average = coverage.length ? coverage.reduce((sum, score) => sum + score, 0) / coverage.length : 0;
  const balance = Math.max(0, 1 - (Math.max(...coverage, 0) - Math.min(...coverage, 0)));
  const distance = Math.round(420 + average * 780 + balance * 500 + Math.min(people.length, 5) * 65);
  return { scores, average, balance, distance };
}

function stateFor(room, viewerId) {
  const viewer = room.participants.get(viewerId);
  const team = calculateTeam(room);
  return {
    code: room.code, phase: room.phase, participantCount: room.participants.size,
    participants: [...room.participants.values()].map((person) => ({ id: person.id, name: person.name, status: person.answers.length === questions.length ? "complete" : "ready", score: person.answers.filter((answer) => answer.correct).length })),
    questions: room.phase === "quiz" || room.phase === "launch" || room.phase === "results" ? questions.map(publicQuestion) : [],
    me: viewer ? { id: viewer.id, name: viewer.name, answers: viewer.answers, score: viewer.answers.filter((answer) => answer.correct).length } : null,
    team: room.phase === "lobby" ? null : team,
  };
}

async function body(request) { try { return await request.json(); } catch { return {}; } }

async function api(request, url) {
  const path = url.pathname;
  if (request.method === "GET" && path === "/api/state") {
    const room = rooms.get(url.searchParams.get("code")?.toUpperCase());
    return room ? json(stateFor(room, url.searchParams.get("viewer"))) : json({ error: "ROOM_NOT_FOUND" }, 404);
  }
  if (request.method === "POST" && path === "/api/join") {
    const data = await body(request); const name = String(data.name ?? "").trim().slice(0, 24); let code = String(data.code ?? "").trim().toUpperCase();
    if (!name) return json({ error: "NAME_REQUIRED" }, 400);
    const room = code ? rooms.get(code) : makeRoom(makeCode());
    if (!room) return json({ error: "ROOM_NOT_FOUND" }, 404);
    if (room.phase !== "lobby") return json({ error: "ROOM_STARTED" }, 409);
    const id = crypto.randomUUID(); room.participants.set(id, { id, name, answers: [] });
    return json({ viewer: id, state: stateFor(room, id) }, 201);
  }
  if (request.method === "POST" && path === "/api/start") {
    const data = await body(request); const room = rooms.get(String(data.code ?? "").toUpperCase());
    if (!room) return json({ error: "ROOM_NOT_FOUND" }, 404);
    if (room.participants.size < 2) return json({ error: "NEED_TEAM" }, 400);
    room.phase = "quiz"; room.startedAt = Date.now(); return json({ state: stateFor(room, data.viewer) });
  }
  if (request.method === "POST" && path === "/api/report") {
    const data = await body(request); const room = rooms.get(String(data.code ?? "").toUpperCase());
    const person = room?.participants.get(data.viewer);
    if (!room || !person) return json({ error: "SESSION_NOT_FOUND" }, 404);
    if (room.phase !== "launch" && room.phase !== "results") return json({ error: "REPORT_NOT_READY" }, 409);
    room.phase = "results";
    return json({ state: stateFor(room, person.id) });
  }
  if (request.method === "POST" && path === "/api/answer") {
    const data = await body(request); const room = rooms.get(String(data.code ?? "").toUpperCase()); const person = room?.participants.get(data.viewer);
    if (!room || !person) return json({ error: "SESSION_NOT_FOUND" }, 404);
    if (room.phase !== "quiz") return json({ error: "QUIZ_NOT_ACTIVE" }, 409);
    if (person.answers.some((answer) => answer.questionId === data.questionId)) return json({ state: stateFor(room, person.id) });
    const question = questions.find((item) => item.id === data.questionId); if (!question) return json({ error: "QUESTION_NOT_FOUND" }, 404);
    const submittedValue = String(data.value ?? "");
    const correct = question.type === "code"
      ? question.acceptedAnswers.some((answer) => normalizeCode(answer) === normalizeCode(submittedValue))
      : submittedValue === question.answer;
    person.answers.push({ questionId: question.id, domain: question.domain, value: submittedValue, correct });
    if ([...room.participants.values()].every((member) => member.answers.length === questions.length)) { room.phase = "launch"; room.completedAt = Date.now(); }
    return json({ state: stateFor(room, person.id) });
  }
  return json({ error: "NOT_FOUND" }, 404);
}

async function handler(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return api(request, url);
  let pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  try { const file = await Deno.open(new URL(`.${pathname}`, publicDir), { read: true }); return new Response(file.readable, { headers: { "content-type": pathname.endsWith(".css") ? "text/css" : pathname.endsWith(".js") ? "text/javascript" : "text/html" } }); }
  catch { return new Response("Not found", { status: 404 }); }
}

console.log(`Team Orbit running at http://localhost:${port}`);
Deno.serve({ port }, handler);
