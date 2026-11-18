/*
  Shot library shared by the launch engine (launch.html) and the demo player (player.html).
  Each type builds DOM for one shot and returns { el, fits, layout(), update(l) } where l is shot-local seconds.
  Times in a shot spec go through ctx.time(shot, x): beats in a launch, seconds or sentence anchors in a demo.
  "end" always means the end of the shot.
*/
window.SHOTS = function (ctx) {
  const { L, KIT } = ctx;
  const { U, LAND, PORT, W, H } = KIT;
  const { h, px, clamp, eo, eio, expo, back, lerp } = KIT;
  const ACC = L.accentStyle ?? "serif";
  const TONES = { good: "#16a34a", warn: "#d97706", bad: "#dc2626", ...(L.tones ?? {}) };
  const T = (s, x) => (x === "end" ? s.len : ctx.time(s, x));
  /** When item i of a list/features/stat shot arrives: item.at, shot.itemsAt[i], or at + i × every. */
  const itemAt = (s, i, at, every) => { const it = s.items[i]; const x = it?.at ?? s.itemsAt?.[i]; return x != null ? T(s, x) : T(s, s.at ?? at) + i * T(s, s.every ?? every); };
  const title = (text, size, extra = {}) => { const w = KIT.words(text, extra.accent ?? ACC); Object.assign(w.el.style, { fontSize: px(size), fontWeight: 500, ...extra.style }); return w; };
  const ALIAS = { hook: "sequence", punch: "statement", logo: "reveal", cta: "end", ui: "screen" };

  const TYPES = {
    /** Short phrases in the same place, one after another; `exit: "zoom"` flies into the last one. */
    sequence(s) {
      const el = h("div", "center");
      const list = PORT && s.portrait ? s.portrait : s.phrases ?? s.lines;
      const size = (s.size ?? (LAND ? 6.6 : 7.4)) * U;
      const ps = list.map((p) => { const w = title(p, size, { accent: s.accent }); Object.assign(w.el.style, { position: "absolute", left: "50%", top: "50%", textAlign: "center" }); el.appendChild(w.el); return w; });
      const starts = s.phraseAt ? s.phraseAt.map((x) => T(s, x))
        : s.phraseBeats ? s.phraseBeats.reduce((acc, b, i) => (acc.push(i ? acc[i - 1] + T(s, s.phraseBeats[i - 1]) : 0), acc), [])
        : ps.map((_, i) => (s.len * i) / ps.length);
      return { el, fits: ps.map((p) => [p.el, W * 0.86]), layout() {
        ps.forEach((p) => { const a = p.acc[0]; p.el.style.transformOrigin = a ? `${a.offsetLeft + a.offsetWidth / 2}px ${a.offsetTop + a.offsetHeight / 2}px` : "50% 50%"; });
      }, update(l) {
        ps.forEach((p, i) => {
          const t0 = starts[i], t1 = i < ps.length - 1 ? starts[i + 1] : s.len;
          const show = l >= t0 - 0.02 && (i === ps.length - 1 || l < t1);
          p.el.style.display = show ? "block" : "none";
          if (!show) return;
          KIT.revealWords(p, l, t0 + 0.04, s.stagger ?? 0.1, 0.62);
          let op = 1, bl = 0, extra = "";
          if (i < ps.length - 1) { const k = eo(clamp((l - (t1 - 0.34)) / 0.34)); op = 1 - k; bl = k * 1.2 * U; extra = ` translateY(${-k * 1.4 * U}px)`; }
          else if (s.exit === "zoom") { const z = clamp((l - (t1 - 0.6)) / 0.6), e = Math.pow(z, 2.6); extra = ` scale(${1 + e * 26})`; op = 1 - clamp((z - 0.5) / 0.5); bl = z * 0.4 * U; }
          p.el.style.transform = `translate(-50%, -50%)${extra}`; p.el.style.opacity = op; p.el.style.filter = bl ? `blur(${bl}px)` : "none";
        });
      } };
    },

    /** A big line — a number counts up — then a quieter line under it. */
    statement(s) {
      const el = h("div", "center");
      const kick = s.kicker ? h("div", "mono", { fontSize: px((LAND ? 2.2 : 2.6) * U), letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: px(3 * U) }) : null;
      if (kick) { kick.textContent = s.kicker; el.appendChild(kick); }
      const big = title(s.text ?? s.big, (s.size ?? (LAND ? 10.5 : 11.5)) * U, { accent: s.accent, style: { fontWeight: s.weight ?? 600, letterSpacing: "-.045em", lineHeight: 1 } });
      el.appendChild(big.el);
      let sub = null;
      if (s.sub ?? s.small) { sub = title(s.sub ?? s.small, (LAND ? 4 : 4.6) * U, { accent: "color", style: { fontWeight: 400, color: "var(--muted)", marginTop: px(2.6 * U), letterSpacing: "-.01em" } }); el.appendChild(sub.el); }
      const ni = big.ws.findIndex((w) => /\d/.test(w.textContent)), num = big.ws[ni];
      const m = num ? /^([^\d]*)([\d][\d,]*(?:\.\d+)?)(.*)$/.exec(num.textContent) : null;
      if (num) num.style.fontVariantNumeric = "tabular-nums";
      return { el, fits: [[big.el, W * 0.88], ...(sub ? [[sub.el, W * 0.86]] : [])], update(l) {
        const t0 = T(s, s.at ?? 0) + 0.05;
        if (kick) KIT.blurIn(kick, l, 0.05, 0.7, 0.2);
        KIT.revealWords(big, l, t0, 0.12, 0.7);
        if (m && s.count !== false && parseFloat(m[2].replace(/,/g, "")) >= 10) { const v = parseFloat(m[2].replace(/,/g, "")), dec = m[2].includes(".") ? m[2].split(".")[1].length : 0; num.textContent = m[1] + (v * eio(clamp((l - t0) / T(s, s.countBeats ?? 2)))).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3]; }
        if (sub) KIT.revealWords(sub, l, T(s, s.subAt ?? 1.6), 0.05, 0.6);
        el.style.transform = `scale(${1 + 0.02 * clamp(l / s.len)})`;
      } };
    },

    /** The mark arrives alone, then the name slides out from behind it; tagline below. */
    reveal(s) {
      const el = h("div", "center");
      const row = h("div", "", { display: "flex", alignItems: "center", gap: px((s.gap ?? 2) * U) });
      const mk = KIT.mark(L.brand, (s.markSize ?? (LAND ? 9.5 : 11)) * U);
      const wrap = h("div", "", { overflow: "hidden", paddingRight: px(0.6 * U) });
      const nm = h("div", "txt", { fontSize: px((s.size ?? (LAND ? 9 : 10.5)) * U), fontWeight: 600, letterSpacing: "-.045em", whiteSpace: "nowrap", lineHeight: 1.05 });
      nm.textContent = L.brand.name; wrap.appendChild(nm); row.append(mk, wrap); el.appendChild(row);
      const tagText = s.tagline ?? L.brand.tagline;
      const tag = tagText ? title(tagText, (LAND ? 4.4 : 5.2) * U, { accent: s.accent, style: { fontWeight: 400, color: "var(--muted)", marginTop: px(3.2 * U) } }) : null;
      if (tag) el.appendChild(tag.el);
      let shift = 0;
      return { el, fits: tag ? [[tag.el, W * 0.86]] : [], layout() { shift = (wrap.offsetWidth + (s.gap ?? 2) * U) / 2; }, update(l) {
        const km = clamp((l - 0.05) / 0.75), kb = back(km);
        mk.style.opacity = clamp(km * 2); mk.style.transform = `scale(${(0.5 + 0.5 * kb).toFixed(3)}) rotate(${((1 - eo(km)) * -12).toFixed(2)}deg)`; mk.style.filter = km < 1 ? `blur(${(1 - eo(km)) * 1.4 * U}px)` : "none";
        const ks = expo(clamp((l - T(s, s.splitAt ?? 1)) / 1.0));
        row.style.transform = `translateX(${((1 - ks) * shift).toFixed(2)}px)`;
        wrap.style.clipPath = `inset(-20% ${((1 - ks) * 100).toFixed(2)}% -20% 0)`;
        nm.style.transform = `translateX(${(-(1 - ks) * 30).toFixed(2)}%)`; nm.style.opacity = clamp(ks * 1.6);
        if (tag) KIT.revealWords(tag, l, T(s, s.taglineAt ?? 2.2), 0.08, 0.7);
        el.style.transform = `scale(${1 + 0.03 * clamp(l / s.len)})`;
      } };
    },

    /** A field that types, a cursor that presses send, and an answer that arrives underneath. */
    prompt(s) {
      const el = h("div", "fill");
      const t = s.title ? title(s.title, (LAND ? 5.4 : 6.4) * U, { accent: s.accent, style: { position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center" } }) : null;
      if (t) el.appendChild(t.el);
      const pr = KIT.prompt({ text: s.text, placeholder: s.placeholder, send: s.send }); el.appendChild(pr.el);
      let card = null, rows = [];
      if (s.result) { card = h("div", "card lift"); const box = h("div", "rows"); rows = s.result.map((r) => { const d = h("div", "r"); d.innerHTML = KIT.rich(r, "color"); box.appendChild(d); return d; }); card.appendChild(box); el.appendChild(card); }
      const cur = KIT.cursor(), rip = h("div", "ripple"); el.append(rip, cur);
      const cps = s.cps ?? 14, typeAt = T(s, s.typeAt ?? 0.9), sendAt = s.sendAt != null ? T(s, s.sendAt) : s.sendBeat ? T(s, s.sendBeat) : typeAt + s.text.length / cps + 0.55;
      let send = { x: 0, y: 0 };
      return { el, fits: t ? [[t.el, W * 0.9]] : [], layout() {
        const fw = LAND ? W * 0.52 : W * 0.88, fh = (LAND ? 9.2 : 10) * U;
        if (card) card.style.width = px(fw);
        const tH = t ? t.el.offsetHeight + 4 * U : 0, cH = card ? card.offsetHeight + 2.4 * U : 0;
        let y = (H - (tH + fh + cH)) / 2;
        if (t) { t.el.style.top = px(y); y += tH; }
        Object.assign(pr.el.style, { left: px((W - fw) / 2), top: px(y), width: px(fw), height: px(fh) });
        if (card) Object.assign(card.style, { left: px((W - fw) / 2), top: px(y + fh + 2.4 * U) });
        const r = pr.send.getBoundingClientRect(), o = el.getBoundingClientRect(); send = { x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2 };
      }, update(l) {
        if (t) KIT.revealWords(t, l, 0.05, 0.08, 0.6);
        const kf = expo(clamp((l - 0.25) / 0.9));
        pr.el.style.opacity = kf; pr.el.style.transform = `translateY(${(1 - kf) * 3 * U}px) scale(${0.97 + 0.03 * kf})`; pr.el.style.filter = kf < 0.995 ? `blur(${(1 - kf) * U}px)` : "none";
        pr.update(l, typeAt, cps, sendAt);
        KIT.moveCursor(cur, [{ t: sendAt - 0.75, x: send.x + 6 * U, y: send.y + 6 * U }, { t: sendAt, x: send.x, y: send.y, click: true, leave: true }], l, rip);
        if (card) {
          const kc = expo(clamp((l - sendAt - 0.3) / 0.9));
          card.style.opacity = kc; card.style.transform = `translateY(${(1 - kc) * 4 * U}px)`; card.style.filter = kc < 0.995 ? `blur(${(1 - kc) * 1.2 * U}px)` : "none";
          rows.forEach((r, i) => KIT.blurIn(r, l, s.rowsAt?.[i] != null ? T(s, s.rowsAt[i]) : sendAt + 0.45 + i * 0.16, 0.6, 0.2));
        }
      } };
    },

    /** A real screenshot, large: plain, browser or soft-edged (fade: true); camera, callouts, cursor. */
    screen(s) {
      const el = h("div", "fill");
      const t = s.title ? title(s.title, (LAND ? 5.4 : 6.4) * U, { accent: s.accent, style: { position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center" } }) : null;
      if (t) el.appendChild(t.el);
      const f = KIT.frame(s.frame ?? "plain", s.image, s.url ?? L.brand.url);
      f.el.classList.add(s.fade ? "faded" : "lift"); el.appendChild(f.el);
      const calls = (s.callouts ?? []).map((c) => { const e = KIT.callout(c, TONES); el.appendChild(e); return { c, e }; });
      const cur = KIT.cursor(), rip = h("div", "ripple"); el.append(rip, cur);
      let g = null, box = { x: 0, y: 0 };
      return { el, fits: t ? [[t.el, W * 0.9]] : [], layout() {
        const top0 = t ? (LAND ? H * 0.09 : H * 0.08) : 0;
        if (t) t.el.style.top = px(top0);
        const availTop = t ? top0 + t.el.offsetHeight + 3.6 * U : 6 * U, availH = H - availTop - 6 * U;
        const iw = f.img.naturalWidth, ih = f.img.naturalHeight, bar = f.kind === "browser" ? 3.4 * U : 0;
        const fw = W * (LAND ? s.width ?? 0.7 : s.portraitWidth ?? 0.9), fh = Math.min(fw * ih / iw + bar, availH);
        const left = (W - fw) / 2, top = availTop + (availH - fh) / 2;
        Object.assign(f.el.style, { left: px(left), top: px(top) });
        g = KIT.sizeFrame(f, fw, fh); box = { x: left, y: top + bar };
      }, update(l) {
        if (t) KIT.revealWords(t, l, 0.05, 0.08, 0.6);
        const k = expo(clamp((l - 0.15) / 1.0));
        f.el.style.opacity = k; f.el.style.transform = `translateY(${(1 - k) * 5 * U}px) scale(${1.04 - 0.04 * k})`; f.el.style.filter = k < 0.995 ? `blur(${(1 - k) * 1.4 * U}px)` : "none";
        const cam = KIT.camera((s.camera ?? [[0, 1, 0.5, 0], ["end", 1.05, 0.5, 0.06]]).map((c) => [T(s, c[0]), c[1], c[2], c[3]]), l, g);
        f.img.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.sc})`;
        const pt = (nx, ny) => [box.x + cam.x + nx * g.iw * cam.sc, box.y + cam.y + ny * g.ih * cam.sc];
        for (const { c, e } of calls) { const [x, y] = pt(c.x, c.y); KIT.placeCallout(e, x, y, c.side, back(clamp((l - T(s, c.beat ?? c.at)) / 0.55))); }
        KIT.moveCursor(cur, (s.cursor ?? []).map((k) => { const [x, y] = pt(k.x, k.y); return { ...k, t: T(s, k.beat ?? k.at), x, y }; }), l, rip);
      } };
    },

    /** A phone (or browser) in 3D: rises and settles, sways, scrolls, gets tapped; cards float at depth. */
    device(s) {
      const el = h("div", "fill");
      const phone = (s.frame ?? "phone") === "phone";
      const t = s.title ? title(s.title, (LAND ? 6.4 : 6.4) * U, { accent: s.accent }) : null;
      const mkCard = (c) => { const cd = h("div", "card lift", { padding: px(2.1 * U) + " " + px(2.8 * U), display: "flex", flexDirection: "column", gap: px(0.6 * U), whiteSpace: "nowrap" });
        cd.innerHTML = (c.label ? `<div class="mono" style="font-size:${px(1.6 * U)};letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">${c.label}</div>` : "") + (c.big ? `<div style="font:600 ${px(4.4 * U)}/1 var(--sans);letter-spacing:-.035em">${KIT.rich(c.big, "color")}</div>` : "") + (c.text ? `<div style="font:500 ${px(2.4 * U)}/1.3 var(--sans);display:flex;align-items:center;gap:${px(0.8 * U)}">${c.dot ? `<span class="dot" style="background:${TONES[c.dot] ?? c.dot}"></span>` : ""}${KIT.rich(c.text, "color")}</div>` : "");
        return { c, cd }; };
      const cards = (s.cards ?? []).map(mkCard);
      for (const { c, cd } of cards) if ((c.depth ?? 0) < 0) el.appendChild(cd);
      const persp = h("div", "fill", { perspective: px(Math.max(W, H) * 1.25) }); el.appendChild(persp);
      const f = KIT.frame(phone ? "phone" : "browser", s.image, s.url ?? L.brand.url); persp.appendChild(f.el);
      for (const { c, cd } of cards) if ((c.depth ?? 0) >= 0) el.appendChild(cd);
      if (t) el.appendChild(t.el);
      const tap = h("div", "tap"); f.screen.appendChild(tap);
      let g = null, base = 1, maxScroll = 0;
      return { el, fits: [], layout() {
        if (t) Object.assign(t.el.style, LAND ? { position: "absolute", left: px(7 * U), top: "50%", transform: "translateY(-50%)", width: px(W * 0.34), textAlign: "left" } : { position: "absolute", left: "50%", top: px(H * 0.08), transform: "translateX(-50%)", width: px(W * 0.86), textAlign: "center" });
        const pad = 1.1 * U;
        let dw, dh;
        if (phone) { dh = LAND ? H * 0.84 : t ? H * 0.62 : H * 0.76; dw = (dh - 2 * pad) * 0.47 + 2 * pad; }
        else { dw = LAND ? W * (t ? 0.54 : 0.72) : W * 0.9; dh = Math.min(dw * f.img.naturalHeight / f.img.naturalWidth + 3.4 * U, H * 0.72); }
        const cx = LAND ? (t ? W * 0.66 : W / 2) : W / 2;
        const cy = LAND ? H * 0.52 : t ? H * 0.08 + t.el.offsetHeight + 4 * U + dh / 2 : H / 2;
        Object.assign(f.el.style, { left: px(cx - dw / 2), top: px(cy - dh / 2) });
        persp.style.perspectiveOrigin = `${cx}px ${cy}px`;
        g = KIT.sizeFrame(f, dw, dh); base = g.vw / g.iw; maxScroll = Math.max(0, g.ih * base - g.vh);
      }, update(l) {
        if (t) KIT.revealWords(t, l, 0.05, 0.08, 0.6);
        const k = expo(clamp((l - 0.1) / 1.25));
        const rx = (s.tilt ?? 8) * k + (1 - k) * 42 + Math.cos(l * 0.8) * 1.2, ry = (s.turn ?? (LAND && t ? -10 : 0)) * k + Math.sin(l * 0.7) * (s.sway ?? 4) * k;
        f.el.style.transform = `translateY(${(1 - k) * H * 0.45}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        f.el.style.opacity = clamp(k * 2.5);
        const sk = s.scroll ?? [[0, 0]];
        let sy = sk[0][1];
        for (let i = 0; i < sk.length - 1; i++) if (l >= T(s, sk[i][0])) sy = lerp(sk[i][1], sk[i + 1][1], eio(clamp((l - T(s, sk[i][0])) / Math.max(1e-6, T(s, sk[i + 1][0]) - T(s, sk[i][0])))));
        const yOff = sy * maxScroll;
        f.img.style.transform = `translate(0px, ${-yOff}px) scale(${base})`;
        let tapOn = null;
        for (const tp of s.taps ?? []) if (l >= T(s, tp.beat ?? tp.at) && l < T(s, tp.beat ?? tp.at) + 0.6) tapOn = tp;
        if (tapOn) { const dt = (l - T(s, tapOn.beat ?? tapOn.at)) / 0.6; Object.assign(tap.style, { left: px(tapOn.x * g.vw), top: px(tapOn.y * g.ih * base - yOff), opacity: (0.95 * (1 - dt)).toFixed(3), transform: `translate(-50%,-50%) scale(${(0.5 + dt * 1.1).toFixed(3)})` }); } else tap.style.opacity = 0;
        cards.forEach(({ c, cd }, i) => {
          const d = c.depth ?? 0, kc = expo(clamp((l - T(s, c.beat ?? c.at ?? 1)) / 0.9));
          const [cx0, cy0] = PORT && c.portrait ? c.portrait : [c.x, c.y];
          const x = cx0 * W + Math.sin(l * 0.5 + i) * (1 + Math.abs(d)) * 0.9 * U, y = cy0 * H + (1 - kc) * 5 * U + Math.cos(l * 0.45 + i * 2) * (1 + Math.abs(d)) * 0.7 * U;
          cd.style.left = px(x - cd.offsetWidth / 2); cd.style.top = px(y - cd.offsetHeight / 2);
          cd.style.opacity = (kc * (d < 0 ? 0.8 : 1)).toFixed(3);
          cd.style.filter = `blur(${((d < 0 ? -d * 0.45 : d * 0.08) * U + (1 - kc) * 1.2 * U).toFixed(2)}px)`;
          cd.style.transform = `scale(${((1 + d * 0.08) * (0.92 + 0.08 * kc)).toFixed(3)})`;
        });
      } };
    },

    /** Items down the left light up one at a time; a panel on the right shows each one. */
    list(s) {
      const el = h("div", "fill");
      const n = s.items.length;
      const rows = s.items.map((it) => {
        const tt = typeof it === "string" ? { title: it } : it;
        const row = h("div", "txt", { position: "absolute", display: "flex", alignItems: "center", gap: px(1.6 * U), fontSize: px((LAND ? 5.2 : 5.6) * U), letterSpacing: "-.03em", whiteSpace: "nowrap" });
        const dot = h("span", "dot", { width: px(1.1 * U), height: px(1.1 * U), background: TONES[tt.dot] ?? tt.dot ?? "var(--accent)" });
        const lab = h("span"); lab.innerHTML = KIT.rich(tt.title, ACC); row.append(dot, lab); el.appendChild(row);
        return { tt, row, dot };
      });
      const panel = h("div", "card lift"); el.appendChild(panel);
      const panes = rows.map(({ tt }) => {
        const p = h("div", "fill", { opacity: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: px(5 * U), gap: px(2 * U) });
        if (tt.image) { const im = h("img", "", { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: tt.fit ?? "cover", objectPosition: tt.position ?? "50% 0%" }); im.src = tt.image; p.appendChild(im); }
        else p.innerHTML = `${tt.kicker ? `<div class="mono" style="display:flex;align-items:center;gap:${px(1.2 * U)};font-size:${px(2.2 * U)};letter-spacing:.14em;text-transform:uppercase;color:${TONES[tt.dot] ?? tt.dot ?? "var(--accent)"}"><span class="dot" style="width:${px(1.6 * U)};height:${px(1.6 * U)};background:currentColor;box-shadow:0 0 0 ${px(0.7 * U)} color-mix(in srgb, currentColor 18%, transparent)"></span>${tt.kicker}</div>` : ""}<div style="font:600 ${px((LAND ? 5.6 : 6) * U)}/1.05 var(--sans);letter-spacing:-.04em">${KIT.rich(tt.headline ?? tt.title, ACC)}</div>${tt.body ? `<div style="font:400 ${px((LAND ? 2.9 : 3.2) * U)}/1.45 var(--sans);color:var(--muted)">${KIT.rich(tt.body, "color")}</div>` : ""}`;
        panel.appendChild(p); return p;
      });
      return { el, fits: [], layout() {
        const rh = (LAND ? 8.4 : 7.8) * U;
        if (LAND) { const y0 = (H - n * rh) / 2; rows.forEach((r, i) => Object.assign(r.row.style, { left: px(W * 0.1), top: px(y0 + i * rh) })); Object.assign(panel.style, { left: px(W * 0.42), top: px(H * 0.25), width: px(W * 0.48), height: px(H * 0.5) }); }
        else { const y0 = H * 0.2; rows.forEach((r, i) => Object.assign(r.row.style, { left: px(W * 0.08), top: px(y0 + i * rh) })); const top = y0 + n * rh + 4 * U; Object.assign(panel.style, { left: px(W * 0.07), top: px(top), width: px(W * 0.86), height: px(Math.min(H - top - 8 * U, H * 0.36)) }); }
      }, update(l) {
        const st = s.items.map((_, i) => itemAt(s, i, 0.8, 2));
        let active = -1; st.forEach((t, i) => { if (l >= t) active = i; });
        rows.forEach((r, i) => {
          const k = expo(clamp((l - 0.05 - i * 0.1) / 0.6)), on = i === active, ko = on ? eo(clamp((l - st[i]) / 0.35)) : 0;
          r.row.style.opacity = (k * (active < 0 ? 1 : 0.3 + 0.7 * ko)).toFixed(3);
          r.row.style.filter = k < 0.995 ? `blur(${(1 - k) * U}px)` : "none";
          r.row.style.transform = `translate(${(ko * 1.2 * U).toFixed(2)}px, ${((1 - k) * 2 * U).toFixed(2)}px)`;
          r.dot.style.transform = `scale(${(0.4 + 0.6 * Math.max(ko, active < 0 ? 1 : 0)).toFixed(3)})`;
        });
        const kp = expo(clamp((l - 0.3) / 1.0));
        panel.style.opacity = kp; panel.style.transform = `translateY(${(1 - kp) * 4 * U}px)`; panel.style.filter = kp < 0.995 ? `blur(${(1 - kp) * 1.2 * U}px)` : "none";
        panes.forEach((p, i) => {
          const since = l - st[i], kin = i === active ? eo(clamp(since / 0.45)) : 0;
          const prevOut = active === i + 1 ? 1 - eo(clamp((l - st[i + 1]) / 0.45)) : 0;
          const k = Math.max(kin, prevOut);
          p.style.opacity = k.toFixed(3); p.style.filter = k < 0.995 ? `blur(${(1 - k) * U}px)` : "none"; p.style.transform = `scale(${(0.98 + 0.02 * k).toFixed(3)})`;
        });
      } };
    },

    /** Three or four cards, one after another. Items: "text" or {title, sub, kicker}. */
    features(s) {
      const el = h("div", "fill");
      const t = s.title ? title(s.title, (LAND ? 5.4 : 6.4) * U, { accent: s.accent, style: { position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center" } }) : null;
      if (t) el.appendChild(t.el);
      const n = s.items.length;
      const cards = s.items.map((it, i) => {
        const tt = typeof it === "string" ? { title: it } : it;
        const c = h("div", "card lift", { padding: px(3 * U), display: "flex", flexDirection: "column", gap: px(1 * U) });
        c.innerHTML = `<div class="mono" style="font-size:${px(1.9 * U)};letter-spacing:.16em;text-transform:uppercase;color:var(--accent)">${tt.kicker ?? String(i + 1).padStart(2, "0")}</div><div style="margin-top:auto;font:600 ${px((LAND ? 4.2 : 4.6) * U)}/1.1 var(--sans);letter-spacing:-.035em">${KIT.rich(tt.title, "color")}</div>${tt.sub ? `<div style="font:400 ${px((LAND ? 2.6 : 2.9) * U)}/1.4 var(--sans);color:var(--muted)">${KIT.rich(tt.sub, "color")}</div>` : ""}`;
        el.appendChild(c); return c;
      });
      return { el, fits: t ? [[t.el, W * 0.9]] : [], layout() {
        const gap = 2.2 * U, tH = t ? t.el.offsetHeight + 5 * U : 0;
        const blockH = LAND ? Math.min(H * 0.8 - tH, 36 * U) + tH : H * 0.84;
        const top0 = Math.max(H * 0.08, (H - blockH) / 2);
        if (t) t.el.style.top = px(top0);
        const y0 = top0 + tH;
        if (LAND) { const padX = W * 0.08, cw = (W - 2 * padX - gap * (n - 1)) / n, ch = blockH - tH; cards.forEach((c, i) => Object.assign(c.style, { left: px(padX + i * (cw + gap)), top: px(y0), width: px(cw), height: px(ch) })); }
        else { const cw = W * 0.86, ch = Math.min((H - y0 - 8 * U - gap * (n - 1)) / n, 22 * U); cards.forEach((c, i) => Object.assign(c.style, { left: px(W * 0.07), top: px(y0 + i * (ch + gap)), width: px(cw), height: px(ch) })); }
      }, update(l) {
        if (t) KIT.revealWords(t, l, 0.05, 0.08, 0.6);
        cards.forEach((c, i) => { const k = expo(clamp((l - itemAt(s, i, 0.8, 0.6)) / 0.9)); c.style.opacity = k; c.style.filter = k < 0.995 ? `blur(${(1 - k) * 1.2 * U}px)` : "none"; c.style.transform = `translateY(${(1 - k) * 4 * U}px)`; });
      } };
    },

    /** Two or three figures counting up side by side. Items: {big, small, tone}. */
    stat(s) {
      const el = h("div", "fill");
      const t = s.title ? title(s.title, (LAND ? 5.4 : 6.4) * U, { accent: s.accent, style: { position: "absolute", left: "50%", top: px(H * (LAND ? 0.18 : 0.12)), transform: "translateX(-50%)", textAlign: "center" } }) : null;
      if (t) el.appendChild(t.el);
      const items = s.items.map((it) => {
        const b = h("div", "", { position: "absolute", textAlign: "center", transform: "translate(-50%,-50%)" });
        const big = h("div", "txt", { fontSize: px((LAND ? 10 : 12) * U), fontWeight: 600, letterSpacing: "-.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: TONES[it.tone] ?? "var(--ink)" }); big.textContent = it.big;
        const small = h("div", "", { fontSize: px((LAND ? 2.7 : 3.2) * U), color: "var(--muted)", marginTop: px(1.6 * U), maxWidth: px((LAND ? 36 : 70) * U) }); small.innerHTML = KIT.rich(it.small ?? "", "color");
        b.append(big, small); el.appendChild(b);
        const m = /^([^\d]*)([\d][\d,]*(?:\.\d+)?)(.*)$/.exec(it.big);
        return { b, big, m, dec: m && m[2].includes(".") ? m[2].split(".")[1].length : 0 };
      });
      return { el, fits: t ? [[t.el, W * 0.9]] : [], layout() {
        const n = items.length;
        items.forEach((o, i) => Object.assign(o.b.style, LAND ? { left: px(W * (i + 0.5) / n), top: px(H * 0.56) } : { left: px(W / 2), top: px(H * (0.38 + i * 0.5 / n)) }));
      }, update(l) {
        if (t) KIT.revealWords(t, l, 0.05, 0.08, 0.6);
        items.forEach((o, i) => {
          const t0 = itemAt(s, i, 0.8, 0.8), k = expo(clamp((l - t0) / 0.8));
          o.b.style.opacity = k; o.b.style.filter = k < 0.995 ? `blur(${(1 - k) * 1.2 * U}px)` : "none";
          if (o.m && parseFloat(o.m[2].replace(/,/g, "")) >= 10) o.big.textContent = o.m[1] + (parseFloat(o.m[2].replace(/,/g, "")) * eio(clamp((l - t0) / T(s, 1.6)))).toLocaleString("en-US", { minimumFractionDigits: o.dec, maximumFractionDigits: o.dec }) + o.m[3];
        });
      } };
    },

    /** The calm close: mark and name, tagline, a small label and the address. */
    end(s) {
      const el = h("div", "center");
      const row = h("div", "", { display: "flex", alignItems: "center", gap: px(1.8 * U) });
      const mk = KIT.mark(L.brand, (LAND ? 6.4 : 7.6) * U);
      const nm = h("div", "txt", { fontSize: px((LAND ? 6 : 7.2) * U), fontWeight: 600, letterSpacing: "-.04em" }); nm.textContent = L.brand.name;
      row.append(mk, nm); el.appendChild(row);
      const tag = title(s.tagline ?? L.brand.tagline ?? "", (LAND ? 3.2 : 4) * U, { accent: s.accent, style: { fontWeight: 400, color: "var(--muted)", marginTop: px(2.4 * U) } }); el.appendChild(tag.el);
      const lab = h("div", "mono", { fontSize: px((LAND ? 1.4 : 1.8) * U), letterSpacing: ".24em", textTransform: "uppercase", color: "var(--muted)", marginTop: px(6 * U) }); lab.textContent = s.label ?? "Get started";
      const url = h("div", "mono", { fontSize: px((LAND ? 1.8 : 2.3) * U), letterSpacing: ".16em", textTransform: "uppercase", marginTop: px(1.1 * U) }); url.textContent = s.url ?? L.brand.url ?? "";
      el.append(lab, url);
      return { el, fits: [[tag.el, W * 0.86]], update(l) {
        KIT.blurIn(row, l, 0.05, 1.0, 0.15); row.style.transform += ` scale(${(0.97 + 0.03 * expo(clamp(l / 1))).toFixed(3)})`;
        KIT.revealWords(tag, l, T(s, s.taglineAt ?? 1), 0.08, 0.7);
        KIT.blurIn(lab, l, T(s, s.labelAt ?? 2.2), 0.7, 0.2); KIT.blurIn(url, l, T(s, s.labelAt ?? 2.2) + 0.15, 0.7, 0.2);
      } };
    },
  };

  /** Sound cues for a shot, in shot-local seconds. */
  function cues(s, prev) {
    const out = [], add = (t, type) => out.push({ t, type });
    if (prev) add(prev.exit === "zoom" ? -0.5 : -0.05, prev.exit === "zoom" ? "whoosh" : "swish");
    if (s.drop) add(0, "impact");
    if (s.type === "reveal") add(T(s, s.splitAt ?? 1), "shimmer");
    if (s.type === "statement") add(T(s, s.at ?? 0) + T(s, s.countBeats ?? 2), "tick");
    if (s.type === "prompt") {
      const cps = s.cps ?? 14, typeAt = T(s, s.typeAt ?? 0.9), sendAt = s.sendAt != null ? T(s, s.sendAt) : s.sendBeat ? T(s, s.sendBeat) : typeAt + s.text.length / cps + 0.55;
      for (let c = 0; c < s.text.length; c++) add(typeAt + c / cps, "key");
      add(sendAt, "click");
      if (s.result) add(sendAt + 0.35, "pop");
    }
    if (s.type === "list") s.items.forEach((_, j) => add(itemAt(s, j, 0.8, 2), "tick"));
    if (s.type === "features") s.items.forEach((_, j) => add(itemAt(s, j, 0.8, 0.6), "pop"));
    (s.callouts ?? []).forEach((c) => add(T(s, c.beat ?? c.at), "pop"));
    (s.cards ?? []).forEach((c) => add(T(s, c.beat ?? c.at ?? 1), "pop"));
    (s.cursor ?? []).filter((c) => c.click).forEach((c) => add(T(s, c.beat ?? c.at), "click"));
    (s.taps ?? []).forEach((c) => add(T(s, c.beat ?? c.at), "click"));
    return out;
  }
  return { TYPES, ALIAS, TONES, ACC, cues, title };
};
