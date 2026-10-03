// Run: node test-server.js
// Tests server.js against a MOCK of the Anthropic API (no real key or network needed).
// This verifies our request shape, tool loop, and error handling - it cannot prove the live API accepts it.
const http = require("http");
const { spawn } = require("child_process");

let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) pass++; else { fail++; console.log("FAIL:", name, detail === undefined ? "" : JSON.stringify(detail)); } };
const msg = (content, stop_reason = "end_turn") => ({ id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5", content, stop_reason, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } });

const seen = [];                                                 // every request the mock receives
const mock = http.createServer((req, res) => {
  let raw = ""; req.on("data", c => raw += c); req.on("end", () => {
    const body = JSON.parse(raw || "{}"); seen.push({ url: req.url, headers: req.headers, body });
    const first = body.messages[0].content.find(b => b.type === "text").text;
    const reply = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (first.includes("FAIL401")) return reply(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key SECRET-DETAIL" } });
    if (first.includes("REFUSE")) return reply(200, msg([{ type: "text", text: "no" }], "refusal"));
    if (first.includes("LOOP")) return reply(200, msg([{ type: "tool_use", id: "toolu_loop", name: "calculate", input: { expression: "1+1" } }], "tool_use"));
    const last = body.messages[body.messages.length - 1];
    if (last.role === "user" && Array.isArray(last.content) && last.content[0].type === "tool_result")
      return reply(200, msg([{ type: "text", text: "**Answer: 36**\n1. 15% of 240 = 36" }]));
    return reply(200, msg([{ type: "tool_use", id: "toolu_1", name: "calculate", input: { expression: "(15/100)*240" } }], "tool_use"));
  });
});

function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["server.js"], { cwd: __dirname, env: { ...process.env, PORT: "0", ...env } });
    let out = ""; child.stdout.on("data", d => { out += d; const m = out.match(/http:\/\/127\.0\.0\.1:(\d+)/); if (m) resolve({ child, base: m[0], out: () => out }); });
    child.stderr.on("data", d => (out += d)); child.on("error", reject);
    setTimeout(() => reject(new Error("server did not start: " + out)), 5000);
  });
}
const post = (base, body, headers = { "content-type": "application/json" }) => fetch(base + "/api/ask", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });

(async () => {
  await new Promise(r => mock.listen(0, "127.0.0.1", r));
  const upstream = "http://127.0.0.1:" + mock.address().port;

  /* ---- AI on ---- */
  const on = await startServer({ ANTHROPIC_API_KEY: "test-key-123", ANTHROPIC_BASE_URL: upstream });
  const base = on.base;
  const st = await (await fetch(base + "/api/status")).json();
  check("status says ai on", st.ai === true && st.model === "claude-opus-5-5", st);

  // static files + hardening
  const home = await fetch(base + "/");
  check("serves index.html", home.status === 200 && (await home.text()).includes("EasyMath"));
  check("CSP header set", /default-src 'self'/.test(home.headers.get("content-security-policy") || ""));
  for (const p of ["/server.js", "/package.json", "/node_modules/", "/..%2fserver.js", "/%2e%2e/server.js", "/.env"]) {
    const r = await fetch(base + p); check("blocks " + p, r.status === 404, r.status);
  }
  check("never leaks the key", !(await (await fetch(base + "/api/status")).text()).includes("test-key"));

  // happy path with tool loop
  const r1 = await post(base, { question: "What is 15% of 240?" });
  const j1 = await r1.json();
  check("ask returns the final answer", r1.status === 200 && j1.answer && j1.answer.includes("**Answer: 36**"), j1);
  check("made exactly 2 upstream calls (tool loop)", seen.length === 2, seen.length);
  const [a, b] = seen;
  check("hits the messages endpoint", /^\/v1\/messages/.test(a.url), a.url);
  check("sends key via x-api-key", a.headers["x-api-key"] === "test-key-123");
  check("model is claude-opus-5-5 by default", a.body.model === "claude-opus-5-5", a.body.model);
  check("fallback beta header + default form", /server-side-fallback-2026-07-01/.test(a.headers["anthropic-beta"] || "") && a.body.fallbacks === "default", [a.headers["anthropic-beta"], a.body.fallbacks]);
  check("effort low, no thinking override, no temperature", a.body.output_config && a.body.output_config.effort === "low" && !("thinking" in a.body) && !("temperature" in a.body), a.body.output_config);
  check("no forced tool_choice", !("tool_choice" in a.body));
  check("calculator tool offered", a.body.tools.length === 1 && a.body.tools[0].name === "calculate");
  check("system prompt present", typeof a.body.system === "string" && a.body.system.includes("EasyMath"));
  check("question forwarded", a.body.messages[0].content[0].text === "What is 15% of 240?");
  const lastB = b.body.messages[b.body.messages.length - 1];
  check("tool result sent back in ONE user message", lastB.role === "user" && lastB.content.length === 1 && lastB.content[0].type === "tool_result" && lastB.content[0].tool_use_id === "toolu_1", lastB);
  check("calculator computed 36 exactly", lastB.content[0].content === "36", lastB.content[0]);
  check("assistant tool_use echoed back", b.body.messages[1].role === "assistant" && b.body.messages[1].content[0].type === "tool_use");

  // image handling
  seen.length = 0;
  const px = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const ri = await post(base, { question: "", image: { media_type: "image/png", data: px } });
  check("image-only question accepted", ri.status === 200, await ri.clone().text());
  const img = seen[0].body.messages[0].content;
  check("image block sent first, with default prompt", img[0].type === "image" && img[0].source.type === "base64" && img[0].source.media_type === "image/png" && img[1].type === "text" && /image/i.test(img[1].text), img);

  // input validation
  check("rejects bad image type", (await post(base, { question: "hi", image: { media_type: "text/html", data: px } })).status === 400);
  check("rejects non-base64 image data", (await post(base, { question: "hi", image: { media_type: "image/png", data: "<script>" } })).status === 400);
  check("rejects empty request", (await post(base, {})).status === 400);
  check("rejects wrong content-type", (await post(base, "question=hi", { "content-type": "text/plain" })).status === 415);
  check("rejects overlong question", (await post(base, { question: "x".repeat(2001) })).status === 400);
  check("rejects broken JSON", (await post(base, "{nope")).status === 400);
  check("oversize body -> 413", (await post(base, { question: "x", image: { media_type: "image/png", data: "A".repeat(4.2e6) } }).catch(() => ({ status: 413 }))).status === 413);

  // upstream behaviours
  const r401 = await post(base, { question: "FAIL401" }); const t401 = await r401.text();
  check("upstream 401 -> generic 502, no leak", r401.status === 502 && !t401.includes("SECRET-DETAIL") && !t401.includes("x-api-key"), t401);
  const rr = await post(base, { question: "REFUSE" });
  check("refusal handled politely", rr.status === 200 && /can't help/i.test((await rr.json()).answer));
  const rl = await post(base, { question: "LOOP" });
  check("runaway tool loop is capped", rl.status === 200 && /too many steps/i.test((await rl.json()).answer));

  // rate limit (20/min per visitor)
  let limited = false; for (let i = 0; i < 30 && !limited; i++) limited = (await post(base, {})).status === 429;
  check("rate limit kicks in", limited);
  on.child.kill();

  /* ---- AI off (no key) ---- */
  const off = await startServer({ ANTHROPIC_API_KEY: "", ANTHROPIC_AUTH_TOKEN: "", MATH_AI: "" });
  const so = await (await fetch(off.base + "/api/status")).json();
  check("status says ai off without key", so.ai === false, so);
  check("ask -> 503 without key", (await post(off.base, { question: "hi" })).status === 503);
  check("app still served without key", (await fetch(off.base + "/")).status === 200);
  off.child.kill();

  /* ---- cheaper model via env: no effort/fallback params that Haiku would reject ---- */
  seen.length = 0;
  const hk = await startServer({ ANTHROPIC_API_KEY: "k", ANTHROPIC_BASE_URL: upstream, MATH_MODEL: "claude-haiku-4-5" });
  await post(hk.base, { question: "What is 15% of 240?" });
  check("haiku: no effort, no fallbacks, no beta header", seen[0] && !seen[0].body.output_config && !("fallbacks" in seen[0].body) && !/fallback/.test(seen[0].headers["anthropic-beta"] || ""), seen[0] && [seen[0].body.output_config, seen[0].headers["anthropic-beta"]]);
  check("haiku: model id used as given", seen[0] && seen[0].body.model === "claude-haiku-4-5");
  hk.child.kill();

  mock.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
