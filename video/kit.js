/*
  Motion kit shared by the launch and demo players. Every function is a pure function of time
  (seconds), so a frame renders the same way whenever it is sought.

  The look it encodes, distilled from studied reference launch videos:
  - small, clean sans type with generous space; words arrive from blur to sharp, a phrase at a time
  - continuous motion instead of hard cuts: blur dissolves, zoom-throughs into a word
  - calm grounds: a light canvas with soft colour washes, or near-black with a spotlight and a grid
  - real UI in 3D-tilted devices, floating depth-blurred cards, soft-edged screens
  - interaction on screen: a prompt that types and sends, a cursor that clicks, lists that light up
*/
(function () {
  const KIT = (window.KIT = {});
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const eo = (x) => 1 - Math.pow(1 - x, 3);
  const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const expo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
  const back = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const prog = (l, t0, d, ease = eo) => ease(clamp((l - t0) / Math.max(1e-6, d)));
  const px = (n) => n + "px";
  function h(tag, cls = "", style = {}, html = "") { const e = document.createElement(tag); if (cls) e.className = cls; Object.assign(e.style, style); if (html) e.innerHTML = html; return e; }
  const rgba = (hex, a) => { const s = hex.replace("#", ""); const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  Object.assign(KIT, { clamp, lerp, eo, eio, expo, back, prog, px, h, rgba });

  KIT.init = function (W, H) {
    const U = Math.min(W, H) / 100;
    Object.assign(KIT, { W, H, U, LAND: W > H * 1.2, PORT: H > W * 1.2 });
    document.documentElement.style.setProperty("--u", U + "px");
    return KIT;
  };

  KIT.css = `
  .fill{position:absolute;inset:0}
  .center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .txt{font-family:var(--sans);font-weight:500;letter-spacing:-.028em;line-height:1.1;color:var(--ink)}
  .txt .w{display:inline-block;white-space:pre}
  .acc-serif{font-family:var(--serif);font-style:italic;font-weight:400;letter-spacing:-.01em;color:var(--accent);padding-right:.04em}
  .acc-color{color:var(--accent)}
  .acc-pill{font-family:var(--serif);font-style:italic;font-weight:400;letter-spacing:-.01em;color:var(--accentInk);background:var(--accent);border-radius:999px;padding:.02em .42em .1em;margin:0 .06em}
  .acc-highlight{position:relative;isolation:isolate}
  .acc-highlight::before{content:"";position:absolute;left:-.1em;right:-.1em;top:.1em;bottom:.02em;background:var(--mark);border-radius:.16em;transform-origin:0 50%;transform:scaleX(var(--hl,0));z-index:-1}
  .mono{font-family:var(--mono)}
  .muted{color:var(--muted)}
  .card{position:absolute;border-radius:calc(var(--u)*2.2);background:var(--card);overflow:hidden;color:var(--ink)}
  .lift{box-shadow:0 calc(var(--u)*2.6) calc(var(--u)*8) rgba(15,23,42,.16),0 0 0 1px var(--line)}
  .faded{-webkit-mask-image:radial-gradient(ellipse 74% 72% at 50% 44%,#000 56%,transparent 100%);mask-image:radial-gradient(ellipse 74% 72% at 50% 44%,#000 56%,transparent 100%);box-shadow:none!important;background:transparent!important}
  .dot{display:inline-block;width:calc(var(--u)*1);height:calc(var(--u)*1);border-radius:50%;flex:none}
  .phone{position:absolute;border-radius:calc(var(--u)*6.2);background:#0b0c0f;box-shadow:0 calc(var(--u)*5) calc(var(--u)*14) rgba(15,23,42,.34),inset 0 0 0 calc(var(--u)*.28) #2b2d33;transform-style:preserve-3d}
  .phone .screen{position:absolute;inset:calc(var(--u)*1.1);border-radius:calc(var(--u)*5.2);overflow:hidden;background:#fff}
  .phone .island{position:absolute;left:50%;top:calc(var(--u)*2.1);width:calc(var(--u)*8.6);height:calc(var(--u)*2.5);border-radius:999px;background:#000;transform:translateX(-50%);z-index:3}
  .browser,.plain{position:absolute;border-radius:calc(var(--u)*1.5);background:#fff;overflow:hidden}
  .browser .bar{position:absolute;left:0;right:0;top:0;height:calc(var(--u)*3.4);background:#f4f5f7;display:flex;align-items:center;gap:calc(var(--u)*.6);padding:0 calc(var(--u)*1.3);border-bottom:1px solid #e6e8ec}
  .browser .bar i{width:calc(var(--u)*.85);height:calc(var(--u)*.85);border-radius:50%;background:#d4d7dd;display:block;flex:none}
  .browser .url{margin:0 auto;height:calc(var(--u)*2);min-width:32%;border-radius:999px;background:#fff;box-shadow:0 0 0 1px #e6e8ec;font:calc(var(--u)*1.15)/calc(var(--u)*2) var(--mono);color:#6b7280;padding:0 calc(var(--u)*1.4);text-align:center;white-space:nowrap}
  .view{position:absolute;left:0;right:0;bottom:0;top:0;overflow:hidden}
  .view img,.screen img{position:absolute;left:0;top:0;transform-origin:0 0;max-width:none}
  .cursor{position:absolute;width:calc(var(--u)*3.1);height:calc(var(--u)*3.1);transform-origin:14% 10%;filter:drop-shadow(0 calc(var(--u)*.35) calc(var(--u)*.7) rgba(0,0,0,.3));opacity:0;z-index:40;pointer-events:none;margin:calc(var(--u)*-.3) 0 0 calc(var(--u)*-.4)}
  .ripple{position:absolute;border-radius:50%;border:calc(var(--u)*.3) solid var(--accent);transform:translate(-50%,-50%);opacity:0;z-index:39;pointer-events:none}
  .tap{position:absolute;width:calc(var(--u)*5);height:calc(var(--u)*5);border-radius:50%;background:rgba(255,255,255,.6);box-shadow:0 0 0 calc(var(--u)*.35) rgba(15,23,42,.18);transform:translate(-50%,-50%);opacity:0;z-index:5}
  .callout{position:absolute;display:flex;align-items:center;gap:calc(var(--u)*.8);white-space:nowrap;font:500 calc(var(--u)*2.2)/1 var(--sans);letter-spacing:-.01em;color:var(--ink);background:var(--card);padding:calc(var(--u)*1.3) calc(var(--u)*1.9);border-radius:999px;box-shadow:0 calc(var(--u)*1.2) calc(var(--u)*3.6) rgba(15,23,42,.18),0 0 0 1px var(--line);opacity:0;z-index:30}
  .field{position:absolute;display:flex;align-items:center;gap:calc(var(--u)*1.2);background:var(--card);border-radius:calc(var(--u)*2.2);box-shadow:0 calc(var(--u)*2.2) calc(var(--u)*7) rgba(15,23,42,.13),0 0 0 1px var(--line);padding:0 calc(var(--u)*1.1) 0 calc(var(--u)*2.6)}
  .field .val{flex:1;font:400 calc(var(--u)*3.2)/1.2 var(--sans);letter-spacing:-.01em;color:var(--ink);white-space:nowrap;overflow:hidden}
  .field .ph{color:var(--muted)}
  .field .caret{display:inline-block;width:calc(var(--u)*.22);height:1.05em;background:var(--accent);vertical-align:-.16em;margin-left:.05em}
  .field .send{height:calc(var(--u)*6.6);min-width:calc(var(--u)*6.6);padding:0 calc(var(--u)*2.2);border-radius:calc(var(--u)*1.7);background:var(--ink);color:var(--bg);display:grid;place-items:center;font:600 calc(var(--u)*2.4)/1 var(--sans);flex:none}
  .rows{display:flex;flex-direction:column;gap:calc(var(--u)*1.5);padding:calc(var(--u)*3) calc(var(--u)*3.2)}
  .rows .r{font:400 calc(var(--u)*2.8)/1.4 var(--sans);color:var(--ink);display:flex;align-items:center;gap:calc(var(--u)*1)}
  `;

  // ---------------- text ----------------
  KIT.rich = (t = "", style = "serif") => String(t).replace(/\*([^*]+)\*/g, `<span class="acc acc-${style}">$1</span>`);
  /** Split text into word spans; *accent* becomes one span styled serif / color / pill / highlight; \n breaks lines. */
  KIT.words = function (text, style = "serif") {
    const el = h("div", "txt"), ws = [], acc = [];
    String(text).split("\n").forEach((line, li) => {
      if (li) el.appendChild(document.createElement("br"));
      for (const seg of line.split(/(\*[^*]+\*)/).filter(Boolean)) {
        if (seg.length > 2 && seg.startsWith("*") && seg.endsWith("*")) {
          const w = h("span", `w acc acc-${style}`); w.textContent = seg.slice(1, -1); el.appendChild(w); ws.push(w); acc.push(w); continue;
        }
        for (const part of seg.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(" ")); continue; }
          const w = h("span", "w"); w.textContent = part; el.appendChild(w); ws.push(w);
        }
      }
    });
    return { el, ws, acc };
  };
  /** From blur to sharp, rising a little. */
  KIT.blurIn = function (el, l, t0, d = 0.65, rise = 0.3) {
    const k = expo(clamp((l - t0) / d));
    el.style.opacity = k;
    el.style.filter = k < 0.995 ? `blur(${((1 - k) * 1.1 * KIT.U).toFixed(2)}px)` : "none";
    el.style.transform = `translateY(${((1 - k) * rise).toFixed(3)}em)`;
    return k;
  };
  KIT.blurOut = function (el, l, t0, d = 0.35) {
    const k = eo(clamp((l - t0) / d));
    if (k <= 0) return 0;
    el.style.opacity = 1 - k; el.style.filter = `blur(${(k * 1.2 * KIT.U).toFixed(2)}px)`;
    return k;
  };
  KIT.revealWords = function (w, l, t0, stagger = 0.09, d = 0.65) {
    w.ws.forEach((el, i) => KIT.blurIn(el, l, t0 + i * stagger, d));
    for (const a of w.acc) {
      const ta = t0 + w.ws.indexOf(a) * stagger + 0.18;
      if (a.classList.contains("acc-highlight")) a.style.setProperty("--hl", eio(clamp((l - ta) / 0.5)).toFixed(3));
      if (a.classList.contains("acc-pill")) { const k = back(clamp((l - ta + 0.1) / 0.55)); a.style.transform = `scale(${(0.7 + 0.3 * k).toFixed(3)})`; a.style.filter = "none"; a.style.opacity = clamp(k * 1.6); }
    }
  };
  KIT.fit = function (el, maxW) { el.style.width = "max-content"; const w = el.offsetWidth; if (w > maxW) el.style.fontSize = px(parseFloat(getComputedStyle(el).fontSize) * maxW / w); };

  // ---------------- themes and background ----------------
  KIT.THEMES = {
    light: { bg: "#fbfbfa", ink: "#0b0c0f", muted: "rgba(11,12,15,.5)", line: "rgba(15,23,42,.08)", card: "#ffffff", mark: "rgba(47,91,234,.16)", accent: "#2f5bea", accentInk: "#ffffff",
      washes: ["#c7d7ff", "#ffe3d0"], washAlpha: 0.75, washSize: 0.62, spotlight: 0, grid: 0, stars: 0, grain: 0, vignette: 0 },
    dark: { bg: "#060608", ink: "#f4f5f7", muted: "rgba(244,245,247,.56)", line: "rgba(255,255,255,.1)", card: "#111217", mark: "rgba(143,176,255,.22)", accent: "#8fb0ff", accentInk: "#060608",
      washes: ["#2b46ff"], washAlpha: 0.2, washSize: 0.6, spotlight: 0.2, grid: 0.08, stars: 10, grain: 0.035, vignette: 0.5 },
  };
  KIT.theme = function (base = {}, over = {}) {
    const baseMode = base.mode ?? "light", mode = over.mode ?? baseMode;
    const carry = mode === baseMode ? base : { accent: base.darkAccent ?? KIT.THEMES[mode].accent };
    return { ...KIT.THEMES[mode], ...carry, ...over, mode };
  };
  KIT.applyTheme = function (el, th) { for (const k of ["ink", "muted", "line", "card", "mark", "accent", "accentInk", "bg"]) el.style.setProperty("--" + k, th[k]); };

  let grain = null;
  function grainTile(g) {
    if (grain) return grain;
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d"), im = x.createImageData(256, 256); let s = 99991;
    for (let i = 0; i < im.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const v = s >>> 24; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    x.putImageData(im, 0, 0); grain = g.createPattern(c, "repeat"); return grain;
  }
  KIT.drawTheme = function (g, th, t, alpha = 1) {
    const W = g.canvas.width, H = g.canvas.height, U = KIT.U, R = Math.max(W, H);
    g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = "source-over";
    g.fillStyle = th.bg; g.fillRect(0, 0, W, H);
    const anchors = th.anchors ?? [[0.06, 1.02], [0.96, 0.02], [0.94, 0.98], [0.04, 0.02]];
    (th.washes ?? []).forEach((c, i) => {
      const [ax, ay] = anchors[i % anchors.length];
      const cx = W * (ax + 0.05 * Math.sin(t * 0.19 + i * 2.1)), cy = H * (ay + 0.05 * Math.cos(t * 0.15 + i));
      const r = R * th.washSize * (1 + 0.06 * Math.sin(t * 0.27 + i));
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, rgba(c, th.washAlpha)); gr.addColorStop(0.5, rgba(c, th.washAlpha * 0.4)); gr.addColorStop(1, rgba(c, 0));
      g.globalCompositeOperation = th.mode === "dark" ? "lighter" : "source-over";
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    });
    g.globalCompositeOperation = "source-over";
    if (th.spotlight) { const gr = g.createRadialGradient(W / 2, H * 1.1, 0, W / 2, H * 1.1, R * 0.6); gr.addColorStop(0, `rgba(255,255,255,${th.spotlight})`); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    const col = th.mode === "dark" ? "255,255,255" : "15,23,42";
    if (th.grid) {
      const hz = H * (th.horizon ?? 0.5); g.lineWidth = Math.max(1, U * 0.09);
      for (let i = -24; i <= 24; i++) {
        const lg = g.createLinearGradient(0, hz, 0, H); lg.addColorStop(0, `rgba(${col},0)`); lg.addColorStop(1, `rgba(${col},${th.grid})`);
        g.strokeStyle = lg; g.beginPath(); g.moveTo(W / 2 + i * W * 0.012, hz); g.lineTo(W / 2 + i * W * 0.13, H); g.stroke();
      }
      const off = (t * 0.22) % 1;
      for (let j = 0; j < 16; j++) { const z = (j + off) / 16, y = hz + (H - hz) * z * z; g.strokeStyle = `rgba(${col},${th.grid * z})`; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    }
    if (th.stars) {
      let s = 424242;
      for (let k = 0; k < th.stars; k++) {
        s = (s * 1664525 + 1013904223) >>> 0; const x = (s / 2 ** 32) * W; s = (s * 1664525 + 1013904223) >>> 0; const y = (s / 2 ** 32) * H;
        const a = 0.35 * (0.5 + 0.5 * Math.sin(t * 1.1 + k * 1.7)), r = U * 0.8;
        g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = Math.max(1, U * 0.08);
        g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke();
      }
    }
    if (th.vignette) { const vg = g.createRadialGradient(W / 2, H / 2, R * 0.3, W / 2, H / 2, R * 0.78); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${th.vignette})`); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
    if (th.grain) {
      const f = Math.floor(t * 24); g.globalAlpha = alpha * th.grain; g.globalCompositeOperation = th.mode === "dark" ? "screen" : "multiply";
      g.translate((f * 73) % 256, (f * 151) % 256); g.fillStyle = grainTile(g); g.fillRect(-256, -256, W + 512, H + 512);
    }
    g.restore();
  };

  // ---------------- brand mark ----------------
  KIT.mark = function (brand, size) {
    const m = h("div", "mark", { width: px(size), height: px(size), flex: "none", display: "grid", placeItems: "center", boxSizing: "border-box" });
    const src = brand.mark;
    if (src && src.trim().startsWith("<svg")) { m.innerHTML = src; const svg = m.querySelector("svg"); svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%"); }
    else if (src) { const im = h("img", "", { width: "100%", height: "100%", objectFit: "contain" }); im.src = src; m.appendChild(im); }
    else { m.textContent = (brand.name ?? "?")[0]; m.style.font = `700 ${px(size * 0.5)}/1 var(--sans)`; }
    if ((brand.markStyle ?? "tile") === "tile") Object.assign(m.style, { background: "var(--accent)", color: "var(--accentInk)", borderRadius: px(size * 0.26), padding: px(size * 0.2), boxShadow: `0 ${px(size * 0.14)} ${px(size * 0.4)} ${"rgba(15,23,42,.18)"}` });
    else m.style.color = "var(--ink)";
    return m;
  };

  // ---------------- pointer, callouts, camera ----------------
  KIT.cursor = () => h("div", "cursor", {}, '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M4 2 L4 19.5 L8.7 15.2 L11.7 21.6 L14.6 20.3 L11.6 13.9 L17.8 13.7 Z" fill="#fff" stroke="#0b0d12" stroke-width="1.4" stroke-linejoin="round"/></svg>');
  /** keys: [{t, x, y, click}] — seconds and pixels in the cursor's parent. The cursor glides in before the first key. */
  KIT.moveCursor = function (el, keys, l, ripple) {
    if (!keys.length) { el.style.opacity = 0; return; }
    const U = KIT.U, k0 = keys[0];
    let x = k0.x, y = k0.y;
    if (l < k0.t) { const k = eio(clamp((l - (k0.t - 0.8)) / 0.8)); x = k0.x + (1 - k) * 9 * U; y = k0.y + (1 - k) * 11 * U; }
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1], ta = a.t + (a.click ? 0.22 : 0);
      if (l >= ta) { const u = eio(clamp((l - ta) / Math.max(1e-6, b.t - ta))); x = lerp(a.x, b.x, u); y = lerp(a.y, b.y, u); }
    }
    const last = keys.at(-1);
    el.style.opacity = (prog(l, k0.t - 0.8, 0.35) * (last.leave ? 1 - prog(l, last.t + 0.5, 0.4) : 1)).toFixed(3);
    let active = null;
    for (const k of keys) if (k.click && l >= k.t && l < k.t + 0.6) active = k;
    const press = active ? 1 - 0.15 * Math.sin(clamp((l - active.t) / 0.2) * Math.PI) : 1;
    el.style.left = px(x); el.style.top = px(y); el.style.transform = `scale(${press.toFixed(3)})`;
    if (ripple) {
      if (active) { const dt = l - active.t, r = (1.5 + (dt / 0.6) * 7) * U; Object.assign(ripple.style, { left: px(active.x), top: px(active.y), width: px(r), height: px(r), opacity: (0.85 * (1 - dt / 0.6)).toFixed(3) }); }
      else ripple.style.opacity = 0;
    }
  };
  KIT.callout = function (c, tones = {}) {
    const el = h("div", "callout");
    el.innerHTML = (c.dot ? `<span class="dot" style="background:${tones[c.dot] ?? c.dot}"></span>` : "") + KIT.rich(c.text, "color");
    return el;
  };
  KIT.placeCallout = function (el, x, y, side, k) {
    const U = KIT.U, off = 2.2 * U, tw = el.offsetWidth, th = el.offsetHeight;
    const p = { right: [x + off, y - th / 2, "0 50%"], left: [x - off - tw, y - th / 2, "100% 50%"], below: [x - tw / 2, y + off, "50% 0"], above: [x - tw / 2, y - off - th, "50% 100%"] }[side ?? "right"];
    el.style.left = px(Math.max(2 * U, Math.min(KIT.W - tw - 2 * U, p[0]))); el.style.top = px(Math.max(2 * U, Math.min(KIT.H - th - 2 * U, p[1])));
    el.style.transformOrigin = p[2]; el.style.opacity = clamp(k * 1.5).toFixed(3);
    el.style.transform = `scale(${(0.82 + 0.18 * clamp(k, 0, 1.1)).toFixed(3)})`;
    el.style.filter = k < 1 ? `blur(${((1 - clamp(k)) * 0.9 * U).toFixed(2)}px)` : "none";
  };
  /** keys: [[t, zoom, centerX, centerY]] in seconds and screenshot fractions; g: {vw, vh, iw, ih}. Clamped so the frame never shows past the image. */
  KIT.camera = function (keys, l, g) {
    let [, z, cx, cy] = keys[0];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (l >= a[0]) { const u = eio(clamp((l - a[0]) / Math.max(1e-6, b[0] - a[0]))); z = lerp(a[1], b[1], u); cx = lerp(a[2], b[2], u); cy = lerp(a[3], b[3], u); }
    }
    const sc = (g.vw / g.iw) * z, sw = g.iw * sc, sh = g.ih * sc;
    let x = Math.min(0, Math.max(g.vw - sw, g.vw / 2 - cx * sw)), y = Math.min(0, Math.max(g.vh - sh, g.vh / 2 - cy * sh));
    if (sh < g.vh) y = (g.vh - sh) / 2;
    return { sc, x, y };
  };

  // ---------------- frames ----------------
  KIT.frame = function (kind, image, url = "") {
    const img = h("img"); img.src = image;
    if (kind === "phone") { const el = h("div", "phone"), screen = h("div", "screen"); screen.appendChild(img); el.append(screen, h("div", "island")); return { el, screen, img, kind }; }
    if (kind === "browser") { const el = h("div", "browser"), bar = h("div", "bar", {}, `<i></i><i></i><i></i><div class="url">${url}</div>`), screen = h("div", "view"); screen.appendChild(img); el.append(bar, screen); return { el, screen, img, kind }; }
    const el = h("div", "plain"), screen = h("div", "view"); screen.appendChild(img); el.appendChild(screen); return { el, screen, img, kind };
  };
  /** Size a frame's outside; returns its viewport geometry for camera and pointer maths. */
  KIT.sizeFrame = function (f, w, hh) {
    const U = KIT.U, pad = f.kind === "phone" ? 1.1 * U : 0, bar = f.kind === "browser" ? 3.4 * U : 0;
    Object.assign(f.el.style, { width: px(w), height: px(hh) });
    if (f.kind === "browser") f.screen.style.top = px(bar);
    return { vw: w - 2 * pad, vh: hh - 2 * pad - bar, iw: f.img.naturalWidth || 1, ih: f.img.naturalHeight || 1, pad, bar };
  };

  // ---------------- a prompt that types and sends ----------------
  KIT.prompt = function (o) {
    const el = h("div", "field"), val = h("div", "val"), ph = h("span", "ph"), txt = h("span"), caret = h("span", "caret");
    ph.textContent = o.placeholder ?? ""; val.append(ph, txt, caret);
    const send = h("div", "send", {}, o.send ?? "↑"); el.append(val, send);
    return {
      el, send,
      update(l, t0, cps, sendAt) {
        const n = Math.floor(clamp((l - t0) * cps, 0, o.text.length));
        txt.textContent = o.text.slice(0, n); ph.style.display = n ? "none" : "inline";
        const typing = l >= t0 && n < o.text.length;
        caret.style.opacity = l > sendAt + 0.2 ? 0 : typing || Math.floor(l * 2.4) % 2 === 0 ? 1 : 0;
        const dt = l - sendAt;
        send.style.transform = dt >= 0 && dt < 0.25 ? `scale(${(1 - 0.1 * Math.sin((dt / 0.25) * Math.PI)).toFixed(3)})` : "none";
        send.style.background = dt >= 0 ? "var(--accent)" : "var(--ink)"; send.style.color = dt >= 0 ? "var(--accentInk)" : "var(--bg)";
        return n;
      },
    };
  };
})();
