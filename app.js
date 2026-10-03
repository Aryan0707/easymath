/* EasyMath UI. Logic lives in engine.js (math) and skills.js (curriculum + teaching policies); icons in icons.js. */
(function () {
  const { LEVELS, METHODS, makeItem, skillName, skillGlyph, tip, diagnose, pick, MIS, FOCUS, focusItem, similarItem,
          nextTier, reviewPasses, levelState, sizeCheck, HOUR,
          confFeedback, confKey, calibration, calibrationNote, whyOptions, predictionNote, trackSession, reminderICS } = Skills;
  const { normalize, evaluate, fmt } = Engine;
  const I = Icons.icon;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;
  const pct = (c, n) => (n ? Math.round((c / n) * 100) + "%" : "n/a");

  /* ================= progress (saved in this browser) ================= */
  const KEY = "easymath", DAY = 86400000, GOAL = 10, BOX_DAYS = [0, 1, 3, 7, 14], SPEED_UNLOCK = 8;
  const blank = () => ({ passed: [], speed: {}, timed: {}, stats: {}, days: {}, missed: [], mis: {}, placed: false,
    conf: { sr: 0, sw: 0, ur: 0, uw: 0 }, pred: { n: 0, c: 0 }, why: { n: 0, c: 0 }, remind: "" });
  const num = v => (typeof v === "number" && isFinite(v) ? v : 0);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Used for loading AND importing, so an edited/foreign file can never inject markup or break the app.
  function sanitize(o) {
    const d = blank(); if (!o || typeof o !== "object") return d;
    if (Array.isArray(o.passed)) d.passed = [...new Set(o.passed.filter(n => Number.isInteger(n) && n >= 0 && n < LEVELS.length))];
    if (o.speed && typeof o.speed === "object") for (const k in o.speed) if (/^\d+$/.test(k) && +k < METHODS.length && num(o.speed[k]) > 0) d.speed[k] = o.speed[k];
    if (o.timed && typeof o.timed === "object") for (const k in o.timed) if (/^\d+$/.test(k) && +k < METHODS.length && o.timed[k] === true) d.timed[k] = true;
    if (o.stats && typeof o.stats === "object") for (const k in o.stats) {
      const s = o.stats[k]; if (!/^[LM]\d+$/.test(k) || !s || typeof s !== "object") continue;
      if (+k.slice(1) >= (k[0] === "L" ? LEVELS.length : METHODS.length)) continue;
      d.stats[k] = { n: num(s.n), c: num(s.c), acc: s.acc == null ? null : num(s.acc), ms: s.ms == null ? null : num(s.ms), box: clamp(num(s.box), 0, 4), due: num(s.due),
        tier: s.tier == null ? 1 : clamp(Math.round(num(s.tier)), 0, 2), run: clamp(Math.round(num(s.run)), 0, 2), passAt: num(s.passAt), solidAt: num(s.solidAt),
        firstAt: num(s.firstAt) || Date.now(), en: num(s.en), ec: num(s.ec), ln: num(s.ln), lc: num(s.lc), tn: num(s.tn), tc: num(s.tc), sw: clamp(Math.round(num(s.sw)), 0, 99) };
    }
    if (o.mis && typeof o.mis === "object") for (const k in o.mis) {
      const [code, sk] = k.split("|"); if (MIS[code] && /^[LM]\d+$/.test(sk || "") && num(o.mis[k]) > 0) d.mis[k] = Math.min(999, Math.round(o.mis[k]));
    }
    if (o.days && typeof o.days === "object") for (const k in o.days) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && num(o.days[k]) > 0) d.days[k] = o.days[k];
    if (Array.isArray(o.missed)) d.missed = o.missed.filter(m => m && /^[LM]\d+$/.test(m.skill) && typeof m.q === "string" && typeof m.a === "number" && isFinite(m.a))
      .slice(-30).map(m => ({ skill: m.skill, q: m.q.slice(0, 120), a: m.a, expl: String(m.expl || "").slice(0, 300), hints: (Array.isArray(m.hints) ? m.hints : []).slice(0, 3).map(h => String(h || "").slice(0, 300)), due: num(m.due) }));
    d.placed = !!o.placed;
    const cnt = v => clamp(Math.round(num(v)), 0, 1e6);
    if (o.conf && typeof o.conf === "object") for (const k of ["sr", "sw", "ur", "uw"]) d.conf[k] = cnt(o.conf[k]);
    for (const k of ["pred", "why"]) if (o[k] && typeof o[k] === "object") { d[k].n = cnt(o[k].n); d[k].c = Math.min(d[k].n, cnt(o[k].c)); }
    if (typeof o.remind === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(o.remind)) d.remind = o.remind;
    return d;
  }
  let progress = blank();
  try { progress = sanitize(JSON.parse(localStorage.getItem(KEY) || "null")); } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch {} };

  const dayKey = d => d.toLocaleDateString("en-CA");
  const dayCount = k => progress.days[k] || 0;
  function streak() {
    let s = 0; const d = new Date();
    if (dayCount(dayKey(d)) < GOAL) d.setDate(d.getDate() - 1);   // today may still be in progress
    while (dayCount(dayKey(d)) >= GOAL) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }
  const isUnlocked = i => i === 0 || progress.passed.includes(i - 1);
  const ensureStat = id => progress.stats[id] || (progress.stats[id] = { n: 0, c: 0, acc: null, ms: null, box: 0, due: 0, tier: 1, run: 0, passAt: 0, solidAt: 0, firstAt: Date.now(), en: 0, ec: 0, ln: 0, lc: 0, tn: 0, tc: 0, sw: 0 });
  const tierOf = id => (progress.stats[id] ? progress.stats[id].tier : 1);
  const lvState = i => levelState(progress.passed.includes(i), isUnlocked(i), progress.stats["L" + i], Date.now());

  /* ---- mastery gate: how strict is "passed"? (tune this to your learners) ---- */
  function isLevelPassed(correct, total) { return correct / total >= 0.8; }

  /* ---- per-answer recording ---- */
  const sameQ = (m, it) => m.skill === it.skill && m.q === it.q;
  function noteMis(code, skill) { const k = code + "|" + skill; progress.mis[k] = Math.min(999, (progress.mis[k] || 0) + 1); return k; }
  function record(item, ok, ms, helped, conf) {
    const st = ensureStat(item.skill), k = dayKey(new Date());
    progress.days[k] = (progress.days[k] || 0) + 1;
    if (item.retry) {                                          // "try one like it": tracked apart, so it never inflates mastery
      st.tn++; if (ok) st.tc++;
      if (ok && item.misKey && progress.mis[item.misKey]) progress.mis[item.misKey] = Math.max(0, progress.mis[item.misKey] - 1);
      save(); return;
    }
    st.n++; if (ok) st.c++;
    if (conf != null) {                                        // how sure were you? a confident mistake is the one to fix first
      progress.conf[confKey(conf, ok)]++;
      if (conf === 2) st.sw = ok ? Math.max(0, (st.sw || 0) - 1) : Math.min(99, (st.sw || 0) + 1);
    }
    st.acc = st.acc == null ? (ok ? 1 : 0) : st.acc * 0.7 + (ok ? 1 : 0) * 0.3;
    st.ms = st.ms == null ? ms : st.ms * 0.7 + ms * 0.3;
    if (!helped) {                                             // first-try accuracy: early on vs after time away (the real test of learning)
      if (Date.now() - st.firstAt >= 20 * HOUR) { st.ln++; if (ok) st.lc++; } else { st.en++; if (ok) st.ec++; }
    }
    if (item.skill[0] === "L") { const t = nextTier(st.tier, st.run, ok, helped); st.tier = t.tier; st.run = t.run; }
    progress.missed = progress.missed.filter(m => !sameQ(m, item));
    if (!ok || conf === 0) { progress.missed.push({ skill: item.skill, q: item.q, a: item.a, expl: item.expl || "", hints: item.hints || [], due: Date.now() + DAY }); progress.missed = progress.missed.slice(-30); }
    save();
  }
  // End of a session: schedule the next review, and settle the delayed check (does it hold after time away?).
  function applySession(history) {
    const by = {}, now = Date.now();
    history.forEach(h => { const e = by[h.item.skill] || (by[h.item.skill] = { c: 0, t: 0 }); e.t++; if (h.ok) e.c++; });
    for (const id in by) {
      const e = by[id], st = progress.stats[id]; if (!st || e.t < 2) continue;
      st.box = e.c / e.t >= 0.8 ? Math.min(4, st.box + 1) : 0;
      st.due = now + BOX_DAYS[st.box] * DAY;
      if (id[0] === "L" && st.passAt && now - st.passAt >= 20 * HOUR) {
        if (!st.solidAt && reviewPasses(e.c, e.t)) { st.solidAt = now; st.box = Math.max(st.box, 1); st.due = Math.max(st.due, now + DAY); }   // remembered after time away: solid
        else if (!st.solidAt && e.t >= 2) { st.passAt = now; st.box = 0; st.due = now + DAY; }   // didn't hold: look again tomorrow
        else if (st.solidAt && e.t >= 3 && !reviewPasses(e.c, e.t)) { st.solidAt = 0; st.passAt = now; st.box = 0; st.due = now + DAY; }
      }
    }
    save();
  }

  /* ================= shared UI pieces ================= */
  const tile = (glyph, state, big) => `<span class="tile${big ? " lg" : ""}${state ? " " + state : ""}" aria-hidden="true">${esc(glyph)}</span>`;
  const mark = (kind, title, body) => `<div class="mark ${kind}">${I(kind === "ok" ? "check" : "close", 20)}<div><strong>${title}</strong>${body ? `<p>${body}</p>` : ""}</div></div>`;
  const note = (title, body, extra) => `<div class="note"><strong>${title}</strong><p>${body}</p>${extra || ""}</div>`;
  const steps = (list, cls) => `<ol class="steps${cls ? " " + cls : ""}">${list.map(s => `<li>${esc(s)}</li>`).join("")}</ol>`;

  function ring(c, t, good) {
    const r = 46, C = 2 * Math.PI * r, f = t ? c / t : 0;
    return `<div class="ring${good ? " good" : ""}" role="img" aria-label="${c} of ${t} correct">
      <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true"><circle class="ring-track" cx="60" cy="60" r="${r}"/>
      <circle class="ring-fill" cx="60" cy="60" r="${r}" transform="rotate(-90 60 60)" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-to="${(C * (1 - f)).toFixed(1)}"/></svg>
      <div class="ring-num"><b>${c}</b><span>of ${t}</span></div></div>`;
  }
  function animateRing(host) {
    const el = host.querySelector(".ring-fill"); if (!el) return;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.strokeDashoffset = el.dataset.to; }));
  }
  const result = (head, title, text, buttons) => `<div class="sheet result">${head}<h2>${title}</h2><p>${text}</p><div class="btns">${buttons}</div></div>`;

  function updateHeader() {
    const s = streak(), el = $("streakChip");
    el.className = "streak" + (s ? " on" : ""); el.setAttribute("role", "img");
    el.setAttribute("aria-label", `${plural(s, "day")} streak`); el.title = `${plural(s, "day")} streak`;
    el.innerHTML = I("flame", 16) + `<span>${s}</span>`;
  }

  /* ================= tabs ================= */
  let stopActive = null;
  const sess = { ms: 0, last: 0 };                              // practice time since the last real break
  const TABS = ["learn", "speed", "today", "ask", "progress"];
  function showTab(name) {
    if (stopActive) { stopActive(); stopActive = null; }
    document.querySelectorAll(".nav button").forEach(b => { b.classList.toggle("on", b.dataset.tab === name); b.toggleAttribute("aria-current", b.dataset.tab === name); });
    TABS.forEach(t => $(t).classList.toggle("hidden", t !== name));
    ({ learn: renderMap, speed: renderSpeed, today: renderToday, progress: renderProgress,
       ask: () => { if (!matchMedia("(pointer: coarse)").matches) $("askInput").focus(); } })[name]();
    updateHeader(); window.scrollTo(0, 0);
  }
  document.querySelectorAll(".nav button").forEach(b => b.onclick = () => showTab(b.dataset.tab));

  /* ================= the quiz runner (levels, drills, daily, reviews, level check) =================
     After a miss (when untimed) the learner sees the fix, then gets "one like it" straight away. */
  function runQuiz(host, cfg) {
    let n = 0, correct = 0, conf = null, item, answered = false, stage = 0, qStart, tick, pendingRetry = null, retries = 0, fixed = 0;
    const history = [], t0 = performance.now(), speed = cfg.mode === "speed", canRetry = cfg.retry !== false && !cfg.timer && !cfg.silent;
    const stop = () => { clearInterval(tick); document.onkeydown = null; };
    stopActive = stop;

    function show(forced) {
      item = forced || cfg.next(n, history);
      if (!item) return finish();
      window.__em = { item };                                  // debug/test hook
      answered = false; stage = 0; conf = null; qStart = performance.now();
      const guide = !item.retry && item.guide && item.steps && item.steps.length > 1
        ? `<div class="guided"><b>${item.guide === "most" ? "Worked for you. Finish the last step." : "First step done. Take it from here."}</b>${steps(item.guide === "most" ? item.steps.slice(0, -1) : item.steps.slice(0, 1))}</div>` : "";
      const confHtml = cfg.confidence && !item.retry ? `<div class="conf" role="group" aria-label="How sure are you?"><span class="muted">How sure are you?</span><div class="chips">${
        [[2, "Sure"], [1, "Not sure"], [0, "Guess"]].map(([v, t]) => `<button type="button" class="chip" data-conf="${v}" aria-pressed="false">${t}</button>`).join("")}</div></div>` : "";
      host.innerHTML = `<div class="qhead"><button class="btn text" id="qquit">${I("close", 18)}Exit</button>
        <div style="display:flex;gap:16px;align-items:center">${item.retry ? '<span class="muted">Extra practice</span>' : cfg.counter === false ? "" : `<span class="muted">${n + 1} of ${cfg.total}</span>`}
        ${cfg.timer ? '<span class="timer" id="qtm">0.0 s</span>' : ""}</div></div>
        <div class="bar" style="margin-bottom:14px"><i style="width:${(n / cfg.total) * 100}%"></i></div>
        <div class="work"><div class="skill-name">${item.retry ? "Try one like it. Same idea, new numbers." : esc(cfg.label(item, n))}</div>
          ${item.visual ? `<div class="visual">${item.visual}</div>` : ""}
          <div class="problem${item.q.length > 22 ? " long" : ""}">${esc(item.q)}</div>${guide}${confHtml}
          <div class="entry"><label class="sr" for="ans">Your answer</label>
            <input id="ans" class="field num-field" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" autocapitalize="off" placeholder="Answer">
            <button class="btn primary" id="chk">Check</button></div>
          <div class="qtools">${cfg.noHints ? "" : `<button class="btn text" id="hint">${I("bulb", 18)}Show hint</button>`}</div></div>
        <div id="hintbox"></div><div id="fb" aria-live="polite"></div>`;
      $("qquit").onclick = () => { stop(); stopActive = null; cfg.quit(); };
      const inp = $("ans"); inp.focus();
      host.querySelectorAll("[data-conf]").forEach(b => b.onclick = () => {
        if (answered) return; conf = +b.dataset.conf;
        host.querySelectorAll("[data-conf]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
        inp.focus();
      });
      if (matchMedia("(max-width: 600px)").matches) setTimeout(() => inp.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
      const hb = $("hint");
      if (hb) hb.onclick = () => {
        stage = Math.min(3, stage + 1);
        const parts = [];
        for (let k = 1; k <= stage; k++) {
          if (k === 3) parts.push(note("Full explanation", esc(item.hints[2] || item.expl)));
          else parts.push(note(`Hint ${k}`, esc(item.hints[k - 1]), k === 2 && item.viz ? item.viz : ""));
        }
        $("hintbox").innerHTML = parts.join("");
        if (stage === 3) hb.classList.add("hidden"); else hb.innerHTML = I("bulb", 18) + (stage === 1 ? "More help" : "Show the full answer");
        inp.focus();
      };
      const submit = () => {
        if (answered) return next();
        const raw = inp.value.trim().replace(",", ".");
        const v = raw === "" ? NaN : Number(raw);
        if (isNaN(v)) { inp.focus(); return; }
        const ms = performance.now() - qStart, right = Math.abs(v - item.a) < 0.01, ok = right && stage < 3;
        const rated = cfg.confidence && !item.retry && conf != null ? conf : null;
        if (!cfg.silent) record(item, ok, ms, stage > 0, rated);
        const why = right ? null : diagnose(item.q, v);
        if (item.retry) { retries++; if (ok) fixed++; }
        else { history.push({ item, ok, ms }); if (ok) correct++; }
        if (!item.retry && !ok && why && !cfg.silent) item.misKey = noteMis(why.code, item.skill);
        if (!item.retry && !ok && canRetry) {                  // queue "one like it" for right after the explanation
          const base = Object.assign({}, item, { focus: why && FOCUS[why.code] ? why.code : null });
          pendingRetry = similarItem(base, tierOf(item.skill)); pendingRetry.retry = true; pendingRetry.misKey = item.misKey || null;
        }
        const cn = rated == null ? null : confFeedback(rated, ok), cnHtml = cn ? note(cn.title, esc(cn.text)) : "";
        const why2 = ok && !item.retry && cfg.explain && (correct === 3 || correct === 7) ? cfg.explain(item) : null;   // sometimes ask: why does this work?
        if (ok && speed && !item.retry && !cn && !why2) return next();   // right answer in a drill: move on instantly
        answered = true; inp.disabled = true; if (hb) hb.classList.add("hidden");
        host.querySelectorAll("[data-conf]").forEach(b => { b.disabled = true; });
        const size = right ? null : sizeCheck(item.a, v), viz = item.viz ? `<div class="sheet pad" style="margin-top:14px">${item.viz}</div>` : "";
        $("fb").innerHTML = ok ? mark("ok", item.retry ? "You've got it" : "Correct", esc(item.expl)) + cnHtml + viz
          : right ? mark("bad", "This one doesn't count", `You revealed the answer first. It was ${esc(fmt(item.a))}.`)
          : mark("bad", `Not quite. The answer is ${esc(fmt(item.a))}.`) + (why ? note("Where it went wrong", esc(why.text)) : "")
            + (size ? note("Size check", esc(size)) : "") + note("How to solve it", esc(item.expl)) + cnHtml + viz;
        if (why2) {
          $("fb").insertAdjacentHTML("beforeend", `<div class="explain"><strong>Why does it work?</strong><p>${esc(why2.name)}: which explanation is right?</p>
            <div class="opts" role="group" aria-label="Choose the explanation">${why2.options.map((t, k) => `<button type="button" class="opt" data-k="${k}">${esc(t)}</button>`).join("")}</div><div id="exOut" aria-live="polite"></div></div>`);
          $("fb").querySelectorAll(".opt").forEach(b => b.onclick = () => {
            const k = +b.dataset.k, hit = k === why2.answer;
            $("fb").querySelectorAll(".opt").forEach((o, j) => { o.disabled = true; if (j === why2.answer) o.classList.add("right"); else if (o === b) o.classList.add("wrong"); });
            progress.why.n++; if (hit) progress.why.c++; save();
            $("exOut").innerHTML = hit ? mark("ok", "That's the idea", "") : mark("bad", "Not quite. The real reason:", esc(why2.why));
            $("chk").textContent = "Next"; $("chk").focus({ preventScroll: true });
          });
        }
        const chk = $("chk"); chk.textContent = pendingRetry ? "Try a similar one" : why2 ? "Skip" : "Next"; chk.focus({ preventScroll: true });
        $("fb").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      };
      $("chk").onclick = submit;
      inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); submit(); } };   // submit() moves focus to the button: don't let the same Enter also press it or reach the document handler
      document.onkeydown = e => { if (e.key === "Enter" && answered) submit(); };
    }
    function next() {
      document.onkeydown = null;
      if (pendingRetry) { const r = pendingRetry; pendingRetry = null; return show(r); }
      n++; n < cfg.total ? show() : finish();
    }
    function finish() {
      stop(); stopActive = null;
      if (!cfg.silent) applySession(history);
      updateHeader();
      cfg.finish({ correct, total: history.length, secs: (performance.now() - t0) / 1000, history, retries, fixed });
      animateRing(host);
      const mins = trackSession(sess, performance.now() - t0, Date.now());      // short sessions stick better than one long one
      if (mins) host.insertAdjacentHTML("beforeend", `<div class="note" style="margin-top:16px"><strong>Time for a break</strong><p>You've been practising for about ${plural(mins, "minute")}. Rest for a few minutes, then come back. Short sessions with breaks stick better than one long one.</p></div>`);
    }
    if (cfg.timer) tick = setInterval(() => { const el = $("qtm"); if (el) el.textContent = ((performance.now() - t0) / 1000).toFixed(1) + " s"; }, 100);
    show();
  }

  /* ================= LEARN tab ================= */
  const STATE_UI = {
    locked: { tile: "locked", sub: i => `Complete level ${i} to unlock`, icon: () => I("lock", 18) },
    next:   { tile: "next", sub: () => "Up next", icon: () => I("chevR", 20) },
    passed: { tile: "passed", sub: () => "Passed. Review check opens tomorrow", icon: () => I("check", 20) },
    ready:  { tile: "next", sub: () => "Review check ready", icon: () => I("refresh", 20), pen: true },
    solid:  { tile: "done", sub: () => "Solid. Remembered after time away", icon: () => I("check", 20), ok: true },
    due:    { tile: "next", sub: () => "Review due", icon: () => I("refresh", 20), pen: true }
  };
  function renderMap() {
    const host = $("learn"), states = LEVELS.map((_, i) => lvState(i)), done = progress.passed.length, solid = states.filter(s => s === "solid").length;
    let html = `<h2 class="page-title">Learning path</h2>`;
    if (!progress.placed && done === 0)
      html += `<div class="sheet pad stack" style="margin-bottom:18px"><div><h3>Know some math already?</h3>
        <p class="muted">Answer a few questions and EasyMath skips the levels you've mastered.</p></div>
        <div><button class="btn secondary" id="placeBtn">${I("flag", 18)}Take the level check</button></div></div>`;
    html += `<div class="summary"><span class="muted"><strong style="color:var(--ink)">${solid}</strong> of ${LEVELS.length} levels solid${done > solid ? `, ${done - solid} passed and waiting for a review check` : ""}</span></div>
      <div class="bar"><i style="width:${(solid / LEVELS.length) * 100}%"></i></div>`;
    let zone = "", open = false;
    LEVELS.forEach((L, i) => {
      if (L.zone !== zone) { if (open) html += "</ul>"; zone = L.zone; open = true; html += `<h3 class="group">${zone}</h3><ul class="list">`; }
      const s = states[i], u = STATE_UI[s];
      html += `<li><button class="item" data-i="${i}" ${s === "locked" ? "disabled" : ""}>${tile(L.glyph, u.tile)}
        <span class="txt"><span class="t">${i + 1}. ${L.title}</span><span class="s">${u.sub(i)}</span></span>
        <span class="end" ${u.ok ? 'style="color:var(--right)"' : u.pen ? 'style="color:var(--pen)"' : ""}>${u.icon()}</span></button></li>`;
    });
    host.innerHTML = html + "</ul>";
    host.querySelectorAll(".item").forEach(el => el.onclick = () => openLesson(+el.dataset.i));
    if ($("placeBtn")) $("placeBtn").onclick = startPlacement;
  }

  // A worked example with fresh numbers each time. Predict first (even a wrong guess helps), then the steps appear one at a time.
  function mountStepper(el, L) {
    let ex, shown, guess;                                   // guess: undefined = not asked yet, null = skipped, number = predicted
    const draw = () => {
      const head = `<b>Worked example</b>${ex.visual ? `<div class="visual" style="margin-top:8px">${ex.visual}</div>` : ""}<div class="wq">${esc(ex.q)}</div>`;
      if (guess === undefined) {
        el.innerHTML = head + `<p class="muted">Predict the answer first. Even a wrong guess helps you notice what the steps change.</p>
          <div class="entry predict"><label class="sr" for="pred">Your prediction</label>
            <input id="pred" class="field num-field" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" autocapitalize="off" placeholder="Your guess">
            <button class="btn primary" id="predBtn">Predict</button></div>
          <button class="btn text" id="predSkip">Skip, show the steps</button>`;
        const go = () => {
          const raw = $("pred").value.trim().replace(",", "."), v = raw === "" ? NaN : Number(raw);
          if (isNaN(v)) { $("pred").focus(); return; }
          guess = v; progress.pred.n++; if (predictionNote(v, ex.a).hit) progress.pred.c++; save(); shown = 1; draw();
        };
        $("predBtn").onclick = go; $("pred").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); go(); } };
        $("predSkip").onclick = () => { guess = null; shown = 1; draw(); };
        return;
      }
      const done = shown >= ex.steps.length, pn = done && guess != null ? predictionNote(guess, ex.a) : null;
      el.innerHTML = head + steps(ex.steps.slice(0, shown)) + (pn ? note("Your prediction", esc(pn.text)) : "") +
        `<button class="btn secondary sm" id="stepBtn" style="margin-top:12px">${done ? "See another example" : "Show next step"}</button>`;
      $("stepBtn").onclick = () => { if (done) load(); else { shown++; draw(); } };
    };
    const load = () => { ex = L.make(1); guess = undefined; shown = 0; draw(); };
    load();
  }
  function openLesson(i) {
    const L = LEVELS[i], host = $("learn"), s = lvState(i);
    const intro = { passed: "Passed. A review check opens tomorrow, to see if it stuck.", ready: "A review check is ready: prove you still remember this.",
                    due: "It's been a while. A short review check keeps this solid.", solid: "Solid. You remembered this after time away." }[s];
    host.innerHTML = `<button class="btn text back" id="back">${I("chevL", 18)}All levels</button>
      <div class="lesson-head">${tile(L.glyph, "next", true)}<div><h2 class="page-title">${L.title}</h2><p class="muted">Level ${i + 1} of ${LEVELS.length}</p></div></div>
      ${intro ? `<div class="note" style="margin:0 0 16px"><strong>${s === "solid" ? "Solid" : "Review"}</strong><p>${intro}</p></div>` : ""}
      <p class="prose">${L.lesson}</p>
      <div class="worked stepper" id="stepper"></div>
      <div class="btns">${s === "ready" || s === "due" ? `<button class="btn primary" id="rev">Start review check</button><button class="btn secondary" id="go">Practise</button>`
        : `<button class="btn primary" id="go">Start practice</button>`}<span class="muted">${s === "ready" || s === "due" ? "4 questions" : progress.passed.some(j => j < i) ? "5 questions plus 1 mixed in from an earlier level" : "5 questions, the first two guided"}</span></div>`;
    mountStepper($("stepper"), L);
    $("back").onclick = renderMap; $("go").onclick = () => levelQuiz(i);
    if ($("rev")) $("rev").onclick = () => reviewQuiz(i);
  }
  function levelQuiz(i) {
    const host = $("learn"), id = "L" + i, learning = !progress.passed.includes(i) && ((progress.stats[id] || {}).n || 0) < 6;
    // Interleaving: once you have passed earlier levels, question 4 comes from one of them (a due or shaky one first). It never counts toward this level's pass.
    const earlier = progress.passed.filter(j => j < i).map(j => "L" + j), MIX_AT = 3;
    runQuiz(host, { total: 5 + (earlier.length ? 1 : 0), mode: "practice", confidence: true,
      label: it => it.mixed ? `Mixed in from ${LEVELS[+it.skill.slice(1)].title}` : LEVELS[i].title,
      // New level: question 1 is worked for you, question 2 gives the first step, then you're on your own (faded support).
      next: n => {
        if (earlier.length && n === MIX_AT) { const sid = weightedPick(earlier), it = makeItem(sid, tierOf(sid)); it.mixed = true; return it; }
        const it = makeItem(id, tierOf(id)); if (learning) it.guide = n === 0 ? "most" : n === 1 ? "first" : null; return it;
      },
      quit: () => openLesson(i),
      finish: r => {
        const own = r.history.filter(h => !h.item.mixed), oc = own.filter(h => h.ok).length, mixed = r.history.find(h => h.item.mixed);
        const ok = isLevelPassed(oc, own.length), hasNext = i + 1 < LEVELS.length;
        if (ok && !progress.passed.includes(i)) { progress.passed.push(i); const st = ensureStat(id); if (!st.passAt) st.passAt = Date.now(); save(); }
        host.innerHTML = result(ring(oc, own.length, ok),
          ok ? (hasNext ? `Level ${i + 2} unlocked` : "You've finished the path") : "Not passed yet",
          ok ? `${hasNext ? `${LEVELS[i + 1].title} is next. ` : ""}A review check for this level opens tomorrow: that's what makes it solid.${r.fixed ? ` You also fixed ${plural(r.fixed, "slip")} on the spot.` : ""}`
             : "Review the lesson, then try again. Mistakes are how practice works.",
          `${ok && hasNext ? '<button class="btn primary" id="nx">Next level</button>' : ""}
           <button class="btn ${ok && hasNext ? "secondary" : "primary"}" id="again">${ok ? "Practise again" : "Try again"}</button>
           <button class="btn text" id="map2">All levels</button>`);
        if (mixed) host.querySelector(".result p").insertAdjacentText("beforeend", ` The mixed-in question from ${LEVELS[+mixed.item.skill.slice(1)].title} was ${mixed.ok ? "right" : "missed, so it will come back in your drills"}.`);
        $("again").onclick = () => levelQuiz(i);
        if (ok && hasNext) $("nx").onclick = () => openLesson(i + 1);
        $("map2").onclick = renderMap;
      } });
  }
  // Delayed check: 4 questions on a level you passed at least a day ago. Remember it now and it becomes solid.
  function reviewQuiz(i) {
    const host = $("learn"), id = "L" + i;
    runQuiz(host, { total: 4, mode: "speed", label: () => `Review check: ${LEVELS[i].title}`, next: () => makeItem(id, tierOf(id)), quit: () => openLesson(i),
      finish: r => {
        const solid = lvState(i) === "solid";
        host.innerHTML = result(ring(r.correct, r.total, solid), solid ? "Solid" : "Needs another look",
          solid ? "You remembered this after time away. That's the real test of learning." : "That's normal after a break. Review the lesson, and try again tomorrow.",
          `<button class="btn primary" id="back2">Back to ${esc(LEVELS[i].title)}</button><button class="btn text" id="map2">All levels</button>`);
        $("back2").onclick = () => openLesson(i); $("map2").onclick = renderMap;
      } });
  }

  /* ---- level check: climb the path until you slip twice on one level ---- */
  function startPlacement() {
    const host = $("learn"); let lvl = 0, wrongHere = 0, stoppedAt = null;
    runQuiz(host, { total: 24, mode: "speed", silent: true, noHints: true, counter: false, label: () => "Level check",
      quit: renderMap,
      next: (n, history) => {
        if (n > 0) { const last = history[history.length - 1];
          if (last.ok) { lvl++; wrongHere = 0; } else if (++wrongHere >= 2) { stoppedAt = lvl; return null; } }
        if (lvl >= LEVELS.length) { stoppedAt = LEVELS.length; return null; }
        return makeItem("L" + lvl, 1);
      },
      finish: () => {
        const start = stoppedAt == null ? lvl : stoppedAt;
        for (let i = 0; i < start; i++) if (!progress.passed.includes(i)) { progress.passed.push(i); const st = ensureStat("L" + i); if (!st.passAt) st.passAt = Date.now(); }
        progress.placed = true; save();
        host.innerHTML = result(`<div style="display:flex;justify-content:center">${tile(start >= LEVELS.length ? "∞" : String(start + 1), "next", true)}</div>`,
          start >= LEVELS.length ? "You know it all" : start === 0 ? "Start from level 1" : `Start at level ${start + 1}`,
          start === 0 ? "That's a fine place to begin. Everyone starts somewhere."
            : start >= LEVELS.length ? "Every level is marked passed. Review checks will confirm them tomorrow." : `Levels 1 to ${start} are marked passed. A review check tomorrow will confirm them. Next up: ${LEVELS[start].title}.`,
          '<button class="btn primary" id="toMap">See my path</button>');
        $("toMap").onclick = renderMap;
      } });
  }

  /* ================= SPEED tab: understand, then practise, then race the clock ================= */
  function renderSpeed() {
    const host = $("speed");
    // Grouped by M.group, not by array position: saved progress refers to positions, so new methods are only ever appended.
    const rows = recall => METHODS.map((M, i) => {
      if ((M.group === "recall") !== recall) return "";
      const best = progress.speed[i];
      return `<li><button class="item" data-m="${i}">${tile(M.glyph)}<span class="txt"><span class="t">${M.title}</span><span class="s">${M.example.split("      ")[0]}</span></span>
        <span class="end">${best ? `Best ${best.toFixed(1)} s` : I("chevR", 20)}</span></button></li>`;
    }).join("");
    host.innerHTML = `<h2 class="page-title">Mental math</h2><p class="muted prose" style="margin:-8px 0 20px">Learn a shortcut and why it works, practise it, then race the clock. Drills show numbers only.</p>
      <h3 class="group">Shortcuts</h3><ul class="list">${rows(false)}</ul>
      <h3 class="group">Know it cold</h3><p class="muted prose" style="margin:-4px 0 12px">Facts to recall instantly. Everything else gets faster once these are automatic.</p><ul class="list">${rows(true)}</ul>`;
    host.querySelectorAll(".item").forEach(el => el.onclick = () => openMethod(+el.dataset.m));
  }
  function openMethod(i) {
    const M = METHODS[i], host = $("speed"), timed = !!progress.timed[i];
    host.innerHTML = `<button class="btn text back" id="sback">${I("chevL", 18)}All methods</button>
      <div class="lesson-head">${tile(M.glyph, "next", true)}<h2 class="page-title">${M.title}</h2></div>
      <p class="prose">${M.rule}</p><div class="worked"><b>Worked example</b><div>${M.example}</div></div>
      <div class="note" style="margin:0 0 20px"><strong>Why it works</strong><p>${M.why}</p>${M.model}</div>
      <div class="btns">${timed ? `<button class="btn primary" id="sgo">Start timed drill</button><button class="btn secondary" id="spr">Practise without a timer</button>`
        : `<button class="btn primary" id="spr">Practise without a timer</button><button class="btn secondary" disabled>${I("lock", 16)}Timed drill</button>`}</div>
      ${timed ? "" : `<p class="muted" style="margin-top:10px">The timed drill unlocks when you get ${SPEED_UNLOCK} of 10 right without the clock. Accuracy first, speed second.</p>`}`;
    $("sback").onclick = renderSpeed; $("spr").onclick = () => drill(i, false);
    if ($("sgo")) $("sgo").onclick = () => drill(i, true);
  }
  function drill(i, timed) {
    const M = METHODS[i], host = $("speed");
    runQuiz(host, { total: 10, mode: "speed", timer: timed, label: () => M.title, confidence: !timed,
      explain: timed ? null : it => { const o = whyOptions(+it.skill.slice(1)); return o && Object.assign({ name: METHODS[+it.skill.slice(1)].title }, o); },
      next: () => makeItem("M" + i), quit: () => openMethod(i),
      finish: r => {
        const perfect = r.correct === r.total, prev = progress.speed[i], best = timed && perfect && (!prev || r.secs < prev);
        if (best) { progress.speed[i] = r.secs; save(); }
        const unlocked = !timed && !progress.timed[i] && r.correct >= SPEED_UNLOCK;
        if (unlocked) { progress.timed[i] = true; save(); }
        host.innerHTML = result(ring(r.correct, r.total, r.correct >= SPEED_UNLOCK),
          timed ? (perfect ? (best ? "New best time" : "All correct") : "Keep practising") : unlocked ? "Timed drill unlocked" : r.correct >= SPEED_UNLOCK ? "Accurate" : "Keep practising",
          timed ? `${r.secs.toFixed(1)} seconds, ${(r.secs / r.total).toFixed(1)} per question.${!best && prev ? ` Your best is ${prev.toFixed(1)} seconds.` : ""} ${perfect ? "Now try to beat your time." : "Aim for all correct first, then speed."}`
                : unlocked ? "You're accurate enough to add the clock. Speed comes from accuracy, not the other way round." : r.correct >= SPEED_UNLOCK ? "Good. Run it again, or go to the timed drill." : `You need ${SPEED_UNLOCK} of 10 to unlock the timed drill.${r.fixed ? ` You fixed ${plural(r.fixed, "slip")} straight away.` : ""}`,
          `${timed || progress.timed[i] ? '<button class="btn primary" id="tgo">Timed drill</button>' : ""}<button class="btn ${timed || progress.timed[i] ? "secondary" : "primary"}" id="again">Practise again</button><button class="btn text" id="smap">All methods</button>`);
        $("again").onclick = () => drill(i, false); $("smap").onclick = renderSpeed; if ($("tgo")) $("tgo").onclick = () => drill(i, true);
      } });
  }

  /* ================= TODAY tab: daily mixed drill ================= */
  function skillPool() {
    const pool = [];
    LEVELS.forEach((_, i) => { if (isUnlocked(i)) pool.push("L" + i); });
    METHODS.forEach((_, i) => { if (progress.stats["M" + i]) pool.push("M" + i); });
    return pool;
  }
  function weight(id) {
    const st = progress.stats[id]; if (!st || st.acc == null) return 2;
    return 1 + 4 * (1 - st.acc) + (st.due <= Date.now() ? 2 : 0) + (st.ms > 8000 ? 1 : 0) + Math.min(3, st.sw || 0);
  }
  function weightedPick(ids) {
    const w = ids.map(weight), total = w.reduce((a, b) => a + b, 0); let r = Math.random() * total;
    for (let i = 0; i < ids.length; i++) { r -= w[i]; if (r <= 0) return ids[i]; }
    return ids[ids.length - 1];
  }
  const needsCheck = () => LEVELS.map((_, i) => i).filter(i => { const s = lvState(i); return s === "ready" || s === "due"; });
  function dailyItem(n, history) {
    const seen = new Set(history.map(h => h.item.skill + "|" + h.item.q));
    const checks = needsCheck();
    if (checks.length && Math.random() < 0.5) { const id = "L" + pick(checks); return makeItem(id, tierOf(id)); }   // delayed checks come first
    if (Math.random() < 0.35) {                                   // sometimes re-ask a question you missed earlier
      const due = progress.missed.filter(m => m.due <= Date.now() && !seen.has(m.skill + "|" + m.q));
      if (due.length) { const m = pick(due); return { skill: m.skill, q: m.q, a: m.a, expl: m.expl, hints: m.hints.length === 3 ? m.hints : ["Think it through step by step.", "Break it into smaller parts.", m.expl] }; }
    }
    const id = weightedPick(skillPool()); return makeItem(id, tierOf(id));
  }
  function weekStrip() {
    const cells = [], d = new Date(); d.setDate(d.getDate() - 6);
    for (let i = 0; i < 7; i++) {
      const c = dayCount(dayKey(d));
      cells.push(`<div class="day ${c >= GOAL ? "full" : c > 0 ? "part" : ""} ${i === 6 ? "today" : ""}"><span class="circle">${c >= GOAL ? I("check", 16) : ""}</span>
        <span class="dl">${d.toLocaleDateString(undefined, { weekday: "narrow" })}</span></div>`);
      d.setDate(d.getDate() + 1);
    }
    return `<div class="week" role="img" aria-label="Your last 7 days">${cells.join("")}</div>`;
  }
  function renderToday() {
    const host = $("today"), s = streak(), cnt = dayCount(dayKey(new Date())), now = Date.now(), pool = skillPool();
    const due = pool.filter(id => progress.stats[id] && progress.stats[id].n && progress.stats[id].due <= now).length;
    const retry = progress.missed.filter(m => m.due <= now).length, checks = needsCheck().length;
    const weak = pool.filter(id => progress.stats[id] && progress.stats[id].acc != null && progress.stats[id].acc < 0.7);
    const sure = pool.filter(id => progress.stats[id] && progress.stats[id].sw >= 1);
    const facts = [checks ? `${plural(checks, "review check is", "review checks are")} ready. Today's drill includes them.` : "",
      due ? `${plural(due, "skill is", "skills are")} due for review.` : "", retry ? `${plural(retry, "missed question is", "missed questions are")} ready to retry.` : "",
      weak.length ? `Weak spots: ${weak.slice(0, 3).map(skillName).map(esc).join(", ")}.` : "",
      sure.length ? `You were sure but wrong on: ${sure.slice(0, 3).map(skillName).map(esc).join(", ")}. Today's drill leans on these.` : ""].filter(Boolean);
    host.innerHTML = `<h2 class="page-title">Today</h2>
      <div class="sheet pad"><div class="streak-hero"><b>${s}</b><span class="muted">day streak</span></div>${weekStrip()}
        <div class="bar"><i style="width:${Math.min(100, (cnt / GOAL) * 100)}%"></i></div>
        <p class="muted" style="margin-top:8px">${cnt >= GOAL ? "Today's goal is done." : `${Math.min(cnt, GOAL)} of ${GOAL} questions today. Answer ${GOAL} to keep your streak.`}</p></div>
      <div class="sheet pad" style="margin-top:14px"><h3>Today's drill</h3>
        <p class="muted" style="margin-bottom:14px">${GOAL} mixed questions from the skills you need most. No clock.</p>
        <button class="btn primary" id="dailyGo">${I("play", 18)}Start drill</button>
        ${facts.length ? `<ul class="facts">${facts.map(f => `<li>${f}</li>`).join("")}</ul>` : ""}</div>
      <div class="sheet pad" style="margin-top:14px"><h3>Make it a habit</h3>
        <p class="muted" style="margin-bottom:14px">Ten questions take about five minutes. Short, regular sessions stick better than one long one. Pick a time and your calendar will remind you every day.</p>
        <div class="remind"><label class="sr" for="remTime">Reminder time</label><input id="remTime" class="field text time" type="time" value="${progress.remind || "18:00"}">
          <button class="btn secondary" id="remBtn">${I("calendar", 18)}Add to calendar</button></div>
        <p class="muted" id="remOut" aria-live="polite" style="margin-top:10px"></p></div>`;
    $("dailyGo").onclick = () => daily();
    $("remTime").onchange = e => { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(e.target.value)) { progress.remind = e.target.value; save(); } };
    $("remBtn").onclick = () => {
      const t = $("remTime").value, ics = reminderICS(t, Date.now(), location.origin);
      if (!ics) { $("remOut").textContent = "Choose a time first."; return; }
      progress.remind = t; save();
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "easymath-daily.ics";
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      $("remOut").textContent = "Downloaded. Open the file to add a daily reminder to your calendar.";
    };
  }
  function daily() {
    const host = $("today");
    runQuiz(host, { total: GOAL, mode: "speed", label: it => skillName(it.skill),
      next: dailyItem, quit: renderToday,
      finish: r => {
        const s = streak(), by = {};
        r.history.forEach(h => { by[h.item.skill] = by[h.item.skill] || { c: 0, t: 0 }; by[h.item.skill].t++; if (h.ok) by[h.item.skill].c++; });
        const slip = Object.keys(by).filter(k => by[k].c < by[k].t).map(skillName);
        host.innerHTML = result(ring(r.correct, r.total, r.correct === r.total), s ? `${plural(s, "day")} streak` : "Drill complete",
          `${slip.length ? `To review: ${slip.slice(0, 3).map(esc).join(", ")}. They'll come back in your next drills.` : "Nothing to review."}${r.fixed ? ` You fixed ${plural(r.fixed, "slip")} on the spot.` : ""}`,
          '<button class="btn primary" id="again">Another round</button><button class="btn text" id="done">Done</button>');
        $("again").onclick = daily; $("done").onclick = renderToday;
      } });
  }

  /* ================= PROGRESS tab ================= */
  function totals() {
    const t = { en: 0, ec: 0, ln: 0, lc: 0, tn: 0, tc: 0, n: 0, c: 0 };
    Object.values(progress.stats).forEach(s => { for (const k in t) t[k] += s[k] || 0; });
    return t;
  }
  function reportText() {
    const ids = Object.keys(progress.stats), t = totals(), s = streak();
    const ranked = ids.filter(k => progress.stats[k].acc != null).sort((a, b) => progress.stats[a].acc - progress.stats[b].acc);
    const weak = ranked.filter(k => progress.stats[k].acc < 0.7).slice(0, 3).map(skillName), strong = ranked.slice(-3).reverse().filter(k => progress.stats[k].acc >= 0.8).map(skillName);
    const solid = LEVELS.filter((_, i) => lvState(i) === "solid").length;
    const pats = Object.entries(progress.mis).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => MIS[k.split("|")[0]]);
    return [`EasyMath progress, ${dayKey(new Date())}`, `Streak: ${plural(s, "day")}. Today: ${Math.min(dayCount(dayKey(new Date())), GOAL)} of ${GOAL} questions.`,
      `Levels: ${solid} solid, ${progress.passed.length} passed, of ${LEVELS.length}`, `Questions answered: ${t.n}${t.n ? `. Accuracy: ${pct(t.c, t.n)}` : ""}`,
      `First try, no hints: ${pct(t.ec + t.lc, t.en + t.ln)}. After a day or more: ${pct(t.lc, t.ln)}`,
      `Strong: ${strong.join(", ") || "none yet"}`, `Needs practice: ${weak.join(", ") || "none yet"}`, `Patterns to fix: ${pats.join(", ") || "none yet"}`].join("\n");
  }
  const TIER_NOTE = ["easier numbers", "standard numbers", "bigger numbers"];
  function renderProgress() {
    const host = $("progress"), ids = Object.keys(progress.stats).filter(k => progress.stats[k].n > 0), t = totals();
    ids.sort((a, b) => (progress.stats[a].acc ?? 1) - (progress.stats[b].acc ?? 1));
    const solid = LEVELS.filter((_, i) => lvState(i) === "solid").length;
    let html = `<h2 class="page-title">Progress</h2><div class="sheet stats">
      <div><b>${streak()}</b><span>day streak</span></div><div><b>${t.n}</b><span>answered</span></div>
      <div><b>${pct(t.c, t.n)}</b><span>accuracy</span></div><div><b>${solid}/${LEVELS.length}</b><span>levels solid</span></div></div>`;

    const early = pct(t.ec, t.en), later = pct(t.lc, t.ln), enough = t.ln >= 10 && t.en >= 10;
    const held = enough && t.lc / t.ln >= t.ec / t.en - 0.05;
    html += `<h3 class="group">Is it sticking?</h3><div class="sheet pad"><ul class="kv">
      <li><span>First try, no hints</span><b>${pct(t.ec + t.lc, t.en + t.ln)}</b></li>
      <li><span>Within a day of starting a skill</span><b>${early}</b></li>
      <li><span>A day or more later</span><b>${later}</b></li>
      <li><span>Fixed on the next try after a miss</span><b>${pct(t.tc, t.tn)}</b></li></ul>
      <p class="muted" style="margin-top:12px">${enough ? (held ? "Your accuracy holds up after time away. That's the sign of real learning." : "Accuracy dips after time away. That's normal, and the review checks are there to close the gap.")
        : "This fills in once you've practised on more than one day. Learning shows up after a break, not right after a lesson."}</p></div>`;

    const cf = progress.conf, rated = cf.sr + cf.sw + cf.ur + cf.uw, cal = calibration(cf);
    if (rated + progress.pred.n + progress.why.n > 0) {
      html += `<h3 class="group">Know what you know</h3><div class="sheet pad"><ul class="kv">
        ${rated ? `<li><span>Right when you said "sure"</span><b>${cal == null ? "n/a" : cal + "%"}</b></li>
        <li><span>Sure but wrong (fix these first)</span><b>${cf.sw}</b></li>
        <li><span>Not sure, but right</span><b>${cf.ur}</b></li>` : ""}
        ${progress.pred.n ? `<li><span>Predictions right before the steps</span><b>${pct(progress.pred.c, progress.pred.n)}</b></li>` : ""}
        ${progress.why.n ? `<li><span>"Why does it work" answered right</span><b>${pct(progress.why.c, progress.why.n)}</b></li>` : ""}</ul>
        ${rated ? `<p class="muted" style="margin-top:12px">${calibrationNote(cf)}</p>` : ""}</div>`;
    }
    const pats = Object.entries(progress.mis).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (pats.length) {
      html += `<h3 class="group">Patterns to fix</h3><ul class="list">` + pats.map(([k, v]) => { const [code, sk] = k.split("|");
        return `<li class="skillrow"><div class="body"><div class="t">${esc(MIS[code])}</div><div class="s">${esc(skillName(sk))}, seen ${v} times</div></div>
          <button class="btn secondary sm" data-pat="${k}">Practise this</button></li>`; }).join("") + "</ul>";
    }
    if (ids.length) {
      html += `<h3 class="group">Skills, weakest first</h3><ul class="list">`;
      ids.forEach(id => {
        const st = progress.stats[id], p = Math.round((st.acc ?? 0) * 100);
        html += `<li class="skillrow">${tile(skillGlyph(id))}<div class="body"><div class="t">${esc(skillName(id))}</div>
          <div class="meter"><i style="width:${p}%;background:${p < 60 ? "var(--wrong)" : p < 80 ? "var(--pen)" : "var(--right)"}"></i></div>
          <div class="s">${p}% correct, ${st.n} answered${id[0] === "L" ? `, ${TIER_NOTE[st.tier]}` : ""}</div></div>
          <button class="btn secondary sm" data-skill="${id}">Practise</button></li>`;
      });
      html += "</ul>";
    } else html += `<div class="sheet pad" style="margin-top:14px"><p class="muted">Answer a few questions and your strengths and weak spots will show up here.</p></div>`;
    html += `<h3 class="group">Backup and sharing</h3><div class="sheet pad">
      <p class="muted" style="margin-bottom:14px">Progress is saved in this browser only. Export a backup to move it to another device, or copy a summary for a parent or teacher.</p>
      <div class="btns"><button class="btn secondary sm" id="exp">${I("download", 16)}Export backup</button>
      <button class="btn secondary sm" id="impBtn">${I("upload", 16)}Import backup</button><input type="file" id="imp" accept="application/json,.json" hidden>
      <button class="btn secondary sm" id="rep">${I("copy", 16)}Copy report</button>
      <button class="btn text sm danger" id="rst">Reset progress</button></div><div id="repOut" aria-live="polite"></div></div>`;
    host.innerHTML = html;
    host.querySelectorAll("[data-skill]").forEach(b => b.onclick = () => practiceSkill(b.dataset.skill));
    host.querySelectorAll("[data-pat]").forEach(b => b.onclick = () => focusSession(b.dataset.pat));
    $("impBtn").onclick = () => $("imp").click();
    $("exp").onclick = () => {
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(progress, null, 1)], { type: "application/json" }));
      a.download = "easymath-progress.json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $("imp").onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        if (f.size > 1e6) throw new Error("big");
        const data = sanitize(JSON.parse(await f.text()));
        if (confirm("Replace the progress on this device with the backup?")) { progress = data; save(); showTab("progress"); }
      } catch { $("repOut").innerHTML = mark("bad", "That file isn't a valid EasyMath backup", "Choose a file you exported from Progress."); }
    };
    $("rep").onclick = async () => {
      const r = reportText();
      try { await navigator.clipboard.writeText(r); $("repOut").innerHTML = mark("ok", "Report copied") + `<pre>${esc(r)}</pre>`; }
      catch { $("repOut").innerHTML = `<pre>${esc(r)}</pre>`; }
    };
    $("rst").onclick = () => { if (confirm("Erase ALL progress on this device? This can't be undone.")) { progress = blank(); save(); showTab("progress"); } };
  }
  function practiceSkill(id) {
    showTab("progress"); const host = $("progress");
    runQuiz(host, { total: 10, mode: "speed", label: () => skillName(id),
      next: () => makeItem(id, tierOf(id)), quit: renderProgress,
      finish: r => { host.innerHTML = result(ring(r.correct, r.total, r.correct >= 8), r.correct >= 8 ? "Strong result" : "Keep going",
        r.fixed ? `You fixed ${plural(r.fixed, "slip")} on the spot.` : "Practise again tomorrow to lock it in.", '<button class="btn primary" id="back">Back to progress</button>'); $("back").onclick = renderProgress; } });
  }
  // Drill a specific slip (such as forgetting to carry) with questions built to provoke it.
  function focusSession(key) {
    const [code, skill] = key.split("|"); showTab("progress"); const host = $("progress");
    runQuiz(host, { total: 8, mode: "speed", label: () => MIS[code],
      next: () => focusItem(skill, code, tierOf(FOCUS[code] ? "L5" : skill)), quit: renderProgress,
      finish: r => {
        if (r.correct >= 6 && progress.mis[key]) { progress.mis[key] = Math.max(0, progress.mis[key] - 2); save(); }
        host.innerHTML = result(ring(r.correct, r.total, r.correct >= 6), r.correct >= 6 ? "That pattern is improving" : "Keep at it",
          r.correct >= 6 ? "You handled this slip well. It will fade from your patterns as you keep doing it right." : "This one takes repetition. Try it again tomorrow.", '<button class="btn primary" id="back">Back to progress</button>');
        $("back").onclick = renderProgress;
      } });
  }

  /* ================= ANSWER tab: instant answers, faster-way tips, graphs, AI helper ================= */
  const askInput = $("askInput"), askOut = $("askOut");
  let ai = { ai: false };
  fetch("api/status").then(r => (r.ok ? r.json() : Promise.reject())).then(j => { if (j && j.ai) ai = j; }).catch(() => {});

  function graphExpr(raw) {
    const t = normalize(raw).replace(/^(graph|plot|draw)\s+/, "").replace(/^(y|f\(x\))\s*=\s*/, "").replace(/^of\s+/, "");
    if (!/x/.test(t)) return null;
    try { evaluate(t, { x: 1 }); return t; } catch { return null; }
  }
  function drawGraph(canvas, expr) {
    const ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height, k = W / 600, cs = getComputedStyle(document.documentElement);
    const tok = (n, d) => cs.getPropertyValue(n).trim() || d;
    const muted = tok("--graphite", "#888"), line = tok("--rule", "#ddd"), strong = tok("--rule-strong", "#bbb"), brand = tok("--pen", "#2745C8");
    const f = x => { try { return evaluate(expr, { x }); } catch { return NaN; } };
    const xs = [], ys = [];
    for (let i = 0; i <= 400; i++) { const x = -10 + (20 * i) / 400, y = f(x); xs.push(x); ys.push(y); }
    const fin = ys.filter(y => isFinite(y) && Math.abs(y) < 1e6).sort((a, b) => a - b);
    ctx.font = `${12 * k}px system-ui, sans-serif`;
    if (!fin.length) { ctx.fillStyle = muted; ctx.fillText("Nothing to plot", 20 * k, 30 * k); return; }
    let lo = fin[Math.floor(fin.length * 0.02)], hi = fin[Math.ceil(fin.length * 0.98) - 1];
    lo = Math.min(lo, 0); hi = Math.max(hi, 0); if (hi - lo < 2) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const X = x => ((x + 10) / 20) * W, Y = y => H - ((y - lo) / (hi - lo)) * H;
    const step = [1, 2, 5, 10, 20, 50, 100, 200, 500].find(s => (hi - lo) / s <= 10) || 1000;
    ctx.lineWidth = k;
    for (let gx = -10; gx <= 10; gx += 2) { ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(X(gx), 0); ctx.lineTo(X(gx), H); ctx.stroke(); }
    for (let gy = Math.ceil(lo / step) * step; gy <= hi; gy += step) {
      ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(0, Y(gy)); ctx.lineTo(W, Y(gy)); ctx.stroke();
      ctx.fillStyle = muted; if (gy !== 0) ctx.fillText(String(Number(gy.toFixed(6))), X(0) + 5 * k, Y(gy) - 4 * k);
    }
    ctx.strokeStyle = strong; ctx.lineWidth = 1.5 * k;
    ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), H); ctx.stroke();
    ctx.fillStyle = muted; ctx.textAlign = "center";
    for (let gx = -8; gx <= 8; gx += 2) if (gx) ctx.fillText(String(gx), X(gx), Math.min(H - 4 * k, Y(0) + 16 * k));   // skip ±10: they'd be clipped
    ctx.textAlign = "left";
    ctx.strokeStyle = brand; ctx.lineWidth = 3 * k; ctx.lineJoin = "round"; ctx.beginPath(); let pen = false, prev = NaN;
    for (let i = 0; i < xs.length; i++) {
      const y = ys[i];
      if (!isFinite(y) || y < lo - (hi - lo) || y > hi + (hi - lo) || (isFinite(prev) && Math.abs(y - prev) > (hi - lo) * 0.8)) { pen = false; prev = isFinite(y) ? y : NaN; continue; }
      pen ? ctx.lineTo(X(xs[i]), Y(y)) : ctx.moveTo(X(xs[i]), Y(y)); pen = true; prev = y;
    }
    ctx.stroke();
  }

  const AI_OFF = `<p class="muted">The AI helper is off. To turn it on, start the server with your key: <code>ANTHROPIC_API_KEY=your-key node server.js</code>. See the README. Everything else works without it.</p>`;
  const aiHtml = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  async function askAI(question, image) {
    askOut.classList.remove("hidden");
    if (!ai.ai) { askOut.innerHTML = AI_OFF; return; }
    askOut.innerHTML = `<p class="muted">Working on it…</p>`;
    try {
      const r = await fetch("api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, image }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Something went wrong");
      askOut.innerHTML = `<div class="muted">AI helper</div><div class="aitext">${aiHtml(j.answer)}</div>`;
    } catch (e) { askOut.innerHTML = mark("bad", "The AI helper couldn't answer", esc(e.message)); }
  }
  function ask(enter) {
    const raw = askInput.value.trim();
    if (!raw) { askOut.classList.add("hidden"); return; }
    askOut.classList.remove("hidden");
    try {
      const norm = normalize(raw), v = evaluate(norm), t = tip(norm);
      askOut.innerHTML = `<div class="muted">Answer</div><div class="answer">${esc(fmt(v))}</div>
        <div class="muted">Worked out as <code>${esc(norm)}</code></div>
        ${t ? `<div class="note tip"><strong>${I("bolt", 16)}Faster in your head: ${esc(t.name)}</strong><p>${esc(t.steps)}</p></div>` : ""}`;
      return;
    } catch {}
    const g = graphExpr(raw);
    if (g) {
      askOut.innerHTML = `<div class="muted" style="margin-bottom:10px">Graph of <code>y = ${esc(g)}</code></div><canvas id="gcv" style="width:100%;height:auto;border-radius:10px;display:block"></canvas>`;
      const cv = $("gcv"), w = Math.max(300, cv.clientWidth || 600), dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr); cv.height = Math.round(w * 0.56 * dpr);
      drawGraph(cv, g); return;
    }
    if (enter) { askAI(raw); return; }
    askOut.innerHTML = `<p class="muted">I can solve calculations, percentages, powers and roots, and graph things like <code>x^2 - 4</code>. For word problems or "why" questions, press Enter or use the AI helper.</p>
      <div class="btns" style="margin-top:12px"><button class="btn primary" id="askAi">Ask the AI helper</button></div>`;
    $("askAi").onclick = () => askAI(raw);
  }
  askInput.addEventListener("input", () => ask(false));
  askInput.addEventListener("keydown", e => { if (e.key === "Enter") ask(true); });
  ["15% of 240", "(8+4)*3", "square root of 81", "2^10", "7 times 8", "graph x^2 - 4"].forEach(ex => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = ex;
    b.onclick = () => { askInput.value = ex; ask(false); }; $("examples").appendChild(b);
  });
  function fileToJpegBase64(file) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        res(c.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Couldn't read that image")); };
      img.src = url;
    });
  }
  $("photoBtn").onclick = () => $("photo").click();
  $("photo").onchange = async e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    askOut.classList.remove("hidden");
    if (!ai.ai) { askOut.innerHTML = AI_OFF; return; }
    try { askAI(askInput.value.trim(), { media_type: "image/jpeg", data: await fileToJpegBase64(f) }); }
    catch (err) { askOut.innerHTML = mark("bad", "Couldn't use that photo", esc(err.message)); }
  };

  /* ================= start ================= */
  Icons.hydrate();
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
  showTab("learn");
})();
