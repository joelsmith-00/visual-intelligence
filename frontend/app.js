/* Visual Intelligence 2.0 · Dum Sarat — front-end (no build step) */
(() => {
"use strict";
const API = (window.API_BASE || "").replace(/\/$/, "");
const EVENT_TS = new Date("2026-10-14T14:00:00+05:30").getTime();
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $("#app");
let cfg = { stages: ["Speed Typing","Blind Typing","Prompt Copycat","Prompt Charades"], team_min: 4, team_max: 5, departments: ["CST","CSE","AI & Data Science","AI & ML","Information Technology","Cyber Security","ECE","EEE","Mechanical","Civil","Other"] };
let timers = [];
let pendingScroll = null;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

/* ================= API ================= */
class ApiError extends Error { constructor(msg, fields = {}, status = 0) { super(msg); this.fields = fields; this.status = status; } }
async function api(path, opts = {}) {
  let res;
  try { res = await fetch(API + path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } }); }
  catch { throw new ApiError("Can't reach the server. Check your connection and try again."); }
  let data = null; try { data = await res.json(); } catch {}
  if (!res.ok) {
    let msg = "Something went wrong. Please try again.", fields = {};
    if (data && typeof data.detail === "string") msg = data.detail;
    else if (data && Array.isArray(data.detail)) {
      data.detail.forEach(e => { const f = e.loc && e.loc[e.loc.length - 1]; if (f) fields[f] = String(e.msg).replace(/^Value error,\s*/i, ""); });
      msg = Object.values(fields)[0] || msg;
    }
    throw new ApiError(msg, fields, res.status);
  }
  return data;
}

/* ================= session (this browser only) ================= */
const session = {
  get() { try { return JSON.parse(localStorage.getItem("vi_session") || "null"); } catch { return null; } },
  set(v) { try { localStorage.setItem("vi_session", JSON.stringify(v)); } catch {} refreshNav(); },
  clear() { try { localStorage.removeItem("vi_session"); } catch {} refreshNav(); },
};
function refreshNav() {
  const s = session.get(), a = $("#myTeamLink");
  if (s && s.code) { a.hidden = false; a.href = "#/team/" + s.code; } else a.hidden = true;
}

/* ================= team logos (generated from the team name) ================= */
const PALETTES = [
  ["#c0391a","#f8f1e3","#e1b552"], ["#25408f","#f8f1e3","#e1b552"], ["#1f6fb2","#f8f1e3","#f08a4b"],
  ["#2f7d5b","#f8f1e3","#e1b552"], ["#8f2a0d","#f8f1e3","#7fb5e6"], ["#6b3fa0","#f8f1e3","#e1b552"],
  ["#b8561f","#f8f1e3","#25408f"], ["#0f6b78","#f8f1e3","#f2b84b"],
];
function hash(s) { let h = 2166136261; for (const c of String(s).toLowerCase()) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function initials(name) {
  const w = String(name).trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}
function emblem(name, size = 96) {
  const h = hash(name), [a, b, c] = PALETTES[h % PALETTES.length], shape = (h >>> 5) % 5, ini = initials(name);
  const shapes = [
    `<path d="M50 12C53 38 62 47 88 50 62 53 53 62 50 88 47 62 38 53 12 50 38 47 47 38 50 12Z" fill="${b}" opacity=".2"/>`,
    `<circle cx="50" cy="50" r="35" fill="none" stroke="${b}" stroke-width="1.4" opacity=".4"/><circle cx="50" cy="50" r="26" fill="none" stroke="${b}" stroke-width="1.4" opacity=".3"/><circle cx="50" cy="50" r="17" fill="none" stroke="${b}" stroke-width="1.4" opacity=".25"/>`,
    `<rect x="24" y="24" width="52" height="52" fill="none" stroke="${b}" stroke-width="1.6" opacity=".4" transform="rotate(45 50 50)"/><rect x="33" y="33" width="34" height="34" fill="none" stroke="${b}" stroke-width="1.4" opacity=".3" transform="rotate(45 50 50)"/>`,
    `<polygon points="50,13 82,31.5 82,68.5 50,87 18,68.5 18,31.5" fill="none" stroke="${b}" stroke-width="1.6" opacity=".4"/><polygon points="50,25 71,37 71,63 50,75 29,63 29,37" fill="none" stroke="${b}" stroke-width="1.3" opacity=".3"/>`,
    Array.from({ length: 12 }, (_, i) => { const t = i * Math.PI / 6; return `<line x1="${50 + 24 * Math.cos(t)}" y1="${50 + 24 * Math.sin(t)}" x2="${50 + 40 * Math.cos(t)}" y2="${50 + 40 * Math.sin(t)}" stroke="${b}" stroke-width="1.6" opacity=".35"/>`; }).join(""),
  ];
  return `<svg class="emblem" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Team logo for ${esc(name)}">
    <circle cx="50" cy="50" r="47" fill="${a}"/>
    <circle class="em-spin" cx="50" cy="50" r="43" fill="none" stroke="${c}" stroke-width="1.6" stroke-dasharray="1.5 5.5" stroke-linecap="round"/>
    ${shapes[shape]}
    <path d="M50 6C51 14 53 16 61 17 53 18 51 20 50 28 49 20 47 18 39 17 47 16 49 14 50 6Z" fill="${c}" transform="translate(0 -2) scale(1)" opacity=".95"/>
    <text x="50" y="${ini.length > 1 ? 61 : 63}" text-anchor="middle" font-family="Bodoni Moda, Georgia, serif" font-weight="600" font-size="${ini.length > 1 ? 31 : 36}" fill="${b}">${esc(ini)}</text>
  </svg>`;
}
function avatar(name) { const [a] = PALETTES[hash(name) % PALETTES.length]; return `<span class="av" style="background:${a}">${esc(initials(name)[0])}</span>`; }

/* ================= shared snippets ================= */
const STAR = `<path d="M50 2C54 38 62 46 98 50 62 54 54 62 50 98 46 62 38 54 2 50 38 46 46 38 50 2Z"/>`;
const partners = (compact = false) => `
  <div class="partners ${compact ? "compact" : ""}">
    <img src="assets/karunya.png" alt="Karunya Institute of Technology and Sciences — Deemed to be University, 40 years of excellence">
    <img class="acm" src="assets/acm.png" alt="ACM — Association for Computing Machinery">
    <span class="sep" aria-hidden="true"></span>
    <img class="ieee" src="assets/ieee-cs.png" alt="IEEE Computer Society">
    <span class="sep" aria-hidden="true"></span>
    <span class="school">SCHOOL OF CST</span>
  </div>`;
const I = {
  cal: `<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  pin: `<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>`,
  ticket: `<path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4z"/>`,
  cert: `<rect x="3" y="4" width="18" height="12" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M9 16l-1 5 4-2 4 2-1-5"/>`,
};
const ic = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2600); }
async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch {} ta.remove(); }
  if (btn) { const o = btn.textContent; btn.textContent = "Copied"; btn.classList.add("done"); setTimeout(() => { btn.textContent = o; btn.classList.remove("done"); }, 1600); }
}
function confetti() {
  if (reduceMotion) return;
  const cols = ["#c0391a", "#e1b552", "#25408f", "#2f7d5b", "#d9502a", "#1f6fb2"];
  for (let i = 0; i < 70; i++) {
    const el = document.createElement("i"); el.className = "confetti";
    el.style.left = Math.random() * 100 + "vw"; el.style.background = cols[i % cols.length];
    el.style.setProperty("--dx", (Math.random() * 240 - 120) + "px"); el.style.setProperty("--rot", (Math.random() * 900 - 450) + "deg");
    el.style.animationDuration = 1.8 + Math.random() * 1.8 + "s"; el.style.animationDelay = Math.random() * .5 + "s";
    el.style.borderRadius = i % 3 ? "2px" : "50%"; document.body.appendChild(el); setTimeout(() => el.remove(), 4200);
  }
}
const joinLink = code => new URL("#/join/" + code, location.href.split("#")[0]).href;

/* ================= forms ================= */
const fld = (name, label, attrs = "", cls = "") => `<label class="fld ${cls}"><span>${label}</span><input name="${name}" id="f-${name}" ${attrs}><em class="err" data-for="${name}" role="alert"></em></label>`;
const deptField = () => `<label class="fld"><span>Department</span><select name="department" id="f-department" required><option value="" disabled selected>Select department</option>${cfg.departments.map(d => `<option>${esc(d)}</option>`).join("")}</select><em class="err" data-for="department" role="alert"></em></label>`;
const personFields = () => `
  ${fld("name", "Full name", 'autocomplete="name" placeholder="As on your ID card" maxlength="60" required')}
  <div class="two">
    ${fld("reg_no", "Register number", 'autocomplete="off" placeholder="e.g. URK24CS1001" maxlength="20" style="text-transform:uppercase" required')}
    ${deptField()}
  </div>
  ${fld("email", "Email", 'type="email" autocomplete="email" placeholder="you@karunya.edu.in" maxlength="120" required')}`;
function setFieldError(form, name, msg) { const f = form.querySelector(`[data-for="${name}"]`); if (!f) return false; f.textContent = msg; f.closest(".fld").classList.add("bad"); return true; }
function clearErrors(form) { $$(".fld.bad", form).forEach(f => f.classList.remove("bad")); $$(".err", form).forEach(e => e.textContent = ""); const fe = $(".form-err", form); fe.classList.remove("show"); fe.textContent = ""; }
function showError(form, err) {
  const fields = { ...(err.fields || {}) };
  if (!Object.keys(fields).length) {
    if (/register number/i.test(err.message)) fields.reg_no = err.message;
    else if (/email/i.test(err.message)) fields.email = err.message;
    else if (/team name/i.test(err.message)) fields.team_name = err.message;
    else if (/code|no team/i.test(err.message) && form.querySelector('[name="code"]')) fields.code = err.message;
  }
  let shown = false;
  Object.entries(fields).forEach(([k, v]) => { shown = setFieldError(form, k, v) || shown; });
  if (!shown) { const fe = $(".form-err", form); fe.textContent = err.message; void fe.offsetWidth; fe.classList.add("show"); }
  const first = $(".fld.bad input, .fld.bad select", form); if (first) first.focus();
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/, REG_RE = /^[A-Za-z0-9]{6,20}$/;
function validate(form, d) {
  const e = {};
  if (form.team_name && !/^[A-Za-z0-9][A-Za-z0-9 _.&'+!#\-]{1,38}[A-Za-z0-9.!+#]$/.test((d.team_name || "").trim())) e.team_name = "Team name must be 3–40 characters (letters, numbers, spaces and - _ . & ' + ! #).";
  if (form.code && !/^[A-Za-z0-9]{6}$/.test((d.code || "").trim())) e.code = "Enter the 6-character team code.";
  if ((d.name || "").trim().length < 2) e.name = "Enter your full name.";
  if (!REG_RE.test((d.reg_no || "").trim())) e.reg_no = "6–20 letters or digits, e.g. URK24CS1001.";
  if (!d.department) e.department = "Choose your department.";
  if (!EMAIL_RE.test((d.email || "").trim())) e.email = "Enter a valid email address.";
  return e;
}
function bindForm(form, onSubmit) {
  form.addEventListener("submit", async ev => {
    ev.preventDefault(); clearErrors(form);
    const d = Object.fromEntries(new FormData(form)); const bad = validate(form.elements, d);
    if (Object.keys(bad).length) { showError(form, new ApiError(Object.values(bad)[0], bad)); return; }
    const btn = $("button[type=submit]", form), label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Please wait`;
    try { await onSubmit(d); } catch (err) { showError(form, err instanceof ApiError ? err : new ApiError("Something went wrong. Please try again.")); btn.disabled = false; btn.innerHTML = label; }
  });
}

/* ================= pages ================= */
const stageIcons = {
  typing: `<svg class="ico" viewBox="0 0 96 96" aria-hidden="true"><rect x="8" y="28" width="80" height="48" rx="9" class="fill-n"/>${[0,1,2,3,4].map(i => `<rect class="k" style="animation-delay:${i*.28}s" x="${15+i*14}" y="35" width="11" height="9" rx="2.5"/>`).join("")}${[0,1,2,3].map(i => `<rect class="k" style="animation-delay:${.14+i*.28}s" x="${22+i*14}" y="48" width="11" height="9" rx="2.5"/>`).join("")}<rect class="k" style="animation-delay:1.4s" x="26" y="61" width="44" height="9" rx="2.5"/><rect x="73" y="48" width="9" height="9" rx="2.5" class="fill-t"/></svg>`,
  blind: `<svg class="ico" viewBox="0 0 96 96" aria-hidden="true"><path class="stroke" d="M8 48C22 26 74 26 88 48 74 70 22 70 8 48Z"/><circle class="fill-g" cx="48" cy="48" r="11"/><circle class="fill-n" cx="48" cy="48" r="5"/><path class="stroke slash" style="stroke:var(--terra);stroke-width:5" d="M18 20L78 76"/></svg>`,
  copy: `<svg class="ico" viewBox="0 0 96 96" aria-hidden="true"><rect class="stroke" x="10" y="16" width="76" height="46" rx="13" style="stroke:var(--navy)"/><path class="stroke" d="M30 62v18l17-18" style="stroke:var(--navy)"/><path class="stroke" d="M26 30l13 10-13 10" style="stroke:var(--terra);stroke-width:4"/><rect class="fill-t caret" x="46" y="46" width="18" height="4.5" rx="2"/></svg>`,
  charades: `<svg class="ico" viewBox="0 0 96 96" aria-hidden="true"><g class="hop"><circle cx="48" cy="24" r="9" class="fill-g stroke"/><path class="stroke" d="M48 33v28M48 61l-10 20M48 61l10 20"/><g class="arm"><path class="stroke" d="M48 42L27 28"/></g><g class="arm b"><path class="stroke" d="M48 42L70 52"/></g></g><circle cx="14" cy="64" r="6" class="fill-g stroke"/><path class="stroke" d="M14 70v10"/><circle cx="82" cy="64" r="6" class="fill-g stroke"/><path class="stroke" d="M82 70v10"/><text x="9" y="50" font-family="Bodoni Moda,serif" font-size="16" fill="#c0391a">?</text><text x="78" y="50" font-family="Bodoni Moda,serif" font-size="16" fill="#c0391a">?</text></svg>`,
};
const STAGES = [
  ["Speed Typing", "typing", "Fast fingers, clean output. Every second counts."],
  ["Blind Typing", "blind", "Eyes off the screen. Trust your fingers."],
  ["Prompt Copycat", "copy", "Write the prompt that recreates the result."],
  ["Prompt Charades", "charades", "Act out the prompt without saying a word."],
];

function home() {
  const mq = ["4 Stages of Chaos", "Prompt Engineering", "Dum Sarat", "Visual Intelligence 2.0", "Free Registration", "E-Certificate"].map(t => `<span>${t}<svg viewBox="0 0 100 100" aria-hidden="true">${STAR}</svg></span>`).join("");
  app.innerHTML = `<div class="page">
  <section class="hero" id="hero">
    ${partners()}
    <p class="presents">PRESENTS</p>
    <h1 aria-label="Visual Intelligence 2.0. Dum Sarat. Using prompt engineering. 4 stages of chaos.">
      <span class="ln l1" aria-hidden="true"><span class="row">VISUAL <svg class="star" viewBox="0 0 100 100">${STAR}</svg></span></span>
      <span class="ln l2 d2" aria-hidden="true"><span>INTELLIGENCE 2.0</span></span>
    </h1>
    <p class="dum" aria-hidden="true"><span class="ln d3"><span>DUM SARAT</span></span></p>
    <div class="using-line"><p class="using">USING</p><p class="pe" aria-hidden="true"><span class="ln d4"><span>Prompt Engineering</span></span></p></div>
    <p class="chaos" aria-hidden="true"><b>4</b><span>Stages of chaos</span><i class="rule"></i></p>
    <div class="cta-row">
      <a class="btn btn-primary" href="#/register">Register team</a>
      <a class="btn btn-ghost" href="#/join">Join with a code</a>
      <span class="live-pill" id="livePill" hidden><i></i><span><b id="statTeams">0</b> <span id="statLbl">teams registered</span></span></span>
    </div>
    <div class="scroll-hint"><i></i>Scroll</div>
  </section>

  <div class="marquee" aria-hidden="true"><div>${mq}${mq}</div></div>

  <section class="sec" id="stages">
    <div class="sec-head reveal"><h2>Four stages. One team.</h2><p>Every team plays all four stages. Here is what is waiting for you.</p></div>
    <div class="stages">${STAGES.map(([n, k, d], i) => `<article class="stage reveal" style="transition-delay:${i * .08}s"><span class="no">0${i + 1}</span>${stageIcons[k]}<h3>${n}</h3><p>${d}</p></article>`).join("")}</div>
  </section>

  <section class="sec" id="details" style="padding-top:0">
    <div class="details">
      <div class="facts reveal">
        <div class="fact"><span class="ic">${ic("cal")}</span><div><small>Date</small>14 Oct (Wednesday)</div></div>
        <div class="fact"><span class="ic">${ic("clock")}</span><div><small>Time</small>2:00 PM to 4:00 PM</div></div>
        <div class="fact"><span class="ic">${ic("pin")}</span><div><small>Venue</small>DSCS Gallery Hall, AIML Gallery Hall</div></div>
        <div class="fact"><span class="ic">${ic("ticket")}</span><div><small>Registration</small>Free</div></div>
        <div class="fact"><span class="ic">${ic("cert")}</span><div><small>Participation</small>E-Certificate will be issued</div></div>
      </div>
      <div class="elig reveal" style="transition-delay:.12s">
        <h3>Eligibility</h3>
        <p>Exclusively for<br><strong>I &amp; II Year CST Students</strong></p>
        <div class="count" id="countdown" aria-label="Time until the event"><div><b id="cd-d">00</b><span>Days</span></div><div><b id="cd-h">00</b><span>Hours</span></div><div><b id="cd-m">00</b><span>Min</span></div><div><b id="cd-s">00</b><span>Sec</span></div></div>
        <div class="badges"><span class="badge">Teams of ${cfg.team_min}–${cfg.team_max}</span><span class="badge">Free entry</span></div>
      </div>
    </div>
  </section>

  <section class="sec about" data-dark>
    <div class="grid">
      <h2 class="reveal">Prompts are<br>a <em>team sport.</em></h2>
      <div class="reveal" style="transition-delay:.12s">
        <p><b>Visual Intelligence 2.0 · Dum Sarat</b> is a prompt engineering contest from the School of CST, ACM and the IEEE Computer Society.</p>
        <p>Type fast, type blind, rewrite what an AI made and act out a prompt without speaking. Each stage tests a different skill, and every teammate's role decides the outcome.</p>
        <p>Form a team of ${cfg.team_min} to ${cfg.team_max}, register in a minute, and walk in ready.</p>
      </div>
    </div>
  </section>

  <section class="sec" id="how">
    <div class="sec-head reveal"><h2>Register in three steps</h2><p>One person creates the team. Everyone else joins with a code.</p></div>
    <div class="steps">
      <div class="step reveal"><h3>Create the team</h3><p>The team leader enters their name, register number, email, department and a team name.</p></div>
      <div class="step reveal" style="transition-delay:.1s"><h3>Share it</h3><p>Send the team code, invite link or QR code to your friends on WhatsApp.</p></div>
      <div class="step reveal" style="transition-delay:.2s"><h3>Friends join</h3><p>Each teammate opens the link, adds their details and appears in your team instantly.</p></div>
    </div>
    <div class="how-cta reveal"><a class="btn btn-primary" href="#/register">Register team</a></div>
  </section>

  <footer class="foot" data-dark>
    <div class="plate">${partners(true)}</div>
    <div class="foot-grid">
      <div><div class="big">Visual Intelligence 2.0<br>Dum Sarat</div><p style="margin-top:14px;max-width:34ch">Four stages of chaos, using prompt engineering.</p></div>
      <div><h4>Venue</h4><p>DSCS Gallery Hall,<br>AIML Gallery Hall</p><p>14 Oct, 2:00 PM to 4:00 PM</p></div>
      <div><h4>Navigate</h4><a href="#/register">Register team</a><a href="#/join">Join a team</a><a href="#/leaderboard">Leaderboard</a><a href="#/" data-scroll="stages">Stages</a></div>
    </div>
    <p class="legal">Karunya Institute of Technology and Sciences · ACM · IEEE Computer Society · School of CST</p>
  </footer></div>`;

  requestAnimationFrame(() => setTimeout(() => document.body.classList.add("go"), 60));
  const tick = () => {
    let s = Math.max(0, Math.floor((EVENT_TS - Date.now()) / 1000));
    const v = { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
    for (const k in v) { const el = $("#cd-" + k); if (el) el.textContent = String(v[k]).padStart(2, "0"); }
  };
  tick(); timers.push(setInterval(tick, 1000));
  api("/api/stats").then(st => {
    const pill = $("#livePill"); if (!pill) return; pill.hidden = false;
    if (!st.teams) { pill.lastElementChild.innerHTML = "Registrations are open"; return; }
    const el = $("#statTeams"), end = st.teams, t0 = performance.now(); if (end === 1) $("#statLbl").textContent = "team registered";
    (function step(n) { const p = Math.min((n - t0) / 1200, 1); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); })(t0);
  }).catch(() => {});
  if (pendingScroll) { const id = pendingScroll; pendingScroll = null; setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth" }); }, 120); }
}

function chooser() {
  app.innerHTML = `<main class="reg page">
    ${partners(true)}
    <a class="back" href="#/">← Back</a>
    <h1>Register your team</h1>
    <p class="lead">Are you starting a new team, or joining one a friend already created?</p>
    <div class="choices">
      <a class="choice" href="#/create">
        <span class="tag">Team leader</span>
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="orbit" cx="50" cy="50" r="44" fill="none" stroke="#e1b552" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round"/><path fill="#c0391a" d="${STAR.match(/d="([^"]+)"/)?.[1] || "M50 2C54 38 62 46 98 50 62 54 54 62 50 98 46 62 38 54 2 50 38 46 46 38 50 2Z"}" transform="translate(18 18) scale(.64)"/></svg>
        <h2>Create a team</h2>
        <p>You become the team leader. Add your details, name your team, then invite your friends.</p>
        <span class="go">Start a team <i>→</i></span>
      </a>
      <a class="choice" href="#/join">
        <span class="tag">Team member</span>
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="orbit" cx="50" cy="50" r="44" fill="none" stroke="#25408f" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round" style="animation-direction:reverse"/><circle cx="38" cy="50" r="17" fill="#25408f" opacity=".9"/><circle cx="62" cy="50" r="17" fill="#c0391a" opacity=".9"/><path d="M50 38.5a17 17 0 010 23 17 17 0 010-23z" fill="#e1b552"/></svg>
        <h2>Join a team</h2>
        <p>Your friend already made a team. Use their code or invite link to join it.</p>
        <span class="go">Join with a code <i>→</i></span>
      </a>
    </div></main>`;
}

function createPage() {
  app.innerHTML = `<main class="reg page">
    ${partners(true)}
    <a class="back" href="#/register">← Back</a>
    <h1>Create your team</h1>
    <p class="lead">You will be the team leader. Teammates join with the code you share.</p>
    <div class="formwrap">
      <form class="card" novalidate>
        <div class="steps-bar"><span class="on"><i>1</i>Your details</span><span class="sepl"></span><span><i>2</i>Invite friends</span></div>
        <div class="fields">
          ${fld("team_name", "Team name", 'autocomplete="off" placeholder="e.g. Neural Nexus" maxlength="40" required')}
          ${personFields()}
          <div class="form-err" role="alert"></div>
          <div class="actions"><button class="btn btn-primary" type="submit">Create team</button><span class="fine">Free. No payment needed.</span></div>
        </div>
      </form>
      <aside class="aside">
        <div class="note"><h3>What happens next</h3><ul><li>Your team gets a 6-character code, a link and a QR code.</li><li>Share it with ${cfg.team_min - 1} to ${cfg.team_max - 1} friends.</li><li>Teams need at least ${cfg.team_min} members and can have up to ${cfg.team_max}.</li></ul></div>
        <div class="preview show" id="logoPrev"><span id="logoSlot">${emblem("Your Team", 76)}</span><div><h3 id="logoName">Your team logo</h3><p>Made from your team name. It updates as you type.</p></div></div>
      </aside>
    </div></main>`;
  const form = $("form");
  $("#f-team_name").addEventListener("input", e => { const v = e.target.value.trim() || "Your Team"; $("#logoSlot").innerHTML = emblem(v, 76); $("#logoName").textContent = e.target.value.trim() || "Your team logo"; });
  bindForm(form, async d => {
    const r = await api("/api/teams", { method: "POST", body: JSON.stringify({ team_name: d.team_name, name: d.name, reg_no: d.reg_no, email: d.email, department: d.department }) });
    session.set({ code: r.team.code, token: r.token, role: "leader" });
    sessionStorage.setItem("vi_fresh", r.team.code);
    location.hash = "#/team/" + r.team.code;
  });
  $("#f-name").focus({ preventScroll: true });
}

function joinPage(codeFromUrl) {
  app.innerHTML = `<main class="reg page">
    ${partners(true)}
    <a class="back" href="#/register">← Back</a>
    <h1>Join a team</h1>
    <p class="lead">Enter the code your team leader shared with you, then add your details.</p>
    <div class="formwrap">
      <form class="card" novalidate>
        <div class="steps-bar"><span class="on"><i>1</i>Team code</span><span class="sepl"></span><span class="on"><i>2</i>Your details</span></div>
        <div class="fields">
          ${fld("code", "Team code", 'autocomplete="off" placeholder="ABC123" maxlength="6" required', "code-in")}
          ${personFields()}
          <div class="form-err" role="alert"></div>
          <div class="actions"><button class="btn btn-primary" type="submit">Join team</button><span class="fine">Free. No payment needed.</span></div>
        </div>
      </form>
      <aside class="aside">
        <div class="preview" id="prev"></div>
        <div class="note"><h3>Good to know</h3><ul><li>Each register number and email can join only one team.</li><li>Teams hold up to ${cfg.team_max} members.</li><li>Ask your leader for a new code if this one is full.</li></ul></div>
      </aside>
    </div></main>`;
  const form = $("form"), codeIn = $("#f-code"), prev = $("#prev");
  let t;
  const lookup = async () => {
    const c = codeIn.value.trim().toUpperCase();
    if (c.length !== 6) { prev.className = "preview"; return; }
    try {
      const tm = await api("/api/teams/" + c);
      prev.className = "preview show" + (tm.full ? " bad" : "");
      prev.innerHTML = `${emblem(tm.name, 64)}<div><h3>${esc(tm.name)}</h3><p>${tm.full ? "This team is full." : `${tm.size} of ${tm.max} members · leader ${esc(tm.members[0]?.name || "")}`}</p></div>`;
    } catch (e) { prev.className = "preview show bad"; prev.innerHTML = `<div><h3>No team found</h3><p>Check the code and try again.</p></div>`; }
  };
  codeIn.addEventListener("input", () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); clearTimeout(t); t = setTimeout(lookup, 250); });
  if (codeFromUrl) { codeIn.value = codeFromUrl.toUpperCase().slice(0, 6); lookup(); $("#f-name").focus({ preventScroll: true }); } else codeIn.focus({ preventScroll: true });
  bindForm(form, async d => {
    const code = d.code.trim().toUpperCase();
    const r = await api(`/api/teams/${code}/join`, { method: "POST", body: JSON.stringify({ name: d.name, reg_no: d.reg_no, email: d.email, department: d.department }) });
    session.set({ code, role: "member", memberId: r.member_id });
    sessionStorage.setItem("vi_joined", code);
    location.hash = "#/team/" + code;
  });
}

function lobby(code) {
  code = code.toUpperCase();
  const s = session.get(), mine = s && s.code === code ? s : null;
  const headers = mine && mine.token ? { "X-Leader-Token": mine.token } : {};
  app.innerHTML = `<main class="reg page" id="lobbyRoot"><p class="lead">Loading your team…</p></main>`;
  let lastSig = "", wasComplete = null, team = null;

  const slotHtml = (m, canRm) => `<div class="slot">${avatar(m.name)}<div><b>${esc(m.name)}</b><small>${esc(m.department)}</small>${m.role === "leader" ? `<span class="lead-tag">Leader</span>` : ""}</div>${m.role !== "leader" && canRm ? `<button class="rm" data-rm="${m.id}" aria-label="Remove ${esc(m.name)}">×</button>` : ""}</div>`;
  function paint(t) {
    team = t;
    const sig = JSON.stringify([t.members.map(m => [m.id, m.name]), t.complete, t.full, t.can_manage]);
    if (sig === lastSig) return; lastSig = sig;
    const empties = Math.max(0, t.max - t.size);
    $("#slots").innerHTML = t.members.map(m => slotHtml(m, t.can_manage)).join("") +
      Array.from({ length: empties }, (_, i) => `<div class="slot empty"><span class="av">+</span><div><b>${t.size + i + 1 <= t.min ? "Waiting for teammate" : "Optional seat"}</b><small>Seat ${t.size + i + 1}</small></div></div>`).join("");
    const need = t.min - t.size;
    $("#status").innerHTML = t.complete ? `<strong>${t.size} of ${t.max}</strong> joined. Your team is ready for the event.` : `<strong>${t.size} of ${t.min}</strong> joined. ${need} more ${need === 1 ? "teammate" : "teammates"} needed${t.max > t.min ? `, up to ${t.max} can join` : ""}.`;
    $("#bar").style.width = Math.min(100, t.size / t.min * 100) + "%";
    const chip = $("#chip"); chip.className = "chip" + (t.complete ? " ok" : ""); chip.innerHTML = `<i></i>${t.complete ? "Team ready" : "Gathering the team"}`;
    $("#ready").classList.toggle("show", t.complete);
    $("#sharePanel").style.display = t.full ? "none" : "";
    if (wasComplete === false && t.complete) { confetti(); toast("Your team is ready!"); }
    wasComplete = t.complete;
  }

  api("/api/teams/" + code, { headers }).then(t => {
    const fresh = sessionStorage.getItem("vi_fresh") === code, joined = sessionStorage.getItem("vi_joined") === code;
    const link = joinLink(code);
    const isLeader = t.can_manage;
    const msg = `Join my team "${t.name}" for Visual Intelligence 2.0 · Dum Sarat! Use team code ${code} or tap the link: ${link}`;
    $("#lobbyRoot").innerHTML = `
      ${partners(true)}
      <a class="back" href="#/">← Home</a>
      <div class="lobby-head"><div id="emb">${emblem(t.name, 120)}</div><div><h1>${esc(t.name)}</h1><p class="lead" style="margin:6px 0 10px">${isLeader ? "Your team is created and you are the team leader. Invite your friends below." : joined ? "You are in. Waiting for the rest of the team." : "Team lobby"}</p><span class="chip" id="chip"></span></div></div>
      <div class="lobby">
        <section>
          <div class="slots" id="slots"></div>
          <p class="status" id="status"></p>
          <div class="progress" aria-hidden="true"><i id="bar"></i></div>
          <p class="ready" id="ready">Your team has enough members. Walk in on the day at the DSCS Gallery Hall.</p>
        </section>
        <aside class="card share" id="sharePanel">
          <h2>Share with your friends</h2>
          <p class="fine">Send the code, link or QR code. Anyone with it can join until the team is full.</p>
          <div class="codebox"><div><small>Team code</small><strong>${code}</strong></div><button class="copy" data-copy="${code}">Copy</button></div>
          <div class="linkrow"><input readonly value="${esc(link)}" aria-label="Invite link" onfocus="this.select()"><button class="copy" data-copy="${esc(link)}">Copy link</button></div>
          <div class="share-btns">
            <a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">Share on WhatsApp</a>
            ${navigator.share ? `<button class="btn btn-ghost" id="nativeShare" type="button">More options</button>` : ""}
          </div>
          <div class="qr"><img src="${API}/api/teams/${code}/qr.svg" alt="QR code to join team ${esc(t.name)}" width="124" height="124"><p>Friends can scan this with their phone camera to open the join page.</p></div>
        </aside>
      </div>`;
    paint(t);
    wasComplete = t.complete;
    if (fresh) { sessionStorage.removeItem("vi_fresh"); confetti(); }
    if (joined) { sessionStorage.removeItem("vi_joined"); toast("You joined " + t.name); }
    $$("[data-copy]").forEach(b => b.addEventListener("click", () => copyText(b.dataset.copy, b)));
    const ns = $("#nativeShare"); if (ns) ns.addEventListener("click", () => navigator.share({ title: "Visual Intelligence 2.0", text: msg, url: link }).catch(() => {}));
    $("#slots").addEventListener("click", async e => {
      const b = e.target.closest("[data-rm]"); if (!b) return;
      if (!confirm("Remove this member from your team?")) return;
      try { paint(await api(`/api/teams/${code}/members/${b.dataset.rm}`, { method: "DELETE", headers })); lastSig = ""; paint(team); } catch (err) { toast(err.message); }
    });
    timers.push(setInterval(async () => { try { paint(await api("/api/teams/" + code, { headers })); } catch (e) { if (e.status === 404) clearInterval(timers[timers.length - 1]); } }, 6000));
  }).catch(err => {
    if (mine) session.clear();
    $("#lobbyRoot").innerHTML = `<div class="notfound"><h1>Team not found</h1><p class="lead" style="margin:0 auto 24px">${esc(err.message)}</p><a class="btn btn-primary" href="#/register">Register a team</a></div>`;
  });
}


/* ================= leaderboard ================= */
function tween(el, to, ms = 900) {
  const from = Number(el.dataset.v ?? 0); to = Number(to); el.dataset.v = to;
  if (reduceMotion || from === to) { el.textContent = to; return; }
  const t0 = performance.now();
  (function step(n) { const p = Math.min((n - t0) / ms, 1); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); })(t0);
}
const ago = iso => { const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000)); return s < 10 ? "just now" : s < 60 ? s + "s ago" : s < 3600 ? Math.floor(s / 60) + "m ago" : Math.floor(s / 3600) + "h ago"; };

function leaderboardPage() {
  const stages = cfg.stages;
  app.innerHTML = `<main class="lb page">
    <div class="lb-top">
      <div><p class="kick">Visual Intelligence 2.0 · Dum Sarat</p><h1>Live Leaderboard</h1></div>
      <div class="lb-badges"><span class="chip ok" id="lbLive"><i></i>Live</span><span class="chip soft" id="lbUpd">Connecting…</span><button class="btn btn-ghost sm" id="proj" type="button">Projector mode</button></div>
    </div>
    <div class="podium" id="podium"></div>
    <div class="lb-stats">
      <div class="stat"><small>Teams playing</small><b id="stT">0</b><em id="stTs"></em></div>
      <div class="stat"><small>Current stage</small><b id="stS">–</b><em id="stSn"></em></div>
      <div class="stat"><small>Stage timer</small><b id="stTm">--:--</b></div>
      <div class="stat"><small>Leading team</small><b id="stL">–</b></div>
      <div class="stat"><small>Submissions</small><b id="stSub">0</b></div>
    </div>
    <div class="lb-grid">
      <section>
        <div class="lb-tools">
          <div class="tabs" role="tablist" aria-label="Leaderboard view">${["Overall", ...stages].map((s, i) => `<button class="tab" role="tab" data-tab="${i}" aria-selected="${i === 0}">${i ? `Stage ${i}` : s}</button>`).join("")}</div>
          <input id="lbSearch" type="search" placeholder="Search team or member" aria-label="Search team or member">
        </div>
        <div class="lb-table"><div class="lb-head"><span>Rank</span><span></span><span>Team</span><span class="stg">${stages.map((_, i) => `<i style="background:none">S${i + 1}</i>`).join("")}</span><span style="text-align:right">Score</span></div>
          <div id="rows"></div><div class="lb-empty" id="lbEmpty" hidden></div></div>
      </section>
      <aside class="card feed"><h2>Live activity</h2><ul id="feed"></ul></aside>
    </div></main>`;

  let data = null, tab = 0, query = "", lastOk = 0, timerEnd = null, feedTop = 0, firstPodium = true, podSig = "";
  const rowsHost = $("#rows");

  const medal = r => `<span class="rk">${r}</span>`;
  function view() {
    if (!data) return [];
    let list = data.teams.map(t => ({ ...t }));
    if (tab > 0) {
      const k = tab - 1; list.forEach(t => { t.val = t.stages[k]; });
      list.sort((a, b) => (b.val ?? -1) - (a.val ?? -1) || a.name.localeCompare(b.name));
      let prev = null, rank = 0; list.forEach((t, i) => { if (t.val !== prev) { rank = i + 1; prev = t.val; } t.vrank = rank; t.vscored = t.val != null; });
    } else list.forEach(t => { t.val = t.total; t.vrank = t.rank; t.vscored = t.scored; });
    return list;
  }
  function rowHtml(t, max) {
    const top = t.vscored && t.val > 0 && t.vrank <= 3 ? t.vrank : 0;
    const mv = tab === 0 && t.scored ? (t.movement > 0 ? `<span class="mv up">▲ ${t.movement}</span>` : t.movement < 0 ? `<span class="mv down">▼ ${-t.movement}</span>` : `<span class="mv">–</span>`) : `<span class="mv"></span>`;
    const av = t.members.slice(0, 4).map(n => avatar(n)).join(""), more = t.size > 4 ? `+${t.size - 4}` : "";
    return { cls: "lb-row" + (top ? " top" + top : ""), html: `
      <span>${t.vscored ? medal(t.vrank) : `<span class="rk" style="color:var(--muted)">–</span>`}</span>${mv}
      <span class="tm">${emblem(t.name, 40)}<span style="min-width:0"><b>${esc(t.name)}</b><small><span class="stack">${av}</span>${t.size} ${t.size === 1 ? "member" : "members"}${more ? "" : ""}</small></span></span>
      <span class="stg">${t.stages.map((v, i) => `<i class="${v != null ? "has" : ""}" ${tab === i + 1 ? 'style="outline:1.5px solid var(--terra)"' : ""}>${v ?? "–"}</i>`).join("")}</span>
      <span class="tot"><b>${t.vscored ? t.val : "–"}</b><u style="width:${t.vscored && max ? Math.max(8, t.val / max * 100) : 0}%"></u></span>` };
  }
  function paintRows() {
    let list = view(); const max = Math.max(1, ...list.map(t => t.val ?? 0));
    const q = query.trim().toLowerCase();
    if (q) list = list.filter(t => t.name.toLowerCase().includes(q) || t.members.some(m => m.toLowerCase().includes(q)));
    const old = new Map([...rowsHost.children].map(el => [el.dataset.code, el.getBoundingClientRect().top]));
    const existing = new Map([...rowsHost.children].map(el => [el.dataset.code, el]));
    list.forEach(t => {
      const r = rowHtml(t, max); let el = existing.get(t.code);
      if (!el) { el = document.createElement("div"); el.dataset.code = t.code; el.innerHTML = r.html; el._h = r.html; el.className = r.cls + " enter"; }
      else { if (el._h !== r.html) { el.innerHTML = r.html; el._h = r.html; el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); } el.className = r.cls + (el.classList.contains("flash") ? " flash" : ""); }
      existing.delete(t.code); rowsHost.appendChild(el);
    });
    existing.forEach(el => el.remove());
    if (!reduceMotion) [...rowsHost.children].forEach(el => {
      const o = old.get(el.dataset.code); if (o === undefined) return; const d = o - el.getBoundingClientRect().top;
      if (Math.abs(d) > 1) { el.style.transition = "none"; el.style.transform = `translateY(${d}px)`; requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = "transform .9s cubic-bezier(.2,.8,.15,1)"; el.style.transform = ""; })); }
    });
    const empty = $("#lbEmpty");
    empty.hidden = list.length > 0;
    if (!list.length) empty.textContent = q ? "No team matches your search." : "No teams yet. The first teams will appear here as they register.";
  }
  function paintPodium() {
    const scored = data.teams.filter(t => t.scored && t.total > 0).slice(0, 3);
    const sig = JSON.stringify(scored.map(t => [t.code, t.total]));
    if (sig === podSig) return; podSig = sig;
    const order = [1, 0, 2];
    $("#podium").innerHTML = order.map(i => {
      const t = scored[i], p = i + 1;
      if (!t) return `<div class="pd p${p} empty"><div class="who"><b>${p === 1 ? "Waiting for the first score" : "—"}</b></div><div class="block"><span>${p}</span></div></div>`;
      return `<div class="pd p${p}"><div class="who">${p === 1 ? `<svg class="crown" viewBox="0 0 100 100" aria-hidden="true">${STAR}</svg>` : ""}${emblem(t.name, p === 1 ? 84 : 66)}<b>${esc(t.name)}</b><span class="score" data-v="${firstPodium ? 0 : t.total}">${t.total}</span></div><div class="block"><span>${p}</span></div></div>`;
    }).join("");
    if (firstPodium) $$(".pd .score").forEach((el, k) => { const t = scored[[1, 0, 2][k]]; if (t) tween(el, t.total, 1400); });
    firstPodium = false;
  }
  function paintStats() {
    const s = data.stats, ev = data.event;
    $("#stT").textContent = s.teams; $("#stTs").textContent = s.scored_teams ? `${s.scored_teams} scored so far` : "Registrations open";
    $("#stS").textContent = ev.current_stage === 0 ? "Not started" : ev.current_stage === 5 ? "Finished" : `Stage ${ev.current_stage}`;
    $("#stSn").textContent = ev.stage_name || "";
    $("#stL").textContent = s.leader || "–"; $("#stSub").textContent = s.submissions;
    timerEnd = ev.timer_seconds != null ? Date.now() + ev.timer_seconds * 1000 : null;
  }
  function paintFeed() {
    const a = data.activity, icon = { score: "+", lead: "★", stage: "▶", info: "•" };
    const newest = a.length ? a[0].id : 0;
    $("#feed").innerHTML = a.length ? a.map(x => `<li class="${x.kind}" ${x.id <= feedTop ? 'style="animation:none"' : ""}><span class="dot">${icon[x.kind] || "•"}</span><div>${esc(x.message)}<time>${ago(x.at)}</time></div></li>`).join("") : `<li style="animation:none;color:var(--muted)">Scores and stage changes will show up here live.</li>`;
    feedTop = Math.max(feedTop, newest);
  }
  async function load() {
    try {
      const d = await api("/api/leaderboard"); data = d; lastOk = Date.now();
      $("#lbLive").className = "chip ok"; $("#lbLive").innerHTML = "<i></i>Live";
      paintPodium(); paintStats(); paintRows(); paintFeed();
    } catch (e) { $("#lbLive").className = "chip warn"; $("#lbLive").innerHTML = "<i></i>Reconnecting"; }
  }
  $$(".tab").forEach(b => b.addEventListener("click", () => { tab = +b.dataset.tab; $$(".tab").forEach(x => x.setAttribute("aria-selected", x === b)); if (data) paintRows(); }));
  $("#lbSearch").addEventListener("input", e => { query = e.target.value; if (data) paintRows(); });
  $("#proj").addEventListener("click", () => {
    const on = document.body.classList.toggle("projector");
    $("#proj").textContent = on ? "Exit projector mode" : "Projector mode";
    if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen();
  });
  const fsExit = () => { if (!document.fullscreenElement && document.body.classList.contains("projector")) { document.body.classList.remove("projector"); const b = $("#proj"); if (b) b.textContent = "Projector mode"; } };
  document.addEventListener("fullscreenchange", fsExit);
  timers.push(setInterval(() => {
    if (lastOk) $("#lbUpd").textContent = "Updated " + (Math.round((Date.now() - lastOk) / 1000) < 3 ? "just now" : Math.round((Date.now() - lastOk) / 1000) + "s ago");
    const tm = $("#stTm"); if (!tm) return;
    if (timerEnd == null) tm.textContent = "--:--"; else { const s = Math.max(0, Math.round((timerEnd - Date.now()) / 1000)); tm.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  }, 1000));
  timers.push(setInterval(load, 4000));
  load();
}

/* ================= organiser panel ================= */
function adminPage() {
  let key = sessionStorage.getItem("vi_admin") || "", teams = [], ev = { current_stage: 0 };
  const H = () => ({ "X-Admin-Key": key });
  const stages = cfg.stages;
  function loginView(msg) {
    app.innerHTML = `<main class="adm page"><a class="back" href="#/">← Home</a><h1>Organiser panel</h1><p class="lead">Enter the admin key to manage stages and scores.</p>
      <form class="card" style="max-width:480px"><div class="fields">${fld("key", "Admin key", 'type="password" autocomplete="current-password" required')}<div class="form-err ${msg ? "show" : ""}" role="alert">${esc(msg || "")}</div><div class="actions"><button class="btn btn-primary" type="submit">Open panel</button></div></div></form></main>`;
    $("form").addEventListener("submit", e => { e.preventDefault(); key = $("#f-key").value.trim(); load(); });
  }
  async function load(silent) {
    try {
      [teams, ev] = await Promise.all([api("/api/admin/teams", { headers: H() }), api("/api/leaderboard").then(d => d.event)]);
      sessionStorage.setItem("vi_admin", key); panel();
    } catch (e) { if (silent) { toast(e.message); return; } sessionStorage.removeItem("vi_admin"); loginView(e.status === 401 || e.status === 403 ? e.message : e.message); }
  }
  function panel() {
    const q = ($("#admQ") || {}).value || "";
    app.innerHTML = `<main class="adm page"><a class="back" href="#/">← Home</a><h1>Organiser panel</h1>
      <div class="card"><h2 style="font-family:var(--display);font-weight:500;color:var(--terra)">Event stage</h2>
        <div class="stagebtns" id="stgBtns">${[["Not started", 0], ...stages.map((s, i) => [`${i + 1}. ${s}`, i + 1]), ["Finished", 5]].map(([l, v]) => `<button type="button" data-st="${v}" class="${ev.current_stage === v ? "on" : ""}">${esc(l)}</button>`).join("")}</div>
        <div class="ev-row"><label class="fld"><span>Timer (minutes)</span><input id="tmin" type="number" min="1" max="240" value="15"></label><button class="btn btn-primary sm" id="applyEv" type="button">Apply stage</button><span class="fine">The timer starts when you apply a stage and shows on the leaderboard.</span></div></div>
      <div class="card"><div style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:center"><h2 style="font-family:var(--display);font-weight:500;color:var(--terra)">Scores · ${teams.length} teams</h2><input id="admQ" type="search" placeholder="Search team" value="${esc(q)}" style="font:inherit;padding:9px 16px;border-radius:99px;border:1px solid var(--line);background:var(--paper)"></div>
        <div class="adm-row head"><span>Team</span>${stages.map((_, i) => `<span style="text-align:center">S${i + 1}</span>`).join("")}<span></span></div>
        <div id="admRows"></div>
        <div class="adm-top"><button class="btn btn-ghost sm" id="csv" type="button">Export CSV</button><a class="btn btn-ghost sm" href="#/leaderboard">Open leaderboard</a><button class="btn btn-ghost sm" id="out" type="button">Sign out</button></div></div></main>`;
    paintAdm();
    $("#admQ").addEventListener("input", paintAdm);
    $$("#stgBtns button").forEach(b => b.addEventListener("click", () => { ev.current_stage = +b.dataset.st; $$("#stgBtns button").forEach(x => x.classList.toggle("on", x === b)); }));
    $("#applyEv").addEventListener("click", async () => {
      try { await api("/api/admin/event", { method: "PUT", headers: H(), body: JSON.stringify({ current_stage: ev.current_stage, timer_minutes: +$("#tmin").value || null }) }); toast("Stage updated"); } catch (e) { toast(e.message); }
    });
    $("#out").addEventListener("click", () => { sessionStorage.removeItem("vi_admin"); key = ""; loginView(); });
    $("#csv").addEventListener("click", async () => {
      try { const r = await fetch(API + "/api/admin/export.csv", { headers: H() }); if (!r.ok) throw new Error("Export failed"); const u = URL.createObjectURL(await r.blob()); const a = document.createElement("a"); a.href = u; a.download = "registrations.csv"; a.click(); URL.revokeObjectURL(u); } catch (e) { toast(e.message); }
    });
  }
  function paintAdm() {
    const q = $("#admQ").value.trim().toLowerCase();
    $("#admRows").innerHTML = teams.filter(t => !q || t.team.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)).map(t => `
      <div class="adm-row" data-code="${t.code}"><span style="min-width:0"><b>${esc(t.team)}</b><small>${t.code} · ${t.size} members${t.complete ? "" : " · incomplete"}</small></span>
        ${stages.map((_, i) => `<input type="number" min="0" inputmode="numeric" aria-label="${esc(t.team)} stage ${i + 1} points" data-s="${i + 1}" data-orig="${t.scores[i + 1] ?? ""}" value="${t.scores[i + 1] ?? ""}">`).join("")}
        <button class="btn btn-primary" type="button" data-save>Save</button></div>`).join("") || `<p class="fine" style="padding:18px 0">No teams registered yet.</p>`;
    $$("#admRows input").forEach(i => i.addEventListener("input", () => i.classList.toggle("dirty", i.value !== i.dataset.orig)));
    $$("#admRows [data-save]").forEach(b => b.addEventListener("click", async () => {
      const row = b.closest(".adm-row"), code = row.dataset.code; b.disabled = true; let n = 0;
      try {
        for (const i of $$("input", row)) {
          if (i.value === i.dataset.orig) continue; const s = +i.dataset.s;
          if (i.value === "") await api(`/api/admin/scores/${code}/${s}`, { method: "DELETE", headers: H() });
          else await api("/api/admin/scores", { method: "PUT", headers: H(), body: JSON.stringify({ team_code: code, stage: s, points: parseInt(i.value, 10) }) });
          i.dataset.orig = i.value; i.classList.remove("dirty"); n++;
          const t = teams.find(x => x.code === code); if (t) { if (i.value === "") delete t.scores[s]; else t.scores[s] = +i.value; }
        }
        toast(n ? "Saved" : "Nothing to save");
      } catch (e) { toast(e.message); } finally { b.disabled = false; }
    }));
  }
  key ? load() : loginView();
}

/* ================= router ================= */
const routes = [
  [/^\/?$/, () => home(), "home"],
  [/^\/register\/?$/, () => chooser(), "reg"],
  [/^\/create\/?$/, () => createPage(), "reg"],
  [/^\/join(?:\/([A-Za-z0-9]{0,6}))?\/?$/, m => joinPage(m[1] || ""), "reg"],
  [/^\/team\/([A-Za-z0-9]{3,8})\/?$/, m => lobby(m[1]), "reg"],
  [/^\/leaderboard\/?$/, () => leaderboardPage(), "lb"],
  [/^\/admin\/?$/, () => adminPage(), "lb"],
];
function route() {
  timers.forEach(clearInterval); timers = []; document.body.classList.remove("projector");
  const path = location.hash.replace(/^#/, "") || "/";
  for (const [re, fn, kind] of routes) {
    const m = path.match(re);
    if (m) { document.body.dataset.route = kind; document.body.classList.toggle("go", false); sceneTarget = kind === "home" ? 1 : 0; fn(m); window.scrollTo(0, 0); observeReveals(); return; }
  }
  location.hash = "#/";
}
addEventListener("hashchange", route);
document.addEventListener("click", e => {
  const a = e.target.closest("[data-scroll]"); if (!a) return;
  e.preventDefault();
  const id = a.dataset.scroll;
  if ((location.hash || "#/") === "#/" || location.hash === "") { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth" }); }
  else { pendingScroll = id; location.hash = "#/"; }
});

/* ================= reveal on scroll ================= */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .18 });
function observeReveals() { $$(".reveal").forEach(el => io.observe(el)); }

/* ================= cursor ================= */
const cur = $(".cursor"); let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my, px = 0, py = 0, lastDarkCheck = 0;
addEventListener("pointermove", e => {
  mx = e.clientX; my = e.clientY; px = mx / innerWidth - .5; py = my / innerHeight - .5; cur.classList.add("on");
  const n = performance.now(); if (n - lastDarkCheck > 90) { lastDarkCheck = n; const el = document.elementFromPoint(mx, my); cur.classList.toggle("light", !!(el && el.closest("[data-dark]"))); cur.classList.toggle("big", !!(el && el.closest("a,button,.choice,.stage"))); }
});

/* ================= animated scene: geodesic sphere + ribbed orbit rings ================= */
const cv = $("#scene"), ctx = cv.getContext("2d");
let W, H, dpr, sceneTarget = 1, modeT = 1;
function resize() { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
addEventListener("resize", resize); resize();
const nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
function icosphere(sub) {
  const t = (1 + Math.sqrt(5)) / 2;
  let V = [[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(nrm);
  let F = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  for (let s = 0; s < sub; s++) {
    const cache = {}, NF = [];
    const mid = (a, b) => { const k = a < b ? a + "_" + b : b + "_" + a; if (cache[k] === undefined) { V.push(nrm([(V[a][0]+V[b][0])/2, (V[a][1]+V[b][1])/2, (V[a][2]+V[b][2])/2])); cache[k] = V.length - 1; } return cache[k]; };
    F.forEach(([a, b, c]) => { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); });
    F = NF;
  }
  const E = new Set(); F.forEach(([a, b, c]) => [[a,b],[b,c],[c,a]].forEach(([i, j]) => E.add(i < j ? i + "," + j : j + "," + i)));
  return { V, E: [...E].map(s => s.split(",").map(Number)) };
}
const mesh = icosphere(1);
function rot(p, ax, ay, az) { let [x, y, z] = p, c, s, t; c = Math.cos(ax); s = Math.sin(ax); t = y*c - z*s; z = y*s + z*c; y = t; c = Math.cos(ay); s = Math.sin(ay); t = x*c + z*s; z = -x*s + z*c; x = t; c = Math.cos(az); s = Math.sin(az); t = x*c - y*s; y = x*s + y*c; x = t; return [x, y, z]; }
const dust = Array.from({ length: 44 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + .4, s: Math.random() * .02 + .005, a: Math.random() * .5 + .2 }));
let tilt = { x: 0, y: 0 }; const t0 = performance.now(); const easeOut = x => 1 - Math.pow(1 - x, 4);
function frame(now) {
  const t = reduceMotion ? 6 : (now - t0) / 1000;
  ctx.clearRect(0, 0, W, H);
  cx += (mx - cx) * .22; cy += (my - cy) * .22; cur.style.transform = `translate(${cx}px,${cy}px)`;
  modeT += (sceneTarget - modeT) * .05;
  const intro = reduceMotion ? 1 : easeOut(Math.min(t / 2.6, 1)), mobile = W < 760;
  const R = Math.min(W, H) * (mobile ? .3 : .34) * (.28 + .72 * intro) * (.62 + .38 * modeT);
  const bx = mobile ? W * (.5 + .3 * (1 - modeT)) : W * (.8 - .18 * modeT);
  const ox = bx - px * 30, oy = H * (.5 - .12 * (1 - modeT)) - Math.min(scrollY, H * 1.2) * .22 - py * 20;
  cv.style.opacity = (.55 + .45 * modeT).toFixed(2);
  tilt.x += (py * .5 - tilt.x) * .04; tilt.y += (px * .7 - tilt.y) * .04;
  const ax = .35 + t * .05 + tilt.x, ay = t * .11 + tilt.y, az = .1, F = 1400;
  const proj = (p, s) => { const k = F / (F - p[2] * s); return [ox + p[0] * s * k, oy + p[1] * s * k, k]; };
  ctx.lineWidth = .9; ctx.strokeStyle = "rgba(143,42,13,.42)";
  const pts = mesh.V.map(v => proj(rot(v, ax, ay, az), R));
  ctx.beginPath(); mesh.E.forEach(([i, j]) => { ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); }); ctx.stroke();
  ctx.fillStyle = "rgba(192,57,26,.7)"; pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 * p[2], 0, 6.283); ctx.fill(); });
  const rings = [
    { r: 1.95, w: .06, ax: 1.25 + Math.sin(t * .09) * .25, ay: t * .07, az: .5 + t * .03, a: .5 },
    { r: 1.5, w: .04, ax: .55 + t * .045, ay: -t * .06 + 1, az: -.6 + Math.sin(t * .07) * .3, a: .42 },
  ], seg = 140, ribs = 7;
  rings.forEach(g => { for (let k = 0; k < ribs; k++) {
    const mid = (ribs - 1) / 2, rr = g.r + (k - mid) * g.w * .35, edge = Math.abs(k - mid) / mid;
    ctx.strokeStyle = `rgba(192,100,60,${g.a * (1 - edge * .55)})`; ctx.lineWidth = k === 0 || k === ribs - 1 ? 1.1 : .7; ctx.beginPath();
    for (let i = 0; i <= seg; i++) { const th = i / seg * 6.2832, p = proj(rot([Math.cos(th) * rr, Math.sin(th) * rr, (k - mid) * g.w * .15], g.ax + tilt.x * .6, g.ay + tilt.y * .6, g.az), R); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.stroke(); } });
  ctx.fillStyle = "#8f2a0d"; dust.forEach(d => { d.y -= d.s * .0016; if (d.y < 0) d.y = 1; ctx.globalAlpha = d.a * intro * .7; ctx.beginPath(); ctx.arc(d.x * W + px * d.r * 14, d.y * H, d.r, 0, 6.283); ctx.fill(); });
  ctx.globalAlpha = 1;
  requestAnimationFrame(frame);
}

/* ================= boot ================= */
refreshNav();
api("/api/config").then(c => { cfg = c; }).catch(() => {}).finally(() => { route(); requestAnimationFrame(frame); });
})();
