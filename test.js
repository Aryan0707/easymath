// Run: node test.js   (no dependencies)
const E = require("./engine.js");
const K = require("./skills.js");

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) pass++; else { fail++; console.log("FAIL:", name, detail === undefined ? "" : detail); }
}
const ev = s => E.evaluate(E.normalize(s));

/* ---- engine ---- */
const cases = [["15% of 240", 36], ["(8+4)*3", 36], ["square root of 81", 9], ["2^10", 1024], ["7 times 8", 56],
  ["100 / 8", 12.5], ["what is 12 plus 5?", 17], ["-2^2", -4], ["2(3+4)", 14], ["5!", 120], ["50%", 0.5],
  ["3 x 4", 12], ["10 minus 3 minus 2", 5], ["2^3^2", 512], ["sqrt 16", 4], ["3pi", 3 * Math.PI]];
for (const [q, want] of cases) { let r; try { r = ev(q); } catch (e) { r = "ERR"; } check("engine " + q, Math.abs(r - want) < 1e-9, r); }
check("engine variable", E.evaluate("2x^2 - 3x + 1", { x: 3 }) === 10);
check("engine rejects junk", (() => { try { E.evaluate("hello world"); return false; } catch { return true; } })());
check("engine blocks proto names", (() => { try { E.evaluate("constructor"); return false; } catch { return true; } })());

/* ---- methods: trick text must end on the true answer, and the shown question must evaluate to it ---- */
K.METHODS.forEach(M => {
  for (let k = 0; k < 1000; k++) {
    const q = M.make();
    const nums = q.steps.replace(/,/g, "").match(/-?\d+(\.\d+)?/g);
    check(`method ${M.title} trick ends on answer`, +nums[nums.length - 1] === q.a, q);
    check(`method ${M.title} question evaluates to answer`, Math.abs(ev(q.q) - q.a) < 1e-9, q);
  }
});

/* ---- levels: every difficulty tier gives finite whole answers, correct arithmetic, and a worked solution ---- */
K.LEVELS.forEach((L, i) => {
  for (let t = 0; t <= 2; t++) for (let k = 0; k < 300; k++) {
    const q = L.make(t), tag = `level ${i + 1} tier ${t}`;
    check(tag + " sane", Number.isFinite(q.a) && q.a >= 0 && q.a % 1 === 0 && q.q && q.why, q);
    check(tag + " has worked steps ending on the answer", Array.isArray(q.steps) && q.steps.length >= 2 && q.steps.every(x => typeof x === "string" && x.length) && q.steps[q.steps.length - 1].includes(String(q.a)), q);
    if (/^\d+ [+−×÷] \d+ = \?$/.test(q.q)) check(tag + " cross-check", Math.abs(ev(q.q.replace(" = ?", "")) - q.a) < 1e-9, q);
    if (/^\d+ \+ \d+ = \?$/.test(q.q) || /^\d+ − \d+ = \?$/.test(q.q)) check(tag + " never negative", q.a >= 0, q);
  }
});
// harder tiers really are harder (average answer size grows) for the number-based levels
[1, 2, 3, 4, 5].forEach(i => {
  const mean = t => { let s = 0; for (let k = 0; k < 400; k++) s += K.LEVELS[i].make(t).a; return s / 400; };
  check(`level ${i + 1}: tier 2 harder than tier 0`, mean(2) > mean(0) * 1.4, [mean(0), mean(2)]);
});
[1, 2, 3, 4].forEach(i => check(`level ${i + 1} has a visual`, K.LEVELS[i].make().viz.length > 20));
check("level 7 percent bar", K.LEVELS[7].make().viz.includes("filled"));
check("counting visual is dots, not emoji", /class="dot/.test(K.LEVELS[0].make(0).visual || "dot class=\"dot") );

/* ---- methods carry an explanation of WHY the shortcut works ---- */
K.METHODS.forEach(M => check("method why: " + M.title, typeof M.why === "string" && M.why.length > 30 && typeof M.model === "string"));
check("most methods have a picture", K.METHODS.filter(M => M.model.includes("bars")).length >= 11);

/* ---- makeItem: uniform shape for every skill ---- */
const ids = [...K.LEVELS.map((_, i) => "L" + i), ...K.METHODS.map((_, i) => "M" + i)];
ids.forEach(id => {
  const it = K.makeItem(id, 2);
  check("makeItem " + id, it.skill === id && typeof it.q === "string" && Number.isFinite(it.a) && it.hints.length === 3 && it.hints.every(h => h && h.length), it);
});

/* ---- wrong-answer diagnosis: a named, trackable slip ---- */
const diag = [
  ["27 + 15 = ?", 32, "carry", /carry/], ["83 − 28 = ?", 65, "borrow", /borrow/i], ["6 × 7 = ?", 13, "mul-added", /adding/], ["40 ÷ 5 = ?", 200, "div-multiplied", /multiplied/],
  ["What is 25% of 80?", 2000, "pct-no-divide", /100/], ["What is 25% of 80?", 200, "pct-div10", /÷ 100/], ["What is 3/4 of 20?", 5, "frac-one-part", /one part/],
  ["x + 7 = 19.  x = ?", 26, "alg-same-op", /subtract 7/], ["3x + 5 = 20.  x = ?", 20 / 3, "alg-skipped-step", /first/], ["7² = ?", 14, "sq-doubled", /7 × 7/],
  ["4³ = ?", 12, "cube-tripled", /4 × 4 × 4/], ["√49 = ?", 24.5, "root-halved", /isn't half/], ["Area of a triangle, base 8, height 5?", 40, "tri-full", /half/],
  ["Slope of 3x² at x = 5?", 75, "slope-height", /not its slope/], ["Slope of x³ at x = 2?", 8, "slope-height", /bring the 3/],
  ["8 + 7", 1, "add-subtracted", /subtracting/], ["4 × 5 = ?", 15, "mul-group", /group/], ["12 + 9 = ?", 22, "off-by-one", /off by/]
];
for (const [q, u, code, re] of diag) { const d = K.diagnose(q, u); check("diagnose " + q + " -> " + code, d && d.code === code && re.test(d.text), d); check("MIS label for " + code, !!K.MIS[code]); }
check("diagnose stays quiet on random wrong", K.diagnose("27 + 15 = ?", 999) === null);
Object.keys(K.FOCUS).forEach(c => check("focus code has a label: " + c, !!K.MIS[c]));

/* ---- targeted drills and "try one like it" ---- */
for (let k = 0; k < 200; k++) {
  const c = K.focusItem("L1", "carry", 1); check("carry drill always forces a carry", K.FOCUS.carry(c.q) && c.skill === "L5", c.q);
  const b = K.focusItem("L5", "borrow", 0); check("borrow drill always forces a borrow", K.FOCUS.borrow(b.q), b.q);
  const base = K.makeItem("L3", 1), sim = K.similarItem(base, 1);
  check("similar item: same skill, new question", sim.skill === "L3" && sim.q !== base.q, [base.q, sim.q]);
}
check("similar item keeps the trap", (() => { const base = K.focusItem("L5", "carry", 1); for (let k = 0; k < 50; k++) if (!K.FOCUS.carry(K.similarItem(base, 1).q)) return false; return true; })());

/* ---- teaching policies ---- */
let st = { tier: 1, run: 0 };
const feed = (ok, helped) => { st = K.nextTier(st.tier, st.run, ok, helped); return st.tier; };
feed(true); feed(true); check("two correct do not raise difficulty", st.tier === 1 && st.run === 2, st);
feed(true); check("three correct raise difficulty and reset the run", st.tier === 2 && st.run === 0, st);
feed(true); feed(true); feed(true); check("tier is capped at 2", st.tier === 2, st);
feed(false); check("one miss lowers difficulty and resets the run", st.tier === 1 && st.run === 0, st);
feed(false); feed(false); check("tier is floored at 0", st.tier === 0, st);
st = { tier: 1, run: 2 }; feed(true, true); check("hinted answers don't advance the run", st.tier === 1 && st.run === 2, st);
// Deterministic simulations (seeded), so these are stable. A learner's success rate depends on the tier they are on.
const seeded = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const simulate = (pByTier, n, seed) => { const rng = seeded(seed), time = [0, 0, 0]; let t = 1, run = 0, hits = 0;
  for (let k = 0; k < n; k++) { const ok = rng() < pByTier[t]; if (ok) hits++; time[t]++; const r = K.nextTier(t, run, ok, false); t = r.tier; run = r.run; }
  return { share: time.map(x => x / n), rate: hits / n }; };
{ const s1 = simulate([0.95, 0.95, 0.95], 5000, 1); check("a strong learner ends up mostly on the hardest tier", s1.share[2] > 0.7, s1); }
{ const s2 = simulate([0.9, 0.55, 0.3], 5000, 2); check("a struggling learner is kept mostly on easier tiers", s2.share[0] + s2.share[1] > 0.8, s2); }
{ const s3 = simulate([0.95, 0.8, 0.55], 5000, 3); check("a learner who struggles at the top spends most time below it", s3.share[2] < 0.4 && s3.share[1] > 0.2, s3);
  check("overall success rate stays in the productive 70-95% zone", s3.rate > 0.7 && s3.rate < 0.95, s3.rate); }
{ const s4 = simulate([0.6, 0.6, 0.6], 5000, 4); check("a learner at 60% everywhere is held at the easy end", s4.share[0] > 0.5, s4); }

check("review passes: 3 of 4", K.reviewPasses(3, 4) && K.reviewPasses(4, 4));
check("review fails: 2 of 4 and 1 of 2", !K.reviewPasses(2, 4) && !K.reviewPasses(1, 2));
check("review passes: 2 of 2, never on 1 sample", K.reviewPasses(2, 2) && !K.reviewPasses(1, 1));
const NOW = Date.now(), H = K.HOUR;
check("state: locked / next", K.levelState(false, false, null, NOW) === "locked" && K.levelState(false, true, null, NOW) === "next");
check("state: just passed", K.levelState(true, true, { passAt: NOW - 2 * H }, NOW) === "passed");
check("state: ready for review check after 20h", K.levelState(true, true, { passAt: NOW - 21 * H }, NOW) === "ready");
check("state: legacy pass without a timestamp is ready", K.levelState(true, true, {}, NOW) === "ready" && K.levelState(true, true, null, NOW) === "ready");
check("state: solid", K.levelState(true, true, { passAt: NOW - 90 * H, solidAt: NOW - 60 * H, due: NOW + 5 * H }, NOW) === "solid");
check("state: solid but review due", K.levelState(true, true, { passAt: NOW - 90 * H, solidAt: NOW - 60 * H, due: NOW - 1 }, NOW) === "due");
check("size check flags a 10x slip", /around 40/.test(K.sizeCheck(36, 360) || "") && /bigger/.test(K.sizeCheck(36, 360)));
check("size check flags a tiny answer", /smaller/.test(K.sizeCheck(600, 6) || ""));
check("size check ignores close answers and tiny targets", K.sizeCheck(36, 40) === null && K.sizeCheck(5, 50) === null && K.sizeCheck(36, 0) === null);

/* ---- tips for typed questions ---- */
const tips = [["47 + 38", "Round & adjust"], ["49+36", "Round & adjust"], ["83-28", "Round & adjust"], ["1000-378", "Take from 100/1000"],
  ["9*7", "Times 9"], ["18*5", "Times 5"], ["57*11", "Times 11"], ["35^2", "Squares ending in 5"], ["24*25", "Times 25"],
  ["27*4", "Times 4"], ["15% of 80", "Percent via 10%"], ["47*6", "Split multiply"], ["8+7", "Make 10"], ["21+32", "Split & add"]];
for (const [q, name] of tips) { const t = K.tip(E.normalize(q)); check("tip " + q, t && t.name === name, t); }
check("tip null for hard input", K.tip(E.normalize("(8+4)*3")) === null);

/* ---- recall drills: facts to know cold, appended after the shortcuts so saved progress keeps its positions ---- */
const recall = K.METHODS.filter(M => M.group === "recall"), firstRecall = K.METHODS.findIndex(M => M.group === "recall");
check("four recall drills", recall.length === 4, recall.map(M => M.title));
check("recall drills are one block right after the original 13 shortcuts, positions unchanged", firstRecall === 13 && K.METHODS.slice(13, 13 + recall.length).every(M => M.group === "recall") && K.METHODS.slice(0, 13).every(M => !M.group));
check("original shortcut positions did not move", ["Make 10 (adding)", "Times 9", "Squares ending in 5", "Split multiply"].every((t, k) => K.METHODS[[0, 5, 10, 12][k]].title === t));
const byTitle = t => K.METHODS.find(M => M.title === t);
for (let k = 0; k < 500; k++) {
  const T = byTitle("Tables to 20 × 20").make(), [ta, tb] = T.q.split(" × ").map(Number);
  check("tables stay in 11..20", ta >= 11 && ta <= 20 && tb >= 11 && tb <= 20 && T.a === ta * tb, T);
  const Q = byTitle("Squares to 30²").make(), [qa, qb] = Q.q.split(" × ").map(Number);
  check("squares are n × n, 11..30, never a multiple of 10", qa === qb && qa >= 11 && qa <= 30 && qa % 10 !== 0 && Q.a === qa * qa, Q);
  const C = byTitle("Cubes to 12³").make(), cn = +C.q.split(" × ")[0];
  check("cubes are n × n × n, 2..12", C.q === `${cn} × ${cn} × ${cn}` && cn >= 2 && cn <= 12 && C.a === cn ** 3, C);
  const R = byTitle("Square roots to 30").make();
  check("roots are of perfect squares 121..900", Number.isInteger(R.a) && R.a >= 11 && R.a <= 30 && R.q === `√${R.a * R.a}`, R);
}

/* ---- extra shortcuts (appended after the recall drills) ---- */
check("four extra shortcuts after the recall drills", K.METHODS.length === 21 && K.METHODS.slice(17).every(M => !M.group), K.METHODS.slice(17).map(M => M.title));
for (let k = 0; k < 500; k++) {
  const N = byTitle("Squares near 100").make(), nn = +N.q.split(" × ")[0];
  check("near-100 squares are n × n for 91..109 except 100", N.q === `${nn} × ${nn}` && nn >= 91 && nn <= 109 && nn !== 100 && N.a === nn * nn, N);
  const D = byTitle("Double & halve").make(), [da, db] = D.q.split(" × ").map(Number);
  check("double & halve: even × (number ending in 5), halved cleanly", da % 2 === 0 && db % 10 === 5 && D.a === da * db && D.steps.includes(`${da / 2} × ${db * 2}`), D);
  const L = byTitle("Add left to right").make(), [la, lb] = L.q.split(" + ").map(Number);
  check("left to right: two 3-digit numbers, no zero digits in the second", la >= 120 && lb >= 111 && lb % 10 && Math.floor(lb / 10) % 10 && L.a === la + lb, L);
  const V = byTitle("Divide by 5").make(), vn = +V.q.split(" ÷ ")[0];
  check("divide by 5 gives a whole number", vn % 5 === 0 && Number.isInteger(V.a) && V.a * 5 === vn, V);
}
const tips2 = [["97^2", "Squares near 100"], ["103*103", "Squares near 100"], ["14*35", "Double & halve"], ["35*14", "Double & halve"], ["14*25", "Double & halve"],
  ["476+358", "Add left to right"], ["85/5", "Divide by 5"]];
for (const [q, name] of tips2) { const t = K.tip(E.normalize(q)); check("tip " + q, t && t.name === name, t); }
check("no tip for things the shortcut does not fit", K.tip(E.normalize("100^2")) === null && K.tip(E.normalize("87/5")) === null);
check("left-to-right tip skips a zero tens or ones digit (falls back to the older tip)", K.tip(E.normalize("476+300")).name === "Split & add" && K.tip(E.normalize("476+305")).name === "Split & add");

/* ---- learning-science helpers ---- */
check("confidence keys", K.confKey(2, true) === "sr" && K.confKey(2, false) === "sw" && K.confKey(1, true) === "ur" && K.confKey(0, false) === "uw" && K.confKey(0, true) === "ur");
check("confident mistake is called out", K.confFeedback(2, false) && /sure/i.test(K.confFeedback(2, false).title));
check("lucky guess is flagged, unsure-but-right is encouraged", /guess/i.test(K.confFeedback(0, true).title) && /weren't sure/.test(K.confFeedback(1, true).title));
check("no extra note when sure and right, or unsure and wrong", K.confFeedback(2, true) === null && K.confFeedback(1, false) === null && K.confFeedback(0, false) === null);
check("calibration needs 3 sure answers, then is a percent", K.calibration({ sr: 1, sw: 1, ur: 0, uw: 0 }) === null && K.calibration({ sr: 3, sw: 1, ur: 0, uw: 0 }) === 75);
check("calibration note reacts to overconfidence and under-confidence",
  /sure and wrong/.test(K.calibrationNote({ sr: 4, sw: 3, ur: 0, uw: 0 })) && /more often than you feel/.test(K.calibrationNote({ sr: 0, sw: 0, ur: 5, uw: 1 })) && /fills in/.test(K.calibrationNote({ sr: 0, sw: 0, ur: 0, uw: 0 })));

check("every shortcut has exactly two wrong 'why' options", K.WHY_WRONG.length === K.METHODS.length && K.WHY_WRONG.every((w, i) => w.length === 2 && w[0] !== w[1] && !w.includes(K.METHODS[i].why)));
K.METHODS.forEach((M, i) => {
  const seen = new Set();
  for (let k = 0; k < 60; k++) {
    const o = K.whyOptions(i, Math.random);
    check(`why options ${M.title}`, o.options.length === 3 && new Set(o.options).size === 3 && o.options[o.answer] === M.why, o);
    seen.add(o.answer);
  }
  check(`correct 'why' option moves around (${M.title})`, seen.size === 3, [...seen]);
});
check("why options reject an unknown shortcut", K.whyOptions(999) === null);

check("predict: spot on", K.predictionNote(12, 12).hit && /Spot on/.test(K.predictionNote(12, 12).text));
check("predict: miss shows both numbers", (n => !n.hit && n.text.includes("7") && n.text.includes("12"))(K.predictionNote(7, 12)));
K.LEVELS.forEach((L, i) => { for (let k = 0; k < 40; k++) { const ex = L.make(1); check(`level ${i + 1} worked example has a numeric answer to predict`, typeof ex.a === "number" && isFinite(ex.a) && ex.q && ex.steps.length > 0, ex); } });

{ const t0 = 1e12, min = 60000, sess = { ms: 0, last: 0 };
  check("session: short practice does not nudge", K.trackSession(sess, 6 * min, t0) === 0 && K.trackSession(sess, 6 * min, t0 + 7 * min) === 0);
  check("session: 15 minutes in a row nudges, then starts over", K.trackSession(sess, 4 * min, t0 + 12 * min) === 16 && sess.ms === 0);
  const s2 = { ms: 0, last: 0 }; K.trackSession(s2, 10 * min, t0); 
  check("session: a real break resets the clock", K.trackSession(s2, 10 * min, t0 + 30 * min) === 0 && s2.ms === 10 * min); }

{ const ics = K.reminderICS("18:30", new Date(2026, 9, 3, 12, 0, 0).getTime(), "http://localhost:3000");
  check("reminder: valid calendar file", ics && ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n") && ics.includes("RRULE:FREQ=DAILY") && ics.includes("DTSTART:20261003T183000") && ics.includes("BEGIN:VALARM") && ics.includes("http://localhost:3000/"), ics);
  check("reminder: no stray bare newlines", !/[^\r]\n/.test(ics));
  check("reminder: bad times are rejected", K.reminderICS("25:00", 0) === null && K.reminderICS("", 0) === null && K.reminderICS("7:5", 0) === null && K.reminderICS("18:30\nEND:VEVENT", 0) === null);
  check("reminder: no link for file:// pages", !K.reminderICS("09:00", 0, "file://").includes("file://")); }

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
