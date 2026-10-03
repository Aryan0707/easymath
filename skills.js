/* Curriculum, mental-math methods, visuals, wrong-answer diagnosis and the teaching policies
   (difficulty staircase, delayed-review rule, size check). Pure logic: no DOM, so it is tested in Node. */
(function (root) {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[rnd(0, arr.length - 1)];
  const up10 = n => Math.ceil(n / 10) * 10;
  const byT = (t, a, b, c) => [a, b, c][t];                      // value for difficulty tier 0 / 1 / 2
  const seq = (from, n, dir) => Array.from({ length: n }, (_, k) => from + dir * (k + 1)).join(", ");
  const cum = (b, a) => Array.from({ length: a }, (_, k) => b * (k + 1)).join(", ");
  const est = n => (n >= 100 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10);
  const HOUR = 3600000;

  /* ---------------- visuals (HTML/SVG strings, styled by the page's CSS) ---------------- */
  function numberLine(a, b, sign) {
    const end = a + sign * b, N = Math.max(a, end, 1);
    if (N > 30 || end < 0) return "";
    const W = 320, pad = 14, step = (W - 2 * pad) / N, x = v => pad + v * step;
    const every = step >= 13 ? 1 : 5;
    let ticks = "";
    for (let v = 0; v <= N; v++) {
      ticks += `<line x1="${x(v)}" y1="38" x2="${x(v)}" y2="46" stroke="currentColor" opacity=".5"/>`;
      if (v % every === 0 && v !== a && v !== end)
        ticks += `<text x="${x(v)}" y="60" font-size="10" text-anchor="middle" fill="currentColor" opacity=".7">${v}</text>`;
    }
    const x1 = x(a), x2 = x(end), mid = (x1 + x2) / 2;
    return `<svg viewBox="0 0 ${W} 70" width="100%" style="max-width:420px;display:block;margin:8px auto;color:var(--ink)">
      <line x1="${pad}" y1="42" x2="${W - pad}" y2="42" stroke="currentColor" opacity=".5"/>${ticks}
      <path d="M${x1} 38 Q${mid} -2 ${x2} 38" fill="none" stroke="var(--pen)" stroke-width="2.5"/>
      <circle cx="${x1}" cy="42" r="4.5" fill="var(--graphite)"/><circle cx="${x2}" cy="42" r="5.5" fill="var(--pen)"/>
      <text x="${x1}" y="60" font-size="11" font-weight="700" text-anchor="middle" fill="var(--graphite)">${a}</text>
      <text x="${x2}" y="60" font-size="12" font-weight="800" text-anchor="middle" fill="var(--pen)">${end}</text>
      <text x="${mid}" y="14" font-size="12" font-weight="700" text-anchor="middle" fill="var(--pen)">${sign > 0 ? "+" : "−"}${b}</text></svg>`;
  }
  const dots = (n, cls) => `<span class="dots">${`<i class="dot ${cls || ""}"></i>`.repeat(n)}</span>`;
  function arrayGrid(rows, cols) {
    if (rows > 9 || cols > 9) return "";
    return `<div class="dotgrid" style="--cols:${cols}" role="img" aria-label="${rows} rows of ${cols} dots">${`<i class="dot"></i>`.repeat(rows * cols)}</div>
      <div class="cap">${rows} rows of ${cols}</div>`;
  }
  function fractionBar(n, d, m) {
    let cells = "";
    for (let i = 0; i < d; i++) cells += `<div class="fcell${i < n ? " on" : ""}">${m / d}</div>`;
    return `<div class="fbar" role="img" aria-label="${m} split into ${d} equal parts, ${n} shaded">${cells}</div>
      <div class="cap">${m} split into ${d} equal parts of ${m / d}. Shade ${n} of them.</div>`;
  }
  function percentBar(p) {
    return `<div class="pbar" role="img" aria-label="${p} percent filled"><div class="pfill" style="width:${p}%"></div></div>
      <div class="cap pscale"><span>0%</span><span>${p}% filled</span><span>100%</span></div>`;
  }
  function rectSvg(a, b) {
    return `<svg viewBox="0 0 220 120" width="100%" style="max-width:300px;display:block;margin:6px auto">
      <rect x="40" y="20" width="140" height="70" fill="var(--pen)" fill-opacity=".22" stroke="var(--pen)" stroke-width="2.5"/>
      <text x="110" y="14" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)">${a}</text>
      <text x="196" y="60" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)">${b}</text></svg>`;
  }
  function triSvg(base, h) {
    return `<svg viewBox="0 0 220 120" width="100%" style="max-width:300px;display:block;margin:6px auto">
      <polygon points="40,95 180,95 110,22" fill="var(--pen)" fill-opacity=".22" stroke="var(--pen)" stroke-width="2.5"/>
      <line x1="110" y1="22" x2="110" y2="95" stroke="var(--graphite)" stroke-dasharray="4 3"/>
      <text x="110" y="112" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)">base ${base}</text>
      <text x="118" y="62" font-size="13" font-weight="700" fill="var(--ink)">h ${h}</text></svg>`;
  }
  // Bars that show WHY a shortcut works (sized for legibility, not strictly to scale). kind: on (solid), alt (tinted), minus (dashed, taken away), ghost (grey).
  function barModel(segs, caption) {
    return `<div class="bars" role="img" aria-label="${caption}">${segs.map(s => `<div class="seg ${s.kind || "on"}" style="flex:${Math.max(s.v, 1)} 1 0"><span>${s.label}</span></div>`).join("")}</div>
      <div class="cap">${caption}</div>`;
  }

  /* ---------------- curriculum: beginner -> advanced ----------------
     make(t): t is the difficulty tier (0 easier, 1 standard, 2 harder). Every question carries `steps`
     (a worked solution, last step = the answer) used for worked examples that fade away as you improve. */
  const LEVELS = [
    { zone: "Beginner", glyph: "123", title: "Counting",
      lesson: "Counting means saying numbers in order: 1, 2, 3… Each new number is exactly one more than the one before.",
      example: "● ● ● is 3. Add one more ● and it's 4.",
      hint: "Touch each item once and say the numbers in order.",
      make(t = 1) { const n = rnd(1, byT(t, 5, 10, 10)), m = rnd(1, byT(t, 9, 20, 99));
        return pick([
          () => ({ visual: dots(n), q: "How many dots?", a: n, why: `Count them one by one: there are ${n}.`,
                   steps: ["Touch each dot once.", "Say the numbers in order as you go.", `The last number you say is ${n}.`] }),
          () => ({ q: `What number comes right after ${m}?`, a: m + 1, why: `After ${m} comes ${m + 1}.`,
                   steps: [`Start at ${m}.`, "The next number is one more.", `${m} + 1 = ${m + 1}.`] }),
          () => ({ q: `What number comes right before ${m + 1}?`, a: m, why: `Before ${m + 1} comes ${m}.`,
                   steps: [`Start at ${m + 1}.`, "The number before is one less.", `${m + 1} − 1 = ${m}.`] })
        ])(); } },
    { zone: "Beginner", glyph: "+", title: "Adding",
      lesson: "Adding means putting groups together to find the total. Start at one number and count up by the other.",
      example: "4 + 3: start at 4, count up 3 → 5, 6, 7. So 4 + 3 = 7.",
      hint: "Start at the first number and hop forward by the second.",
      make(t = 1) { const lo = byT(t, 1, 1, 6), hi = byT(t, 5, 10, 20), a = rnd(lo, hi), b = rnd(lo, hi), h = Math.floor(b / 2);
        const steps = b <= 6 ? [`Start at ${a}.`, `Count up ${b}: ${seq(a, b, 1)}.`, `You land on ${a + b}.`]
                             : [`Start at ${a}.`, `Split ${b} into ${h} and ${b - h}: ${a} + ${h} = ${a + h}.`, `${a + h} + ${b - h} = ${a + b}.`];
        return { visual: a <= 10 && b <= 10 ? dots(a) + '<span class="op" aria-hidden="true">+</span>' + dots(b, "b") : undefined,
          viz: numberLine(a, b, 1), q: `${a} + ${b} = ?`, a: a + b, why: `Start at ${a} and count up ${b} more. You land on ${a + b}.`, steps }; } },
    { zone: "Beginner", glyph: "−", title: "Subtracting",
      lesson: "Subtracting means taking away. Start at a number and count backwards.",
      example: "9 − 4: start at 9, count back 4 → 8, 7, 6, 5. So 9 − 4 = 5.",
      hint: "Start at the first number and hop backwards by the second.",
      make(t = 1) { const a = rnd(byT(t, 3, 5, 15), byT(t, 10, 20, 50)), b = rnd(1, a), h = Math.floor(b / 2);
        const steps = b <= 6 ? [`Start at ${a}.`, `Count back ${b}: ${seq(a, b, -1)}.`, `You land on ${a - b}.`]
                             : [`Start at ${a}.`, `Split ${b} into ${h} and ${b - h}: ${a} − ${h} = ${a - h}.`, `${a - h} − ${b - h} = ${a - b}.`];
        return { viz: numberLine(a, b, -1), q: `${a} − ${b} = ?`, a: a - b, why: `Start at ${a} and count back ${b}. You land on ${a - b}.`, steps }; } },
    { zone: "Beginner", glyph: "×", title: "Multiplying",
      lesson: "Multiplying is fast adding of equal groups. 3 × 4 means 3 groups of 4.",
      example: "3 × 4 = 4 + 4 + 4 = 12.",
      hint: "Picture equal groups, then add the same number again and again.",
      make(t = 1) { const a = rnd(2, byT(t, 5, 9, 12)), b = rnd(byT(t, 2, 2, 6), byT(t, 5, 9, 12));
        return { viz: arrayGrid(a, b), q: `${a} × ${b} = ?`, a: a * b, why: `${a} groups of ${b}: ${Array(a).fill(b).join(" + ")} = ${a * b}.`,
          steps: [`${a} groups of ${b}.`, `Keep adding ${b}: ${cum(b, a)}.`, `${a} × ${b} = ${a * b}.`] }; } },
    { zone: "Beginner", glyph: "÷", title: "Dividing",
      lesson: "Dividing means sharing equally. 12 ÷ 3 asks: if I share 12 into 3 equal groups, how many in each?",
      example: "12 ÷ 3 = 4, because 3 × 4 = 12. Division is multiplication backwards.",
      hint: "Ask: the small number times what gives the big number?",
      make(t = 1) { const b = rnd(2, byT(t, 5, 9, 12)), r = rnd(2, byT(t, 5, 9, 12));
        return { viz: arrayGrid(b, r), q: `${b * r} ÷ ${b} = ?`, a: r, why: `Ask: ${b} times what makes ${b * r}? ${b} × ${r} = ${b * r}.`,
          steps: [`Ask: ${b} times what makes ${b * r}?`, `${b} × ${r - 1} = ${b * (r - 1)} is one group short.`, `${b} × ${r} = ${b * r}, so ${b * r} ÷ ${b} = ${r}.`] }; } },
    { zone: "Core", glyph: "99", title: "Big numbers",
      lesson: "Add and subtract big numbers by place value: the round parts first, then the ones. Estimate first so you can tell if your answer is sensible.",
      example: "47 + 38: estimate 50 + 40 = 90. Round parts 40 + 30 = 70, ones 7 + 8 = 15, total 85.",
      hint: "Estimate first. Then do the round parts, then the ones, and join them.",
      make(t = 1) { const lo = byT(t, 10, 20, 100), hi = byT(t, 49, 99, 999), a = rnd(lo, hi), b = rnd(lo, hi);
        if (Math.random() < .5) { const ta = a - a % 10, tb = b - b % 10, oa = a % 10, ob = b % 10;
          return { q: `${a} + ${b} = ?`, a: a + b, why: `Round parts then ones: ${ta + tb} + ${oa + ob} = ${a + b}.`,
            steps: [`Estimate: about ${est(a)} + ${est(b)} = ${est(a) + est(b)}.`, `Add the round parts: ${ta} + ${tb} = ${ta + tb}.`,
                    `Add the ones: ${oa} + ${ob} = ${oa + ob}.`, `Join them: ${ta + tb} + ${oa + ob} = ${a + b}.`] }; }
        const L = Math.max(a, b), Sm = Math.min(a, b), tS = Sm - Sm % 10, oS = Sm % 10;
        return { q: `${L} − ${Sm} = ?`, a: L - Sm, why: `Take away the round part, then the ones: ${L} − ${tS} − ${oS} = ${L - Sm}.`,
          steps: [`Estimate: about ${est(L)} − ${est(Sm)} = ${est(L) - est(Sm)}.`, `Take away the round part first: ${L} − ${tS} = ${L - tS}.`,
                  `Then the ones: ${L - tS} − ${oS} = ${L - Sm}.`, `So ${L} − ${Sm} = ${L - Sm}.`] }; } },
    { zone: "Core", glyph: "¾", title: "Fractions",
      lesson: "A fraction is a part of a whole. 1/4 means 1 of 4 equal parts. To find a fraction of a number: divide by the bottom, multiply by the top.",
      example: "3/4 of 20: 20 ÷ 4 = 5, then 5 × 3 = 15.",
      hint: "Divide by the bottom number first, then multiply by the top number.",
      make(t = 1) { const d = pick(byT(t, [2, 4], [2, 3, 4, 5, 10], [3, 4, 5, 6, 8, 10, 12])), n = rnd(1, d - 1), m = rnd(2, byT(t, 4, 8, 10)) * d;
        return { viz: fractionBar(n, d, m), q: `What is ${n}/${d} of ${m}?`, a: (m / d) * n, why: `${m} ÷ ${d} = ${m / d}, then × ${n} = ${(m / d) * n}.`,
          steps: [`The bottom number, ${d}, says how many equal parts: ${m} ÷ ${d} = ${m / d} in each part.`, `The top number, ${n}, says how many parts to take.`, `${m / d} × ${n} = ${(m / d) * n}.`] }; } },
    { zone: "Core", glyph: "%", title: "Percent & decimals",
      lesson: "Percent means 'out of 100'. 10% = one tenth. 50% = half. To get a percent of a number, divide by 100 and multiply.",
      example: "10% of 250 = 250 ÷ 10 = 25. And 25% is a quarter, so 25% of 80 = 20.",
      hint: "Find 10% first by dividing by 10, then build the percent from it.",
      make(t = 1) { const p = pick(byT(t, [10, 50], [10, 20, 25, 50, 75], [5, 15, 35, 40, 60, 90])),
          n = pick(byT(t, [20, 40, 60, 80, 100], [40, 80, 100, 120, 200, 240], [20, 40, 60, 80, 120, 140, 160, 180, 200, 240, 300, 360, 400, 480]));
        return { viz: percentBar(p), q: `What is ${p}% of ${n}?`, a: (p * n) / 100, why: `${p}% = ${p}/100. ${n} × ${p} ÷ 100 = ${(p * n) / 100}.`,
          steps: [`Percent means out of 100, so ${p}% = ${p}/100.`, `A handy anchor: 10% of ${n} is ${n / 10}.`, `${n} × ${p} ÷ 100 = ${(p * n) / 100}.`] }; } },
    { zone: "Advanced", glyph: "x", title: "Algebra basics",
      lesson: "Algebra uses a letter (like x) for a mystery number. To find it, undo what was done to x. Do the opposite to both sides.",
      example: "x + 7 = 12 → subtract 7 from both sides → x = 5.",
      hint: "Do the opposite operation to both sides: plus and minus undo each other, and so do times and divide.",
      make(t = 1) { const x = rnd(2, byT(t, 9, 12, 12)), k = rnd(2, 9), c = rnd(1, byT(t, 9, 15, 15));
        const kind = t === 0 ? "add" : t === 1 ? pick(["add", "mul"]) : pick(["two", "mul", "add"]);
        if (kind === "add") return { q: `x + ${c} = ${x + c}.  x = ?`, a: x, why: `Subtract ${c} from both sides: ${x + c} − ${c} = ${x}.`,
          steps: ["We want x on its own.", `Undo "+ ${c}" by subtracting ${c} from both sides.`, `${x + c} − ${c} = ${x}, so x = ${x}.`] };
        if (kind === "mul") return { q: `${k}x = ${k * x}.  x = ?`, a: x, why: `Divide both sides by ${k}: ${k * x} ÷ ${k} = ${x}.`,
          steps: [`x is being multiplied by ${k}.`, `Undo that by dividing both sides by ${k}.`, `${k * x} ÷ ${k} = ${x}.`] };
        return { q: `${k}x + ${c} = ${k * x + c}.  x = ?`, a: x, why: `Undo the + ${c} first, then divide by ${k}: (${k * x + c} − ${c}) ÷ ${k} = ${x}.`,
          steps: [`Undo the "+ ${c}" first: ${k * x + c} − ${c} = ${k * x}.`, `Now ${k}x = ${k * x}. Undo the multiplying by dividing by ${k}.`, `${k * x} ÷ ${k} = ${x}.`] }; } },
    { zone: "Advanced", glyph: "x²", title: "Powers & roots",
      lesson: "A power means multiply a number by itself: 5² = 5 × 5. A square root goes backwards: √25 = 5 because 5 × 5 = 25.",
      example: "2³ = 2 × 2 × 2 = 8.   √49 = 7.",
      hint: "Squared means the number times itself. A root asks which number times itself gives this.",
      make(t = 1) { const n = rnd(2, byT(t, 6, 12, 15)), kind = t === 0 ? "sq" : t === 1 ? pick(["sq", "root"]) : pick(["sq", "root", "cube"]);
        if (kind === "sq") return { viz: arrayGrid(n, n), q: `${n}² = ?`, a: n * n, why: `${n} × ${n} = ${n * n}.`, steps: [`${n}² means ${n} × ${n}.`, `${n} × ${n} = ${n * n}.`] };
        if (kind === "root") return { q: `√${n * n} = ?`, a: n, why: `${n} × ${n} = ${n * n}, so the square root is ${n}.`,
          steps: [`Ask which number times itself makes ${n * n}.`, `Try ${n}: ${n} × ${n} = ${n * n}.`, `So √${n * n} = ${n}.`] };
        const c = Math.min(n, 6);
        return { q: `${c}³ = ?`, a: c ** 3, why: `${c} × ${c} × ${c} = ${c ** 3}.`, steps: [`${c}³ means ${c} × ${c} × ${c}.`, `${c} × ${c} = ${c * c}.`, `${c * c} × ${c} = ${c ** 3}.`] }; } },
    { zone: "Advanced", glyph: "△", title: "Geometry",
      lesson: "Area is the space inside a shape. Rectangle: width × height. Triangle: half of base × height. Circle: π × r × r (use π ≈ 3.14).",
      example: "Rectangle 4 by 5 → area 20. Triangle base 6, height 4 → ½ × 6 × 4 = 12.",
      hint: "Rectangle: width × height. Triangle: half of base × height.",
      make(t = 1) { const a = rnd(byT(t, 2, 2, 6), byT(t, 6, 12, 25)), b = rnd(byT(t, 2, 2, 6), byT(t, 6, 12, 25));
        return Math.random() < .5
          ? { viz: rectSvg(a, b), q: `Area of a rectangle ${a} by ${b}?`, a: a * b, why: `Width × height = ${a} × ${b} = ${a * b}.`,
              steps: ["The area of a rectangle is width × height.", `Here that is ${a} × ${b}.`, `${a} × ${b} = ${a * b}.`] }
          : { viz: triSvg(a * 2, b), q: `Area of a triangle, base ${a * 2}, height ${b}?`, a: a * b, why: `½ × ${a * 2} × ${b} = ${a * b}.`,
              steps: ["A triangle is half of a rectangle with the same base and height.", `Rectangle: ${a * 2} × ${b} = ${a * 2 * b}.`, `Half of ${a * 2 * b} is ${a * b}.`] }; } },
    { zone: "Advanced", glyph: "f′", title: "Calculus: slopes",
      lesson: "A derivative tells you how steep a curve is at one point. Power rule: the slope of xⁿ is n·xⁿ⁻¹. So the slope of x² is 2x, and the slope of x³ is 3x².",
      example: "Slope of x² at x = 3 → 2 × 3 = 6.   Slope of 5x² at x = 2 → 10 × 2 = 20.",
      hint: "Slope of x² is 2x, and of x³ is 3x². Multiply by any number in front, then plug in x.",
      make(t = 1) { const c = rnd(1, byT(t, 2, 5, 9)), x = rnd(1, byT(t, 4, 6, 12));
        if (t === 2 && Math.random() < .5) { const y = Math.min(x, 6);
          return { q: `Slope of x³ at x = ${y}?`, a: 3 * y * y, why: `Slope is 3x². At x = ${y}: 3 × ${y * y} = ${3 * y * y}.`,
            steps: ["Power rule: the slope of x³ is 3x².", `At x = ${y}: 3 × ${y}² = 3 × ${y * y}.`, `3 × ${y * y} = ${3 * y * y}.`] }; }
        return { q: `Slope of ${c === 1 ? "" : c}x² at x = ${x}?`, a: 2 * c * x, why: `Slope is ${2 * c}x. At x = ${x}: ${2 * c} × ${x} = ${2 * c * x}.`,
          steps: ["Power rule: the slope of x² is 2x.", c === 1 ? "There is no number in front, so the slope is 2x." : `With the ${c} in front: ${2 * c}x.`, `At x = ${x}: ${2 * c} × ${x} = ${2 * c * x}.`] }; } }
  ];

  /* ---------------- mental-math shortcuts ---------------- */
  // Each returns the step-by-step trick text; the real answer is always computed directly.
  const S = {
    make10:   (a, b) => { const need = 10 - a; return `${a} + ${need} = 10, then 10 + ${b - need} = ${a + b}`; },
    addRound: (a, b) => { const u = up10(a); return `${a} is close to ${u}. ${u} + ${b} = ${u + b}, then − ${u - a} = ${a + b}`; },
    addSplit: (a, b) => { const ta = a - a % 10, tb = b - b % 10, oa = a % 10, ob = b % 10;
      return `tens: ${ta} + ${tb} = ${ta + tb}; ones: ${oa} + ${ob} = ${oa + ob}; total ${ta + tb} + ${oa + ob} = ${a + b}`; },
    subRound: (a, b) => { const u = up10(b); return `${b} is close to ${u}. ${a} − ${u} = ${a - u}, then + ${u - b} = ${a - b}`; },
    subSplit: (a, b) => { const tb = b - b % 10; return `take the tens first: ${a} − ${tb} = ${a - tb}, then − ${b % 10} = ${a - b}`; },
    comp:     (a, x) => { const d = String(x).split("").map(Number), n = d.length;
      const out = d.map((v, i) => i === n - 1 ? 10 - v : 9 - v);
      return `each digit from 9, the last from 10: ${d.map((v, i) => i === n - 1 ? `10−${v}` : `9−${v}`).join(", ")} → ${out.join("")}`; },
    mul9:     n => `${n} × 10 = ${n * 10}, then − ${n} = ${n * 9}`,
    mul5:     n => `${n} × 10 = ${n * 10}, then half = ${n * 5}`,
    mul4:     n => `double ${n} = ${n * 2}, double again = ${n * 4}`,
    mul25:    n => `${n} ÷ 4 = ${n / 4}, then × 100 = ${n * 25}`,
    mul11:    n => { const d1 = Math.floor(n / 10), d2 = n % 10, s = d1 + d2;
      return s < 10 ? `${d1} + ${d2} = ${s}. Put ${s} between: ${d1}${s}${d2}`
                    : `${d1} + ${d2} = ${s}. Carry the 1: ${d1 + 1}, ${s - 10}, ${d2} → ${n * 11}`; },
    sq5:      n => { const t = Math.floor(n / 10); return `${t} × ${t + 1} = ${t * (t + 1)}, then add 25 on the end → ${n * n}`; },
    mulSplit: (a, b) => { const ta = a - a % 10; return `${ta} × ${b} = ${ta * b}; ${a % 10} × ${b} = ${(a % 10) * b}; total ${ta * b + (a % 10) * b}`; },
    mulTeen:  (a, b) => `${a} × 10 = ${a * 10}; ${a} × ${b - 10} = ${a * (b - 10)}; total ${a * b}`,
    sqSplit:  n => { const t = n - n % 10, u = n % 10; return `${n}² = ${t}² + 2 × ${t} × ${u} + ${u}² = ${t * t} + ${2 * t * u} + ${u * u} = ${n * n}`; },
    cube:     n => `${n} × ${n} = ${n * n}; ${n * n} × ${n} = ${n * n * n}`,
    root:     n => `${n} × ${n} = ${n * n}, so the square root of ${n * n} is ${n}`,
    sqNear:   n => { const d = Math.abs(100 - n), s = n < 100 ? "−" : "+"; return `${n}² = (100 ${s} ${d})² = 10000 ${s} ${200 * d} + ${d * d} = ${n * n}`; },
    dblHalve: (a, b) => `Halve ${a} → ${a / 2}, double ${b} → ${b * 2}. ${a / 2} × ${b * 2} = ${a * b}`,
    leftRight: (a, b) => { const h = b - (b % 100), t = (b % 100) - (b % 10), o = b % 10;
      return `${a} + ${h} = ${a + h}; + ${t} = ${a + h + t}; + ${o} = ${a + b}`; },
    div5:     n => `${n} × 2 = ${n * 2}; ${n * 2} ÷ 10 = ${n / 5}`,
    pct:      (p, n) => { const ten = n / 10, k = Math.floor(p / 10), parts = [`10% of ${n} = ${ten}`];
      if (k > 1) parts.push(`${k * 10}% = ${ten} × ${k} = ${ten * k}`);
      if (p % 10 === 5) parts.push(`5% = half of ${ten} = ${ten / 2}`, `${ten * k} + ${ten / 2} = ${(n * p) / 100}`);
      return parts.join(" → "); }
  };

  // why: the reason the shortcut is true. model: a proportional picture of it. A trick without its reason breaks on the first odd case.
  const METHODS = [
    { glyph: "10", title: "Make 10 (adding)", rule: "When adding digits that cross 10, first top up the bigger one to exactly 10, then add what's left.",
      example: "8 + 7 → 8 + 2 = 10, then 10 + 5 = 15",
      why: "Adding to 10 is the easiest sum there is. Splitting the second number so that its first part completes a 10 turns a hard sum into 10 + something small.",
      model: barModel([{ v: 8, label: "8" }, { v: 2, label: "2", kind: "alt" }, { v: 5, label: "5", kind: "alt" }], "8 + 7 is the same as 8 + 2 + 5. The first two parts make 10."),
      make() { const a = rnd(6, 9), b = rnd(6, 9); return { q: `${a} + ${b}`, a: a + b, steps: S.make10(a, b) }; } },
    { glyph: "≈+", title: "Round & adjust (adding)", rule: "A number ending in 8 or 9 is almost a round number. Round it up, add, then subtract the extra.",
      example: "49 + 36 → 50 + 36 = 86, then − 1 = 85",
      why: "Adding 50 is easier than adding 49. But 50 is one more than 49, so the total came out one too big. Take that one back.",
      model: barModel([{ v: 86, label: "50 + 36 = 86" }, { v: 8, label: "−1", kind: "minus" }], "49 + 36 = (50 + 36) − 1 = 85"),
      make() { const a = rnd(2, 9) * 10 - rnd(1, 2), b = rnd(11, 60); return { q: `${a} + ${b}`, a: a + b, steps: S.addRound(a, b) }; } },
    { glyph: "T+O", title: "Split & add", rule: "Break both numbers into tens and ones. Add tens together, add ones together, then join.",
      example: "47 + 38 → 40 + 30 = 70, 7 + 8 = 15, 70 + 15 = 85",
      why: "Every number is its tens plus its ones. Addition can be done in any order, so you can add all the tens and all the ones separately and join the two results.",
      model: barModel([{ v: 70, label: "40 + 30 = 70" }, { v: 15, label: "7 + 8 = 15", kind: "alt" }], "47 + 38 = 70 + 15 = 85"),
      make() { const a = rnd(12, 79), b = rnd(12, 79); return { q: `${a} + ${b}`, a: a + b, steps: S.addSplit(a, b) }; } },
    { glyph: "≈−", title: "Round & adjust (subtracting)", rule: "Subtracting a number ending in 7, 8 or 9? Subtract the round number above it, then add the difference back.",
      example: "83 − 28 → 83 − 30 = 53, then + 2 = 55",
      why: "Taking away 30 is easier than taking away 28. But you took away 2 too many, so give those 2 back.",
      model: barModel([{ v: 53, label: "83 − 30 = 53" }, { v: 8, label: "+2", kind: "alt" }], "28 is 2 less than 30, so add 2 back: 53 + 2 = 55"),
      make() { const b = rnd(1, 9) * 10 + pick([7, 8, 9]), a = b + rnd(15, 70); return { q: `${a} − ${b}`, a: a - b, steps: S.subRound(a, b) }; } },
    { glyph: "100", title: "Take from 100 / 1000", rule: "To subtract from 100 or 1000, take every digit from 9, except the last one, which is taken from 10.",
      example: "1000 − 378 → 9−3, 9−7, 10−8 → 622",
      why: "999 − 378 never needs borrowing, because every digit of 999 is a 9. That leaves your answer 1 too small, and taking the last digit from 10 instead of 9 adds that 1 back.",
      model: "",
      make() { const big = Math.random() < .5, x = big ? rnd(101, 999) : rnd(11, 99);
        if (x % 10 === 0) return this.make();
        const T = big ? 1000 : 100; return { q: `${T} − ${x}`, a: T - x, steps: S.comp(T, x) }; } },
    { glyph: "×9", title: "Times 9", rule: "Multiply by 10, then take away the number once.",
      example: "9 × 7 → 70 − 7 = 63",
      why: "Nine sevens is ten sevens with one seven taken away. Ten sevens is just 70.",
      model: barModel([{ v: 70, label: "10 × 7 = 70" }, { v: 7, label: "−7", kind: "minus" }], "9 × 7 = 10 × 7 − 7 = 63"),
      make() { const n = rnd(3, 25); return { q: `${n} × 9`, a: n * 9, steps: S.mul9(n) }; } },
    { glyph: "×5", title: "Times 5", rule: "Multiply by 10, then cut it in half.",
      example: "18 × 5 → 180, half = 90",
      why: "Five is half of ten, so five 18s is half of ten 18s. Multiplying by 10 only moves digits, so it is easy.",
      model: barModel([{ v: 90, label: "90" }, { v: 90, label: "90", kind: "ghost" }], "18 × 10 = 180. Five is half of ten, so take half: 90."),
      make() { const n = rnd(12, 98); return { q: `${n} × 5`, a: n * 5, steps: S.mul5(n) }; } },
    { glyph: "×4", title: "Times 4", rule: "Double it, then double it again.",
      example: "27 × 4 → 54, 108",
      why: "Four is two times two, so multiplying by 4 is doubling twice.",
      model: barModel([{ v: 54, label: "27 × 2 = 54" }, { v: 54, label: "54 × 2 = 108", kind: "alt" }], "Four 27s are two 54s: 54 + 54 = 108"),
      make() { const n = rnd(12, 65); return { q: `${n} × 4`, a: n * 4, steps: S.mul4(n) }; } },
    { glyph: "×25", title: "Times 25", rule: "25 is a quarter of 100. Divide by 4, then add two zeros. (Works best when the number divides by 4.)",
      example: "24 × 25 → 24 ÷ 4 = 6 → 600",
      why: "Four 25s make exactly 100. So every group of four in your number is worth 100.",
      model: barModel(Array(6).fill({ v: 100, label: "100" }), "24 has six groups of four, so 24 × 25 = 6 × 100 = 600"),
      make() { const n = rnd(2, 24) * 4; return { q: `${n} × 25`, a: n * 25, steps: S.mul25(n) }; } },
    { glyph: "×11", title: "Times 11", rule: "Add the two digits and put the sum in the middle. If the sum is 10 or more, carry the 1 to the left digit.",
      example: "23 × 11 → 2 (2+3) 3 = 253      57 × 11 → 5+7=12 → 627",
      why: "Times 11 means times 10 plus once more. Adding the number to itself shifted one place is exactly what puts the digit sum in the middle.",
      model: barModel([{ v: 570, label: "57 × 10 = 570" }, { v: 57, label: "+ 57", kind: "alt" }], "57 × 11 = 570 + 57 = 627"),
      make() { const n = rnd(12, 98); return { q: `${n} × 11`, a: n * 11, steps: S.mul11(n) }; } },
    { glyph: "5²", title: "Squares ending in 5", rule: "Take the first digit(s), multiply by the next number up, then stick 25 on the end.",
      example: "35 × 35 → 3 × 4 = 12 → 1225",
      why: "A number ending in 5 is 10t + 5. Squaring it gives 100t² + 100t + 25, which is 100 × t × (t + 1) + 25. So t × (t + 1) in front of 25 is exactly right.",
      model: barModel([{ v: 1200, label: "3 × 4 = 12 hundreds" }, { v: 150, label: "25", kind: "alt" }], "35 × 35 = 1200 + 25 = 1225"),
      make() { const n = pick([15, 25, 35, 45, 55, 65, 75, 85, 95]); return { q: `${n} × ${n}`, a: n * n, steps: S.sq5(n) }; } },
    { glyph: "10%", title: "Percent via 10%", rule: "Find 10% by dropping one digit (÷10). Build any other percent from it. 5% is half of 10%.",
      example: "15% of 80 → 10% = 8, 5% = 4 → 12",
      why: "10% is one tenth, and dividing by 10 is easy. Any percent that is a multiple of 5 can be built from 10% and half of 10%.",
      model: barModel([{ v: 8, label: "10% = 8" }, { v: 4, label: "5% = 4", kind: "alt" }], "15% of 80 = 8 + 4 = 12"),
      make() { const p = pick([10, 15, 20, 25, 30, 35, 40, 45, 60, 75]), n = pick([20, 40, 60, 80, 120, 140, 160, 180, 200, 240, 300]);
        return { q: `${p}% of ${n}`, a: (n * p) / 100, steps: S.pct(p, n) }; } },
    { glyph: "a×b", title: "Split multiply", rule: "Split the big number into tens and ones, multiply each part, then add.",
      example: "47 × 6 → 40×6 = 240, 7×6 = 42 → 282",
      why: "47 is 40 + 7. Six groups of 47 is six groups of 40 plus six groups of 7. Each part is a small multiplication you already know.",
      model: barModel([{ v: 240, label: "40 × 6 = 240" }, { v: 42, label: "7 × 6 = 42", kind: "alt" }], "47 × 6 = 240 + 42 = 282"),
      make() { const a = rnd(13, 69), b = rnd(3, 9); return { q: `${a} × ${b}`, a: a * b, steps: S.mulSplit(a, b) }; } },

    // Recall drills (group "recall"). These are facts to know cold, not tricks. Add new ones at the END: saved progress refers to methods by position.
    { group: "recall", glyph: "20×", title: "Tables to 20 × 20", rule: "Know 11 × 11 up to 20 × 20 without working them out. Until a fact is automatic, rebuild it: split one number into 10 plus the rest.",
      example: "17 × 14 → 170 + 68 = 238",
      why: "Knowing a fact is faster than calculating it, and every bigger sum is built from facts like these. To rebuild one, split 14 into 10 + 4. Then 17 × 14 is 17 × 10 plus 17 × 4, and you can do both at once.",
      model: barModel([{ v: 170, label: "17 × 10 = 170" }, { v: 68, label: "17 × 4 = 68", kind: "alt" }], "17 × 14 = 170 + 68 = 238"),
      make() { const a = rnd(11, 20), b = rnd(11, 20); return { q: `${a} × ${b}`, a: a * b, steps: S.mulTeen(a, b) }; } },
    { group: "recall", glyph: "n²", title: "Squares to 30²", rule: "Know the squares up to 30 × 30. To rebuild one, split the number into tens and ones: square the tens, add twice tens × ones, then add the ones squared.",
      example: "27² → 400 + 280 + 49 = 729",
      why: "27 is 20 + 7, so 27 × 27 has four parts: 20 × 20, two lots of 20 × 7, and 7 × 7. That is the picture of (20 + 7)². Squares come up constantly, so it pays to know them by heart.",
      model: barModel([{ v: 100, label: "20² = 400" }, { v: 70, label: "+280", kind: "alt" }, { v: 30, label: "+49", kind: "alt" }], "27² = 400 + 280 + 49 = 729. The 280 is 2 × 20 × 7. (Bar widths are not to scale.)"),
      make() { let n; do n = rnd(11, 30); while (n % 10 === 0); return { q: `${n} × ${n}`, a: n * n, steps: S.sqSplit(n) }; } },
    { group: "recall", glyph: "n³", title: "Cubes to 12³", rule: "Know the cubes from 2³ to 12³. To rebuild one, square the number, then multiply by it once more.",
      example: "7³ → 7 × 7 = 49, 49 × 7 = 343",
      why: "A cube is a number multiplied by itself three times. Doing it in two steps, square first then times the number once more, keeps each step small.",
      model: barModel([{ v: 49, label: "7 × 7 = 49" }, { v: 49, label: "× 7 again", kind: "alt" }], "7³ = 49 × 7 = 343"),
      make() { const n = rnd(2, 12); return { q: `${n} × ${n} × ${n}`, a: n * n * n, steps: S.cube(n) }; } },
    { group: "recall", glyph: "√", title: "Square roots to 30", rule: "A square root asks: which number times itself gives this? If you know the squares, read the table backwards.",
      example: "√729 → 27, because 27 × 27 = 729",
      why: "Square roots undo squares. If 27 × 27 = 729, then the square root of 729 is 27. Knowing the squares lets you go in either direction.",
      model: "",
      make() { const n = rnd(11, 30); return { q: `√${n * n}`, a: n, steps: S.root(n) }; } },

    // More shortcuts, added after the recall drills so saved positions did not move. The Speed tab groups by `group`, not by position.
    { glyph: "≈100", title: "Squares near 100", rule: "For a number close to 100, call the gap d. Start at 10,000, take away (or add) 200 × d, then add d × d.",
      example: "97² → 10000 − 600 + 9 = 9409",
      why: "97 is 100 − 3, so 97 × 97 = (100 − 3)². Picture a 100 by 100 square with two strips of width 3 cut off. That removes 2 × 100 × 3 = 600, but the 3 × 3 corner was removed twice, so add 9 back.",
      model: barModel([{ v: 100, label: "100² = 10,000" }, { v: 24, label: "−600", kind: "minus" }, { v: 16, label: "+9", kind: "alt" }], "97² = 10000 − 600 + 9 = 9409. The 600 is two strips of 2 × 100 × 3, and the 9 is the 3 × 3 corner counted twice. (Bar widths are not to scale.)"),
      make() { let n; do n = rnd(91, 109); while (n === 100); return { q: `${n} × ${n}`, a: n * n, steps: S.sqNear(n) }; } },
    { glyph: "½×2", title: "Double & halve", rule: "If one number is even and the other ends in 5, halve the even one and double the other. Doubling a number ending in 5 gives a round number.",
      example: "14 × 35 → 7 × 70 = 490",
      why: "Cut a 14 by 35 rectangle in half and put the two halves side by side: you get a 7 by 70 rectangle. Same area, easier numbers.",
      model: barModel([{ v: 245, label: "7 × 35 = 245" }, { v: 245, label: "7 × 35 = 245", kind: "alt" }], "14 × 35 is two lots of 7 × 35, which is 7 × 70 = 490"),
      make() { const a = rnd(3, 24) * 2, b = pick([15, 25, 35, 45, 55, 65, 75]); return { q: `${a} × ${b}`, a: a * b, steps: S.dblHalve(a, b) }; } },
    { glyph: "→+", title: "Add left to right", rule: "Add the biggest part first, as you would say the number aloud: hundreds, then tens, then ones. Keep a running total.",
      example: "476 + 358 → 776, 826, 834",
      why: "Addition can be done in any order. Going left to right means the leading digits of your answer appear first, so you can estimate early, and there is no carry to remember at the end.",
      model: barModel([{ v: 40, label: "+300" }, { v: 30, label: "+50", kind: "alt" }, { v: 20, label: "+8", kind: "alt" }], "476 + 358: 476 → 776 → 826 → 834. (Bar widths are not to scale.)"),
      make() { const a = rnd(120, 899), b = rnd(1, 8) * 100 + rnd(1, 9) * 10 + rnd(1, 9); return { q: `${a} + ${b}`, a: a + b, steps: S.leftRight(a, b) }; } },
    { glyph: "÷5", title: "Divide by 5", rule: "Double it, then divide by 10 (move the point one place left).",
      example: "85 ÷ 5 → 170 ÷ 10 = 17",
      why: "Five is ten divided by two, so dividing by 5 is the same as multiplying by 2 and dividing by 10. Dividing by 10 only moves digits.",
      model: barModel([{ v: 60, label: "85 × 2 = 170" }, { v: 40, label: "÷ 10 = 17", kind: "alt" }], "85 ÷ 5 = 170 ÷ 10 = 17. (Bar widths are not to scale.)"),
      make() { const n = rnd(12, 98) * 5; return { q: `${n} ÷ 5`, a: n / 5, steps: S.div5(n) }; } }
  ];

  /* ---------------- skills: one id per level (L0..) or method (M0..) ---------------- */
  function skillName(id) { const i = +id.slice(1); return id[0] === "L" ? `${i + 1}. ${LEVELS[i].title}` : METHODS[i].title; }
  function skillGlyph(id) { const i = +id.slice(1); return id[0] === "L" ? LEVELS[i].glyph : METHODS[i].glyph; }

  // One uniform question object for every kind of session. `tier` only changes levels (methods are fixed drills).
  function makeItem(id, tier) {
    const isL = id[0] === "L", i = +id.slice(1), K = isL ? LEVELS[i] : METHODS[i], t = tier == null ? 1 : tier, q = K.make(t);
    return { skill: id, tier: t, q: q.q, a: q.a, expl: q.why || q.steps, visual: q.visual, viz: q.viz, steps: isL ? q.steps : undefined,
             hints: isL ? [K.hint, K.example, q.why] : [K.rule, K.example, q.steps] };
  }

  /* ---------------- faster-way tips for typed questions ---------------- */
  function tip(norm) {
    let m = norm.match(/^\(\((\d+)\/100\)\*(\d+)\)$/);
    if (m) { const p = +m[1], n = +m[2]; return p % 5 === 0 && p > 5 && p <= 95 && n % 20 === 0 ? { name: "Percent via 10%", steps: S.pct(p, n) } : null; }
    m = norm.match(/^(\d+)\^2$/);
    if (m) { const n = +m[1]; return n % 10 === 5 && n >= 15 && n < 100 ? { name: "Squares ending in 5", steps: S.sq5(n) }
      : n >= 91 && n <= 109 && n !== 100 ? { name: "Squares near 100", steps: S.sqNear(n) } : null; }
    m = norm.match(/^(\d+)\/5$/);
    if (m) { const n = +m[1]; return n % 5 === 0 && n >= 60 && n <= 490 ? { name: "Divide by 5", steps: S.div5(n) } : null; }
    m = norm.match(/^(\d+)\s*([+\-*])\s*(\d+)$/);
    if (!m) return null;
    const a = +m[1], b = +m[3], op = m[2];
    if (op === "+" && a < 1000 && b < 1000) {
      if (a < 10 && b < 10) return a + b > 10 ? { name: "Make 10", steps: S.make10(a, b) } : null;
      if (a >= 100 && b >= 100 && b % 10 && Math.floor(b / 10) % 10) return { name: "Add left to right", steps: S.leftRight(a, b) };
      if (a >= 10 && a % 10 >= 8) return { name: "Round & adjust", steps: S.addRound(a, b) };
      if (b >= 10 && b % 10 >= 8) return { name: "Round & adjust", steps: S.addRound(b, a) };
      if (a >= 10 && b >= 10) return { name: "Split & add", steps: S.addSplit(a, b) };
    }
    if (op === "-" && a > b && b > 10) {
      if ((a === 100 || a === 1000) && b % 10 && String(b).length === String(a).length - 1) return { name: "Take from 100/1000", steps: S.comp(a, b) };
      if (b % 10 >= 7) return { name: "Round & adjust", steps: S.subRound(a, b) };
      if (b % 10) return { name: "Subtract tens first", steps: S.subSplit(a, b) };
    }
    if (op === "*") {
      if (a === b && a % 10 === 5 && a >= 15 && a < 100) return { name: "Squares ending in 5", steps: S.sq5(a) };
      if (a === b && a >= 91 && a <= 109 && a !== 100) return { name: "Squares near 100", steps: S.sqNear(a) };
      for (const [x, y] of [[a, b], [b, a]]) {
        if (x === 9 && y > 1) return { name: "Times 9", steps: S.mul9(y) };
        if (x === 11 && y >= 10 && y < 100) return { name: "Times 11", steps: S.mul11(y) };
        if (x === 5 && y > 1) return { name: "Times 5", steps: S.mul5(y) };
        if (x === 25 && y % 4 === 0) return { name: "Times 25", steps: S.mul25(y) };
        if (x === 4 && y > 1) return { name: "Times 4", steps: S.mul4(y) };
        if (x % 10 === 5 && x >= 15 && x <= 75 && y % 2 === 0 && y >= 6 && y <= 48) return { name: "Double & halve", steps: S.dblHalve(y, x) };
      }
      for (const [x, y] of [[a, b], [b, a]]) if (x >= 13 && x < 100 && y >= 3 && y <= 9) return { name: "Split multiply", steps: S.mulSplit(x, y) };
    }
    return null;
  }

  /* ---------------- misconceptions: name the likely slip, so it can be tracked and drilled ---------------- */
  const MIS = {
    "add-subtracted": "Subtracting when the question says add", "carry": "Forgetting to carry", "off-by-one": "Off-by-one slips",
    "tens-off": "Tens digit off by one", "sub-added": "Adding when the question says subtract", "borrow": "Borrowing across the tens",
    "borrow-tens": "Losing a ten after borrowing", "mul-added": "Adding instead of multiplying", "mul-group": "One group too many or too few",
    "div-multiplied": "Multiplying instead of dividing", "div-off1": "Not checking division by multiplying back",
    "pct-no-divide": "Forgetting to divide by 100", "pct-div10": "Dividing by 10 instead of 100",
    "frac-one-part": "Stopping after one part of a fraction", "frac-no-divide": "Skipping the divide-by-the-bottom step",
    "alg-same-op": "Repeating the operation instead of undoing it", "alg-skipped-step": "Skipping the first undo step",
    "sq-doubled": "Doubling instead of squaring", "root-halved": "Halving instead of taking the root", "cube-tripled": "Tripling instead of cubing",
    "tri-full": "Forgetting to halve a triangle", "slope-height": "Mixing up height and slope"
  };
  function diagnose(q, u) {
    const close = (x, y) => Math.abs(x - y) < 0.01, D = (code, text) => ({ code, text });
    let m;
    if ((m = q.match(/^(\d+) \+ (\d+)\b/))) { const a = +m[1], b = +m[2], t = a + b;
      if (close(u, Math.abs(a - b))) return D("add-subtracted", "That's what subtracting gives. This one needs adding.");
      if (a % 10 + b % 10 >= 10 && close(u, t - 10)) return D("carry", "Looks like you forgot to carry the 1 into the tens place.");
      if (close(Math.abs(u - t), 1)) return D("off-by-one", "So close, off by just one. Recount the last step.");
      if (close(Math.abs(u - t), 10)) return D("tens-off", "The tens digit is off by one. Check the tens again.");
      return null; }
    if ((m = q.match(/^(\d+) − (\d+)\b/))) { const a = +m[1], b = +m[2], t = a - b;
      if (close(u, a + b)) return D("sub-added", "That's adding. This one needs subtracting.");
      if (a >= 10 && b >= 10 && a % 10 < b % 10) {
        const buggy = (Math.floor(a / 10) - Math.floor(b / 10)) * 10 + (b % 10 - a % 10);
        if (close(u, buggy)) return D("borrow", "In the ones column you can't take a bigger digit from a smaller one. Borrow 10 from the tens first."); }
      if (close(Math.abs(u - t), 10)) return D("borrow-tens", "Check the borrowing: the tens digit is off by one.");
      if (close(Math.abs(u - t), 1)) return D("off-by-one", "So close, off by just one.");
      return null; }
    if ((m = q.match(/^(\d+) × (\d+)\b/))) { const a = +m[1], b = +m[2], t = a * b;
      if (close(u, a + b)) return D("mul-added", "That's adding. Multiplying means that many groups of the other number.");
      if ([t - a, t + a, t - b, t + b].some(v => close(u, v))) return D("mul-group", "One group too many or too few. Check how many groups you counted.");
      return null; }
    if ((m = q.match(/^(\d+) ÷ (\d+)\b/))) { const a = +m[1], b = +m[2], r = a / b;
      if (close(u, a * b)) return D("div-multiplied", "You multiplied. Dividing means sharing equally into groups.");
      if (close(Math.abs(u - r), 1)) return D("div-off1", `Close. Check by multiplying back: ${r} × ${b} = ${a}.`);
      return null; }
    if ((m = q.match(/(\d+)% of (\d+)/))) { const p = +m[1], n = +m[2];
      if (close(u, p * n)) return D("pct-no-divide", "Percent means 'out of 100'. Divide by 100 at the end.");
      if (close(u, (p * n) / 10)) return D("pct-div10", "Careful: it's ÷ 100, not ÷ 10.");
      return null; }
    if ((m = q.match(/(\d+)\/(\d+) of (\d+)/))) { const n = +m[1], d = +m[2], mm = +m[3];
      if (n !== 1 && close(u, mm / d)) return D("frac-one-part", `That's just one part (1/${d}). Now multiply by the top number, ${n}.`);
      if (close(u, mm * n)) return D("frac-no-divide", `Divide by the bottom number (${d}) first.`);
      return null; }
    if ((m = q.match(/^x \+ (\d+) = (\d+)/))) { const c = +m[1], r = +m[2];
      if (close(u, r + c)) return D("alg-same-op", `You added. Do the opposite: subtract ${c} from both sides.`);
      return null; }
    if ((m = q.match(/^(\d+)x \+ (\d+) = (\d+)/))) { const k = +m[1], r = +m[3];
      if (close(u, r / k)) return D("alg-skipped-step", "Undo the + part first (subtract it), and only then divide.");
      return null; }
    if ((m = q.match(/^(\d+)x = (\d+)/))) { const k = +m[1], r = +m[2];
      if (close(u, r * k)) return D("alg-same-op", `You multiplied. Do the opposite: divide both sides by ${k}.`);
      return null; }
    if ((m = q.match(/^(\d+)² =/))) { const n = +m[1];
      if (close(u, 2 * n)) return D("sq-doubled", `That's ${n} × 2. Squared means ${n} × ${n}.`);
      return null; }
    if ((m = q.match(/^(\d+)³ =/))) { const n = +m[1];
      if (close(u, 3 * n)) return D("cube-tripled", `That's ${n} × 3. Cubed means ${n} × ${n} × ${n}.`);
      return null; }
    if ((m = q.match(/^√(\d+)/))) { const s = +m[1];
      if (close(u, s / 2)) return D("root-halved", `A square root isn't half. Find the number that times itself makes ${s}.`);
      return null; }
    if ((m = q.match(/triangle, base (\d+), height (\d+)/))) {
      if (close(u, +m[1] * +m[2])) return D("tri-full", "That's a rectangle. A triangle is half of it.");
      return null; }
    if ((m = q.match(/^Slope of x³ at x = (\d+)/))) { const x = +m[1];
      if (close(u, x ** 3)) return D("slope-height", "That's the height of the curve, not its slope. Use the slope rule: bring the 3 down.");
      return null; }
    if ((m = q.match(/^Slope of (\d*)x² at x = (\d+)/))) { const c = +(m[1] || 1), x = +m[2];
      if (close(u, c * x * x)) return D("slope-height", "That's the height of the curve, not its slope. Use the slope rule: bring the 2 down.");
      return null; }
    return null;
  }

  // Targeted drills: some slips only appear for certain numbers (a carry needs ones that add past 10).
  const FOCUS = {
    "carry": q => { const m = q.match(/^(\d+) \+ (\d+)/); return !!m && (+m[1] % 10) + (+m[2] % 10) >= 10; },
    "borrow": q => { const m = q.match(/^(\d+) − (\d+)/); return !!m && +m[1] >= 10 && +m[2] >= 10 && (+m[1] % 10) < (+m[2] % 10); }
  };
  FOCUS["borrow-tens"] = FOCUS.borrow;
  const FOCUS_SKILL = { "carry": "L5", "borrow": "L5", "borrow-tens": "L5" };
  function focusItem(skill, code, tier) {
    const sk = FOCUS_SKILL[code] || skill, pred = FOCUS[code]; let it;
    for (let k = 0; k < 120; k++) { it = makeItem(sk, tier); if (!pred || pred(it.q)) break; }
    it.focus = code; return it;
  }
  function similarItem(item, tier) {                              // "try one like it": same skill, new numbers, same trap
    let it;
    for (let k = 0; k < 12; k++) {
      it = item.focus && FOCUS[item.focus] ? focusItem(item.skill, item.focus, tier) : makeItem(item.skill, tier);
      if (it.q !== item.q) return it;
    }
    return it;
  }

  /* ---------------- teaching policies (pure, tested) ---------------- */
  // 3-up / 1-down staircase: three clean correct answers in a row raise the difficulty, any miss lowers it.
  // That settles near 80% success, the zone where learning is fastest. Hinted answers don't count as clean.
  function nextTier(tier, run, ok, helped) {
    if (!ok) return { tier: Math.max(0, tier - 1), run: 0 };
    if (helped) return { tier, run };
    run += 1;
    return run >= 3 ? { tier: Math.min(2, tier + 1), run: 0 } : { tier, run };
  }
  // A delayed check counts if you get 3 of 4 (or 2 of 2) right.
  function reviewPasses(c, t) { return t >= 3 ? c / t >= 0.75 : t === 2 && c === 2; }
  // Passing a level once is "learning". Only remembering it after time away makes it "solid".
  function levelState(passed, unlocked, st, now) {
    if (!passed) return unlocked ? "next" : "locked";
    st = st || {};
    if (st.solidAt) return st.due && st.due <= now ? "due" : "solid";
    return st.passAt && now - st.passAt < 20 * HOUR ? "passed" : "ready";
  }
  // If an answer is wildly off in size, say so: estimating catches place-value slips that a recheck misses.
  function sizeCheck(a, v) {
    if (!(a >= 10) || !(v > 0)) return null;
    const r = v / a; if (r >= 0.2 && r <= 5) return null;
    return `The answer should be around ${Number(a.toPrecision(1))}. Yours is much ${r > 1 ? "bigger" : "smaller"}, so look for a place-value slip or a missed step.`;
  }

  /* ---------------- learning-science helpers (pure: app.js calls them, test.js checks them) ---------------- */

  // Confidence. conf: 2 = sure, 1 = not sure, 0 = guess. A "sure but wrong" answer is the most useful mistake there is.
  const confKey = (conf, ok) => (conf === 2 ? "s" : "u") + (ok ? "r" : "w");              // sr, sw, ur, uw
  function confFeedback(conf, ok) {
    if (conf === 2 && !ok) return { title: "You were sure, but it slipped", text: "A confident mistake is the most useful kind to catch: the method felt right but wasn't. Check the steps above, then take the next one slowly." };
    if (conf === 0 && ok) return { title: "Right, but it was a guess", text: "A lucky answer isn't learned yet. This question is saved to come back in your drills." };
    if (conf === 1 && ok) return { title: "Right, even though you weren't sure", text: "You know more than you think. One more like this and it will feel solid." };
    return null;
  }
  function calibration(t) { const sure = t.sr + t.sw; return sure < 3 ? null : Math.round((t.sr / sure) * 100); }   // % right when you said "sure"
  function calibrationNote(t) {
    const sure = t.sr + t.sw, unsure = t.ur + t.uw;
    if (sure >= 5 && t.sw / sure > 0.3) return "You are often sure and wrong. Slow down on the steps that feel obvious; that is where the slips hide.";
    if (unsure >= 5 && t.ur / unsure > 0.6) return "You are right more often than you feel. Trust your method a little more.";
    if (sure >= 5) return "When you say you're sure, you're usually right. Your feel for the maths is accurate.";
    return "This fills in as you rate your answers while you practise.";
  }

  // Explain it back: pick the real reason a shortcut works. The wrong options are the misconceptions learners actually have,
  // not other shortcuts' explanations (those can be ruled out by keywords alone). Same order as METHODS: append only.
  const WHY_WRONG = [
    /* 0  Make 10 (adding) */ ["Ten is the biggest number you can comfortably add in your head, so splitting the sum into two smaller sums keeps every step under 10.", "Adding a number to itself is easier than adding two different numbers, so first make both numbers equal and then adjust."],
    /* 1  Round & adjust (adding) */ ["Adding 50 is easier than adding 49. But 50 is one more than 49, so the total came out one too small. Add that one on.", "Rounding to 50 is easier, and rounding errors cancel out, so you can leave the total as it is without adjusting."],
    /* 2  Split & add */ ["Tens are worth more than ones, so you add the tens first and then ignore any carry from the ones.", "Splitting a number into tens and ones makes it smaller, and a smaller number is always faster to add."],
    /* 3  Round & adjust (subtracting) */ ["Taking away 30 is easier than taking away 28. But you took away 2 too many, so take away 2 more.", "Subtracting a round number is always exact, so no adjustment is needed once you have rounded."],
    /* 4  Take from 100 / 1000 */ ["Taking each digit from 9 never needs borrowing and the answer is exact, so the last digit should be taken from 9 as well.", "Subtracting from 999 is easier because 999 is close to 1000, so you can estimate the answer and skip the exact digits."],
    /* 5  Times 9 */ ["Nine is one less than ten, so nine sevens is one less than ten sevens. Ten sevens is 70, so the answer is 69.", "Nine sevens is nine tens with seven taken away, which gives 90 − 7 = 83."],
    /* 6  Times 5 */ ["Five is half of ten, so five 18s is ten 18s with half of the 10 left out, which means taking 5 away.", "Five is half of ten, so five 18s is double ten 18s."],
    /* 7  Times 4 */ ["Four is two plus two, so multiplying by 4 means doubling the number and then adding 2.", "Four is two squared, so multiplying by 4 means squaring the number."],
    /* 8  Times 25 */ ["Twenty-five is a quarter of 100, so multiplying by 25 just means dividing the number by 4.", "Two 25s make exactly 100, so every pair in your number is worth 100."],
    /* 9  Times 11 */ ["Eleven is one more than ten, so times 11 is the number with a 1 written on the end.", "Eleven is made of two 1s, so times 11 means writing the number twice side by side."],
    /* 10 Squares ending in 5 */ ["Squaring 5 gives 25, so the square of any number ending in 5 is the square of its tens digit with 25 written after it.", "A number ending in 5 is halfway to the next ten, so its square is halfway between the squares of the two nearest tens."],
    /* 11 Percent via 10% */ ["10% is one tenth, so you find any percent by dividing by 10 and then multiplying by the percent.", "10% is one tenth, so 5% is a fifth of that and 15% is double 5%."],
    /* 12 Split multiply */ ["47 is 40 + 7, so six groups of 47 is six times 40, plus 7. The last step stays a simple addition.", "Splitting 47 into 40 and 7 lets you multiply the two parts by each other, since 40 × 7 is easier than 6 × 47."],
    /* 13 Tables to 20 × 20 */ ["Facts beyond 10 × 10 have to be calculated every time, because there are too many to remember. Practise the calculation instead.", "To rebuild 17 × 14, split 14 into 10 + 4 and multiply 17 × 10 by 17 × 4, which gives the exact answer."],
    /* 14 Squares to 30² */ ["27 × 27 is 20 × 20 plus 7 × 7, because the two parts do not affect each other. You only need two small facts.", "Squares grow by the same amount each time, so once you know one square you can find the next by adding a fixed number."],
    /* 15 Cubes to 12³ */ ["A cube is a number multiplied by 3, so you can add the number to itself three times.", "A cube is the square multiplied by itself, so you square the number and then square the result."],
    /* 16 Square roots to 30 */ ["A square root is half the number, so you can halve a square to get the root back.", "Square roots and squares are unrelated, so each root has to be learned separately from its own table."],
    /* 17 Squares near 100 */ ["97 is 100 − 3, so 97 × 97 is 100 × 100 minus 3 × 3. The strips do not overlap, so only the corner is removed.", "97 is 3 less than 100, so 97 × 97 is 3 less than 100 × 100, which is 9,997."],
    /* 18 Double & halve */ ["Halving one number and doubling the other keeps the sum the same, so the total stays the same and the numbers get easier.", "Doubling one number and halving the other brings them closer together, and numbers that are close together are always easier to multiply."],
    /* 19 Add left to right */ ["Adding the biggest digits first is always exact, so there is never anything to carry or correct afterwards.", "Going left to right changes the answer slightly, but the leading digits matter most, so the last digits can be rounded."],
    /* 20 Divide by 5 */ ["Five is half of ten, so dividing by 5 is the same as halving and then dividing by 10.", "Dividing by 5 is the same as dividing by 10 and then adding half of the result."]
  ];
  function shuffle(list, rand) { const a = list.slice(); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; }
  function whyOptions(methodIndex, rand) {
    const r = rand || Math.random, M = METHODS[methodIndex], wrong = WHY_WRONG[methodIndex];
    if (!M || !M.why || !wrong) return null;
    const options = shuffle([M.why, ...wrong], r);
    return { options, answer: options.indexOf(M.why), why: M.why };
  }

  // Predict, then reveal.
  const shortNum = n => String(+Number(n).toFixed(2));
  function predictionNote(guess, answer) {
    const hit = Math.abs(guess - answer) < 0.01;
    return { hit, text: hit ? `You predicted ${shortNum(answer)}. Spot on.`
      : `You predicted ${shortNum(guess)}. The answer is ${shortNum(answer)}. Look for the step that moves you from your guess to the answer.` };
  }

  // Short sessions: after about 15 minutes of practice with no real gap, suggest a break. sess = { ms, last } is updated in place.
  const SESSION_BREAK = 15 * 60000, SESSION_GAP = 10 * 60000;
  function trackSession(sess, ms, now) {
    if (now - sess.last > SESSION_GAP) sess.ms = 0;
    sess.ms += ms; sess.last = now;
    if (sess.ms < SESSION_BREAK) return 0;
    const mins = Math.round(sess.ms / 60000); sess.ms = 0; return mins;
  }

  // A daily calendar reminder as an .ics file (works with every phone and desktop calendar; no server or push needed).
  function reminderICS(time, now, origin) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time || ""); if (!m) return null;
    const d = new Date(now), p = n => String(n).padStart(2, "0");
    const stamp = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
    const start = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${m[1]}${m[2]}00`;       // floating local time: fires at that clock time wherever you are
    const where = /^https?:\/\//.test(origin || "") ? ` ${origin}/` : "";
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EasyMath//Daily reminder//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT", "UID:easymath-daily@easymath",
      `DTSTAMP:${stamp}`, `DTSTART:${start}`, "DURATION:PT10M", "RRULE:FREQ=DAILY", "SUMMARY:EasyMath: 10 questions",
      `DESCRIPTION:About five minutes. Short and regular beats long and rare.${where}`, "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:EasyMath", "TRIGGER:PT0S", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
  }

  const api = { LEVELS, METHODS, S, tip, diagnose, makeItem, skillName, skillGlyph, rnd, pick, MIS, FOCUS, focusItem, similarItem,
                nextTier, reviewPasses, levelState, sizeCheck, HOUR,
                confKey, confFeedback, calibration, calibrationNote, WHY_WRONG, whyOptions, predictionNote, trackSession, SESSION_BREAK, reminderICS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Skills = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
