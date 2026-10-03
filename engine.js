/* Deterministic math engine: exact, instant, no network.
   Shared by the browser app and by server.js (as the AI's calculator tool). */
(function (root) {
  function normalize(text) {
    let t = String(text).toLowerCase().trim().replace(/[?=]+$/, "");
    t = t.replace(/^(what is|what's|whats|calculate|solve|compute|find|how much is)\s+/, "");
    t = t.replace(/(\d)\s*percent/g, "$1%");
    t = t.replace(/(\d+\.?\d*)\s*%\s*of\s*(\d+\.?\d*)/g, "(($1/100)*$2)");
    t = t.replace(/square root of\s*(\d+\.?\d*)/g, "sqrt($1)")
         .replace(/√\s*(\d+\.?\d*)/g, "sqrt($1)")
         .replace(/\bsquared\b/g, "^2").replace(/\bcubed\b/g, "^3")
         .replace(/to the power of|\bpower\b/g, "^")
         .replace(/divided by|\bover\b|÷/g, "/")
         .replace(/multiplied by|\btimes\b|×/g, "*")
         .replace(/(\d)\s*x\s*(\d)/g, "$1*$2")
         .replace(/\bplus\b/g, "+").replace(/\bminus\b|−/g, "-");
    return t;
  }

  const FUNCS = {
    sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
    log: Math.log10, ln: Math.log, round: Math.round, floor: Math.floor, ceil: Math.ceil
  };
  const CONSTS = { pi: Math.PI, "π": Math.PI, e: Math.E };

  // vars: optional {x: 3} so the same parser can drive the graph plotter.
  function evaluate(src, vars) {
    vars = vars || {};
    const re = /\s*(\d+\.?\d*|\.\d+|[a-zπ]+|[-+*/^()%!,])/y;
    const tok = []; let m, last = 0;
    while (last < src.length && (m = re.exec(src))) { tok.push(m[1]); last = re.lastIndex; }
    if (src.slice(last).trim()) throw new Error("parse");
    let i = 0;
    const peek = () => tok[i], next = () => tok[i++];
    const isNum = t => t !== undefined && /^[\d.]/.test(t);
    const startsOperand = t => t !== undefined && (isNum(t) || t === "(" || /^[a-zπ]/.test(t));

    function expr() {
      let v = term();
      while (peek() === "+" || peek() === "-") v = next() === "+" ? v + term() : v - term();
      return v;
    }
    function term() {
      let v = unary();
      for (;;) {
        if (peek() === "*") { next(); v *= unary(); }
        else if (peek() === "/") { next(); v /= unary(); }
        else if (startsOperand(peek())) v *= unary();       // implicit: 2(3+4), 3pi, 2x
        else return v;
      }
    }
    function unary() {
      if (peek() === "-") { next(); return -unary(); }
      if (peek() === "+") { next(); return unary(); }
      return power();
    }
    function power() {
      const b = postfix();
      if (peek() === "^") { next(); return Math.pow(b, unary()); }
      return b;
    }
    function postfix() {
      let v = primary();
      while (peek() === "%" || peek() === "!") {
        if (next() === "%") v /= 100;
        else { if (v < 0 || v > 170 || v % 1) throw new Error("fact"); let f = 1; for (let k = 2; k <= v; k++) f *= k; v = f; }
      }
      return v;
    }
    function primary() {
      const t = next();
      if (t === undefined) throw new Error("parse");
      if (isNum(t)) return parseFloat(t);
      if (t === "(") { const v = expr(); if (next() !== ")") throw new Error("parse"); return v; }
      if (Object.prototype.hasOwnProperty.call(vars, t)) return vars[t];
      if (Object.prototype.hasOwnProperty.call(FUNCS, t)) {
        if (peek() === "(") { next(); const v = expr(); if (next() !== ")") throw new Error("parse"); return FUNCS[t](v); }
        return FUNCS[t](primary());
      }
      if (Object.prototype.hasOwnProperty.call(CONSTS, t)) return CONSTS[t];
      throw new Error("parse");
    }
    const v = expr();
    if (i < tok.length) throw new Error("parse");
    return v;
  }

  function fmt(n) {
    if (!isFinite(n)) return "Can't be calculated (try a different question)";
    return Number(n.toPrecision(12)).toLocaleString("en-US", { maximumFractionDigits: 10 });
  }

  const api = { normalize, evaluate, fmt };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Engine = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
