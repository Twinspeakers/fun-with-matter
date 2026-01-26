// Fun With Matter - Dev Mode helpers
// Dev Mode is intentionally local-only so it can't overwrite canon.
// Enable with:
//  - URL param: ?dev=1
//  - or Ctrl+Shift+D (toggles localStorage flag)


// Base-aware URL helper (GitHub Pages subpath-safe)
// (Mirrors wikiFS's behaviour so Dev Mode assets still resolve if Vite base ever drifts.)
function __fwmDetectBase__(){
  const viteBase = (import.meta?.env?.BASE_URL);
  if (viteBase && viteBase !== "/") return viteBase;
  try{
    const p = String(window.location?.pathname || "/");
    const parts = p.split("/").filter(Boolean);
    if (parts.length >= 1) return `/${parts[0]}/`;
  }catch(_){/* ignore */}
  return "/";
}

const __FWM_BASE_URL__ = __fwmDetectBase__();

function __fwmWithBase__(p){
  const s = String(p || "");
  if (!s) return s;
  // Leave absolute URLs / data / blob untouched
  if (/^(?:[a-z]+:)?\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) return s;
  let out = s.replace(/^\.\//, "");
  if (out.startsWith("/")) out = out.slice(1);
  return __FWM_BASE_URL__ + out;
}

const DEV_KEY = "fwm_dev_mode";
const DEV_SESSION_KEY = "fwm_dev_mode_session";

function truthyDevVal(v){
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function hrefHasDev(href){
  // Ultra-tolerant: catches dev=1 placed anywhere in the URL, including odd hash/router patterns.
  // Examples:
  //  - ?dev=1
  //  - #/wiki?dev=1
  //  - #dev=1
  //  - #route&dev=1
  const h = String(href || "");
  const m = h.match(/[?#&]dev=([^&#]+)/i);
  if (!m) return false;
  return truthyDevVal(decodeURIComponent(m[1] || ""));
}

// Support hash-based routing where `?dev=1` may appear after the `#`.
// Examples:
//  - http://localhost:5500/?dev=1
//  - http://localhost:5500/#/wiki?dev=1
function readDevFromUrl(){
  try{
    const href = String(window.location.href || "");
    // First-pass regex (handles weird router patterns that URLSearchParams might miss)
    if (hrefHasDev(href)) return true;

    const url = new URL(href);
    const qp = url.searchParams.get("dev");
    if (truthyDevVal(qp)) return true;

    // If dev param was placed in the hash fragment, parse it too.
    const hash = String(url.hash || "");
    if (hash.includes("dev=")){
      const qIndex = hash.indexOf("?");
      const tail = qIndex >= 0 ? hash.slice(qIndex + 1) : hash.replace(/^#/, "");
      const hp = new URLSearchParams(tail);
      if (truthyDevVal(hp.get("dev"))) return true;
    }
  }catch(_){/* ignore */}
  return false;
}

export function isDevMode(){
  try{
    if (readDevFromUrl()) {
      // If dev is explicitly enabled via URL, persist it locally so reloads/toggles are stable.
      try{ localStorage.setItem(DEV_KEY, "1"); }catch(_){/* ignore */}
      try{ sessionStorage.setItem(DEV_SESSION_KEY, "1"); }catch(_){/* ignore */}
      return true;
    }
  }catch(_){/* ignore */}

  // Local-only persistence (preferred)
  try{
    if (localStorage.getItem(DEV_KEY) === "1") return true;
  }catch(_){/* ignore */}

  // Fallback for environments where localStorage is blocked.
  try{
    if (sessionStorage.getItem(DEV_SESSION_KEY) === "1") return true;
  }catch(_){/* ignore */}

  return false;
}

export function setDevMode(on){
  try{
    localStorage.setItem(DEV_KEY, on ? "1" : "0");
  }catch(_){/* ignore */}
  try{
    sessionStorage.setItem(DEV_SESSION_KEY, on ? "1" : "0");
  }catch(_){/* ignore */}
}

function buildUrlWithDev(on, { resetUi = false } = {}){
  // Construct an explicit URL that keeps the current hash but guarantees the query param
  // is in the real search string (before '#').
  try{
    const loc = window.location;
    const base = `${loc.origin}${loc.pathname}`;
    const params = new URLSearchParams(String(loc.search || ""));
    if (on) params.set("dev", "1");
    else params.delete("dev");

    // When toggling Dev Mode via hotkey/button, also request a safe UI reset on next boot.
    // This prevents the app from landing in an in-between state (e.g. "Loading reference…" on both panes)
    // if a dev-only page was selected or the wiki was mid-render.
    if (resetUi) params.set("resetui", "1");
    else params.delete("resetui");

    const qs = params.toString();
    const hash = String(loc.hash || "");
    return qs ? `${base}?${qs}${hash}` : `${base}${hash}`;
  }catch(_){
    return String(window.location.href || "");
  }
}

function navigateToDevUrl(on, { resetUi = false } = {}){
  try{
    const url = buildUrlWithDev(on, { resetUi });
    // Using assign() ensures the browser really navigates to the new URL (no silent history failures).
    window.location.assign(url);
    return true;
  }catch(_){/* ignore */}
  return false;
}

export function toggleDevMode(){
  const next = !isDevMode();
  setDevMode(next);
  // Prefer a real navigation so we don't depend on replaceState + reload ordering.
  if (!navigateToDevUrl(next, { resetUi:true })){
    // Fallback: best-effort history replace + reload.
    try{
      const url = new URL(window.location.href);
      if (next) url.searchParams.set("dev", "1");
      else url.searchParams.delete("dev");
      window.history.replaceState({}, "", url.toString());
    }catch(_){/* ignore */}
    try{ window.location.reload(); }catch(_){/* ignore */}
  }
  return next;
}

// Load and apply a dev-only theme override file.
// This reads CSS variable lines like:
//   --tier-1: oklch(...);
// from a fenced code block in wiki/pages/dev/theme.md.
export async function applyDevThemeOverrides(){
  if (!isDevMode()) return { ok:false, reason:"dev_off" };
  try{
    const res = await fetch(__fwmWithBase__("wiki/pages/dev/theme.md"), { cache: "no-cache" });
    if (!res.ok) return { ok:false, reason:`missing (${res.status})` };
    const md = await res.text();

    const vars = parseCssVarOverridesFromMarkdown(md);
    if (!vars.length) return { ok:false, reason:"no_vars" };

    vars.forEach(({ k, v }) => {
      try{ document.documentElement.style.setProperty(k, v); }catch(_){/* ignore */}
    });

    // Tag DOM for styling hooks (optional)
    document.body.classList.add("dev-mode");
    document.documentElement.dataset.dev = "1";

    return { ok:true, count: vars.length };
  }catch(e){
    return { ok:false, reason:String(e?.message || e) };
  }
}

function parseCssVarOverridesFromMarkdown(md){
  const text = String(md || "");

  // Grab the first fenced block (``` ... ```). If none, parse the whole doc.
  let body = text;
  const fence = text.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```/);
  if (fence && fence[1] !== undefined) body = fence[1];

  const out = [];
  body.split(/\r?\n/).forEach(line => {
    const raw = String(line || "").trim();
    if (!raw) return;
    if (raw.startsWith("#") || raw.startsWith("//")) return;
    // Allow optional trailing semicolon
    const m = raw.match(/^(--[A-Za-z0-9_-]+)\s*:\s*(.+?)\s*;?$/);
    if (!m) return;
    out.push({ k: m[1], v: m[2] });
  });

  return out;
}

export function initDevMode({ onToggle } = {}){
  // Dev Mode UI is intentionally hidden for players.
  // Use Ctrl+Shift+D (or ?dev=1 / #...dev=1) to toggle locally while developing.

  // Keyboard toggle: Ctrl+Shift+D
  window.addEventListener("keydown", (e) => {
    const key = String(e.key || "").toLowerCase();
    if (!e.ctrlKey || !e.shiftKey || key !== "d") return;
    e.preventDefault();
    const on = !isDevMode();
    setDevMode(on);
    try{ onToggle?.(on); }catch(_){/* ignore */}
    // Navigate explicitly; this avoids cases where replaceState+reload doesn't stick.
    if (!navigateToDevUrl(on, { resetUi:true })){
      try{ window.location.reload(); }catch(_){/* ignore */}
    }
  });

  // Set a visible class when dev is on
  try{
    if (isDevMode()){
      document.body.classList.add("dev-mode");
      document.documentElement.dataset.dev = "1";
    } else {
      document.body.classList.remove("dev-mode");
      delete document.documentElement.dataset.dev;
    }
  }catch(_){/* ignore */}

  // Dev-only UI helpers (lazy-loaded)
  try{
    if (isDevMode()){
      import("./todDevPanel.js").then(m => {
        try{ m.initTodDevPanel?.(); }catch(_){/* ignore */}
      }).catch(_ => {});
    }
  }catch(_){/* ignore */}
}

function injectDevBadge(){
  // Always create the element and show state (ON/OFF) so it's never "invisible".
  const id = "fwmDevBadge";
  let el = document.getElementById(id);
  if (!el){
    el = document.createElement("div");
    el.id = id;
    el.style.position = "fixed";
    el.style.top = "10px";
    el.style.right = "10px";
    el.style.zIndex = "9998";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.gap = "8px";
    el.style.padding = "8px 10px";
    el.style.borderRadius = "999px";
    el.style.background = "rgba(0,0,0,.7)";
    el.style.backdropFilter = "blur(6px)";
    el.style.color = "#fff";
    el.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
    el.style.fontSize = "12px";
    el.style.border = "1px solid rgba(255,255,255,.18)";
    el.innerHTML = `<span style="font-weight:800;letter-spacing:.5px;">DEV</span>
      <span id="fwmDevBadgeState" style="opacity:.9">OFF</span>
      <button type="button" id="fwmDevBadgeToggle" style="cursor:pointer;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;padding:4px 8px;border-radius:999px;font-size:12px">On</button>`;
    document.body.appendChild(el);
    el.querySelector("#fwmDevBadgeToggle")?.addEventListener("click", () => {
      const on = !isDevMode();
      try{ setDevMode(on); }catch(_){/* ignore */}
      // Navigate so it's guaranteed to stick.
      if (!navigateToDevUrl(on, { resetUi:true })){
        try{ window.location.reload(); }catch(_){/* ignore */}
      }
    });
  }

  // Update state + button label
  const on = isDevMode();
  const stateEl = el.querySelector("#fwmDevBadgeState");
  const btn = el.querySelector("#fwmDevBadgeToggle");
  if (stateEl) stateEl.textContent = on ? "ON" : "OFF";
  if (btn) btn.textContent = on ? "Off" : "On";
  // Visual hint
  el.style.opacity = on ? "1" : "0.75";
}
