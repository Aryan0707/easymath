"use strict";
/* EasyMath server: serves the app and (optionally) powers the AI helper.
   The API key stays here on the server and is never sent to the browser.

   Run:  ANTHROPIC_API_KEY=sk-ant-... node server.js
   Open: http://127.0.0.1:3000
   Without a key the app still works fully; only "Ask AI" and photo input are off. */

const http = require("http");
const fs = require("fs");
const path = require("path");
const Engine = require("./engine.js");
const AnthropicPkg = require("@anthropic-ai/sdk");
const Anthropic = AnthropicPkg.default || AnthropicPkg;

const PORT = process.env.PORT === undefined ? 3000 : +process.env.PORT;
const HOST = process.env.HOST || "127.0.0.1";                 // set HOST=0.0.0.0 to test from a phone on your Wi-Fi
const MODEL = process.env.MATH_MODEL || "claude-opus-5-5";    // e.g. MATH_MODEL=claude-haiku-4-5 for cheaper/faster
const EFFORT = process.env.MATH_EFFORT || "low";              // quick answers; raise to "medium"/"high" for harder math
const AI_ON = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.MATH_AI === "1");

// effort + server-side fallbacks are only valid on newer models (Haiku 4.5 rejects effort).
const SUPPORTS_EFFORT = /^claude-(opus-(5|4-[5-8])|sonnet-(5|4-6)|fable-5|mythos-5)/.test(MODEL);
const SUPPORTS_FALLBACK = /^claude-(opus-5|sonnet-5-5|fable-5-1)/.test(MODEL);

const SYSTEM = `You are the tutor inside EasyMath, an app for complete beginners. Be warm and plain-spoken, and never make the learner feel slow.
Format: first line is the final answer in bold, like **Answer: 36**. Then at most four short numbered steps in simple words. Add one "Faster way:" line only when a real mental shortcut applies.
Use the calculate tool for every calculation; never do arithmetic in your head. If an image is attached, say briefly what problem you read from it, then solve it.
If the question isn't about math, say that you only help with math.`;

const TOOLS = [{
  name: "calculate",
  description: "Exactly evaluate a numeric expression. Supports + - * / ^ ( ), %, !, sqrt(), abs(), sin(), cos(), tan(), log() (base 10), ln(), round(), floor(), ceil(), pi, e. Example: \"(15/100)*240\".",
  input_schema: { type: "object", properties: { expression: { type: "string", description: "The numeric expression to evaluate" } }, required: ["expression"] }
}];

let client = null;
const getClient = () => client || (client = new Anthropic({ timeout: 60000, baseURL: process.env.ANTHROPIC_BASE_URL || undefined }));

function runTool(block) {
  if (block.name !== "calculate") return { content: "Unknown tool", is_error: true };
  try {
    const expr = String((block.input && block.input.expression) || "");
    if (!expr || expr.length > 200) throw new Error("bad length");
    const v = Engine.evaluate(Engine.normalize(expr));
    if (!Number.isFinite(v)) throw new Error("not finite");
    return { content: String(Number(v.toPrecision(15))) };
  } catch {
    return { content: "Could not evaluate that expression. Use digits and + - * / ^ ( ), sqrt(), pi, %, !", is_error: true };
  }
}

// After a mid-turn fallback, thinking/tool_use blocks from before the last "fallback" marker must not be echoed back.
function echoable(content) {
  let last = -1;
  content.forEach((b, i) => { if (b.type === "fallback") last = i; });
  return last < 0 ? content : content.filter((b, i) => i >= last || b.type === "text");
}

async function solve(question, image) {
  const content = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } });
  content.push({ type: "text", text: question || "Please solve the math problem in this image." });
  const messages = [{ role: "user", content }];

  for (let turn = 0; turn < 6; turn++) {
    const params = { model: MODEL, max_tokens: 16000, system: SYSTEM, tools: TOOLS, messages };
    if (SUPPORTS_EFFORT) params.output_config = { effort: EFFORT };
    if (SUPPORTS_FALLBACK) { params.betas = ["server-side-fallback-2026-07-01"]; params.fallbacks = "default"; }
    const res = await getClient().beta.messages.create(params);

    if (res.stop_reason === "refusal") return "I can't help with that one. Try a different math question.";
    const echo = echoable(res.content);
    messages.push({ role: "assistant", content: echo });

    if (res.stop_reason === "tool_use") {
      const results = echo.filter(b => b.type === "tool_use").map(b => ({ type: "tool_result", tool_use_id: b.id, ...runTool(b) }));
      messages.push({ role: "user", content: results });          // all results together in ONE user message
      continue;
    }
    const text = res.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    if (text) return text;
    return res.stop_reason === "max_tokens" ? "That answer got cut off. Try a simpler question." : "I couldn't work that out. Try rephrasing it.";
  }
  return "That took too many steps. Try a simpler question.";
}

/* ---------------- HTTP ---------------- */
const STATIC = {
  "index.html": "text/html; charset=utf-8", "styles.css": "text/css; charset=utf-8", "engine.js": "text/javascript; charset=utf-8", "icons.js": "text/javascript; charset=utf-8", "skills.js": "text/javascript; charset=utf-8",
  "app.js": "text/javascript; charset=utf-8", "sw.js": "text/javascript; charset=utf-8", "manifest.webmanifest": "application/manifest+json",
  "icon.svg": "image/svg+xml", "icon-180.png": "image/png", "icon-192.png": "image/png", "icon-512.png": "image/png"
};
const HEADERS = {
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"
};
const hits = new Map(); let inflight = 0;
function limited(ip) {                                            // 20 questions per minute per visitor
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < 60000)) hits.delete(k);
  return arr.length > 20;
}
const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-cache", ...HEADERS });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if (size > limit) { reject(Object.assign(new Error("too big"), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleAsk(req, res) {
  if (!AI_ON) return send(res, 503, { error: "The AI helper isn't set up on this server." });
  if (!/^application\/json/i.test(req.headers["content-type"] || "")) return send(res, 415, { error: "Send JSON." });
  if (limited(req.socket.remoteAddress)) return send(res, 429, { error: "Too many questions — wait a minute and try again." });
  if (inflight >= 4) return send(res, 429, { error: "The helper is busy. Try again in a moment." });

  let body;
  try { body = JSON.parse(await readBody(req, 4e6)); }
  catch (e) { return send(res, e.status || 400, { error: e.status === 413 ? "That image is too large." : "Couldn't read that request." }); }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const image = body.image;
  if (question.length > 2000) return send(res, 400, { error: "Question is too long." });
  if (image !== undefined && image !== null) {
    const ok = image && typeof image === "object" && ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.media_type)
      && typeof image.data === "string" && image.data.length < 3.5e6 && /^[A-Za-z0-9+/=]+$/.test(image.data);
    if (!ok) return send(res, 400, { error: "That image couldn't be used." });
  }
  if (!question && !image) return send(res, 400, { error: "Type a question or add a photo." });

  inflight++;
  try { send(res, 200, { answer: await solve(question, image || null) }); }
  catch (e) {
    const status = e && e.status;
    console.error("[ask] upstream error:", status || "", e && e.message);   // details stay on the server
    if (status === 401 || status === 403) send(res, 502, { error: "The AI helper isn't configured correctly on the server." });
    else if (status === 429) send(res, 503, { error: "The AI helper is busy right now. Try again shortly." });
    else send(res, 502, { error: "The AI helper had a problem. Try again." });
  } finally { inflight--; }
}

const server = http.createServer(async (req, res) => {
  try {
    const p = new URL(req.url, "http://localhost").pathname;
    if (p === "/api/status" && req.method === "GET") return send(res, 200, { ai: AI_ON, model: AI_ON ? MODEL : null });
    if (p === "/api/ask" && req.method === "POST") return await handleAsk(req, res);
    if (req.method === "GET" || req.method === "HEAD") {
      const name = p === "/" ? "index.html" : p.slice(1);
      if (Object.prototype.hasOwnProperty.call(STATIC, name))           // fixed allow-list: no path traversal possible
        return send(res, 200, fs.readFileSync(path.join(__dirname, name)), STATIC[name]);
    }
    send(res, 404, { error: "Not found" });
  } catch (e) { console.error(e); if (!res.headersSent) send(res, 500, { error: "Server error" }); }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`EasyMath running at http://${HOST}:${server.address().port}`);
    console.log(AI_ON ? `AI helper ON (model ${MODEL}, effort ${SUPPORTS_EFFORT ? EFFORT : "n/a"})` : "AI helper OFF (set ANTHROPIC_API_KEY to enable)");
  });
}
module.exports = { server, solve };
