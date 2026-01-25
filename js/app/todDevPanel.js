// Fun With Matter - Dev Time-of-Day Toggle (UI)
// Adds a small button between Theme and Settings when Dev Mode is enabled (Ctrl+Shift+D / ?dev=1).
// Lets you override time-of-day without using the browser console.

import { isDevMode } from "./devMode.js";

const OVERRIDE_KEYS = ["todOverride", "fwm_tod_override"]; // keep backward/forward compatible
const TOD_CLASSES = ["tod-day","tod-dawn","tod-dusk","tod-night"];

function getOverride(){
  try{
    for (const k of OVERRIDE_KEYS){
      const v = localStorage.getItem(k);
      if (v && String(v).trim()) return String(v).trim();
    }
  }catch(_){}
  return "";
}

function setOverride(v){
  try{
    for (const k of OVERRIDE_KEYS){
      if (!v) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    }
  }catch(_){}
}

function computeBand(d = new Date()){
  const h = d.getHours();
  // Dawn 05:00–07:59, Day 08:00–16:59, Dusk 17:00–19:59, Night 20:00–04:59
  if (h >= 5 && h <= 7) return "dawn";
  if (h >= 8 && h <= 16) return "day";
  if (h >= 17 && h <= 19) return "dusk";
  return "night";
}

function applyBodyClass(mode){
  const body = document.body;
  if (!body) return;
  TOD_CLASSES.forEach(c => body.classList.remove(c));
  const m = mode || computeBand();
  body.classList.add(`tod-${m}`);
  body.dataset.tod = m;
}

function iconFor(mode){
  switch (mode){
    case "day": return "🌞";
    case "dawn": return "🌅";
    case "dusk": return "🌆";
    case "night": return "🌙";
    default: return "🌓"; // auto
  }
}

function labelFor(mode){
  switch (mode){
    case "day": return "Day";
    case "dawn": return "Dawn";
    case "dusk": return "Dusk";
    case "night": return "Night";
    default: return "Auto";
  }
}

function ensureStyles(){
  if (document.getElementById("todDevPanelStyles")) return;
  const css = `
    #todDevBtn{
      min-width: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 10px;
      cursor: pointer;
      user-select: none;
      border: 1px solid color-mix(in oklab, var(--panel-border, rgba(255,255,255,.12)) 80%, transparent);
      background: color-mix(in oklab, var(--panel-bg, rgba(0,0,0,.25)) 85%, transparent);
      color: var(--text, inherit);
    }
    #todDevBtn:hover{
      filter: brightness(1.06);
    }
    #todDevPopover{
      position: fixed;
      z-index: 2147483647;
      min-width: 200px;
      padding: 10px;
      border-radius: 12px;
      border: 1px solid color-mix(in oklab, var(--panel-border, rgba(255,255,255,.12)) 80%, transparent);
      background: color-mix(in oklab, var(--panel-bg, rgba(20,20,20,.92)) 92%, transparent);
      box-shadow: 0 12px 30px rgba(0,0,0,.35);
      backdrop-filter: blur(8px);
    }
    #todDevPopover .todTitle{
      font-size: 12px;
      opacity: .8;
      margin: 0 0 8px 0;
    }
    #todDevPopover .todGrid{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    #todDevPopover button.todOpt{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid color-mix(in oklab, var(--panel-border, rgba(255,255,255,.12)) 70%, transparent);
      background: color-mix(in oklab, var(--panel-bg, rgba(0,0,0,.2)) 80%, transparent);
      color: inherit;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
    }
    #todDevPopover button.todOpt:hover{ filter: brightness(1.06); }
    #todDevPopover button.todOpt[aria-pressed="true"]{
      outline: 2px solid color-mix(in oklab, var(--xp-blue, #4aa3ff) 70%, transparent);
      outline-offset: 1px;
    }
    #todDevPopover .todFoot{
      margin-top: 8px;
      font-size: 11px;
      opacity: .75;
      line-height: 1.25;
    }
  `;
  const style = document.createElement("style");
  style.id = "todDevPanelStyles";
  style.textContent = css;
  document.head.appendChild(style);
}

function mount(){
  if (!isDevMode()) return;

  const themeBtn = document.getElementById("themeBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  if (!themeBtn || !settingsBtn || !themeBtn.parentElement) return;

  // Avoid duplicates
  if (document.getElementById("todDevBtn")) return;

  ensureStyles();

  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-flex";
  wrapper.style.alignItems = "center";

  const btn = document.createElement("button");
  btn.id = "todDevBtn";
  btn.type = "button";
  btn.title = "Time of Day (Dev)";

  const pop = document.createElement("div");
  pop.id = "todDevPopover";
  pop.hidden = true;
  pop.innerHTML = `
    <div class="todTitle">Time of Day (Dev Override)</div>
    <div class="todGrid">
      <button class="todOpt" data-mode="" type="button">🌓 Auto</button>
      <button class="todOpt" data-mode="day" type="button">🌞 Day</button>
      <button class="todOpt" data-mode="dawn" type="button">🌅 Dawn</button>
      <button class="todOpt" data-mode="dusk" type="button">🌆 Dusk</button>
      <button class="todOpt" data-mode="night" type="button">🌙 Night</button>
    </div>
    <div class="todFoot">Tip: This only affects visuals. Clear override to return to real time.</div>
  `;

  wrapper.appendChild(btn);
  // Popover is appended to <body> so it can float above all UI layers.
  document.body.appendChild(pop);

  // Insert between theme and settings
  themeBtn.parentElement.insertBefore(wrapper, settingsBtn);

  function syncButton(){
    const ov = getOverride();
    const mode = ov || "";
    btn.textContent = iconFor(mode);
    btn.setAttribute("aria-label", `Time of Day: ${labelFor(mode)}`);
    pop.querySelectorAll("button.todOpt").forEach(b => {
      const m = b.getAttribute("data-mode") || "";
      b.setAttribute("aria-pressed", String(m === mode));
    });
  }

  function apply(mode){
    setOverride(mode);
    if (mode) applyBodyClass(mode);
    else applyBodyClass(""); // compute from real time now
    syncButton();
    try{
      window.dispatchEvent(new CustomEvent("fwm:tod-override-changed", { detail:{ mode: mode || null }}));
    }catch(_){}
  }


  function positionPopover(){
    const r = btn.getBoundingClientRect();

    // Temporarily show for measurement if needed
    const wasHidden = pop.hidden;
    if (wasHidden) { pop.style.visibility = "hidden"; pop.hidden = false; }

    // Measure
    const pw = pop.offsetWidth || 220;
    const ph = pop.offsetHeight || 140;

    // Default: align right edge with button right edge
    let left = r.right - pw;
    let top = r.bottom + 8;

    const pad = 8;
    // Clamp horizontally
    left = Math.max(pad, Math.min(left, window.innerWidth - pw - pad));

    // If would go off bottom, try above the button
    if (top + ph > window.innerHeight - pad) {
      top = r.top - ph - 8;
    }
    // Clamp vertically
    top = Math.max(pad, Math.min(top, window.innerHeight - ph - pad));

    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;

    if (wasHidden) { pop.hidden = true; pop.style.visibility = ""; }
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    pop.hidden = !pop.hidden;
    if (!pop.hidden) { positionPopover(); syncButton(); }
  });

  pop.addEventListener("click", (e) => {
    const target = e.target?.closest?.("button.todOpt");
    if (!target) return;
    const mode = target.getAttribute("data-mode") || "";
    apply(mode);
    pop.hidden = true;
  });

  function close(){
    if (!pop.hidden) pop.hidden = true;
  }

  document.addEventListener("click", (e) => {
    if (wrapper.contains(e.target) || pop.contains(e.target)) return;
    close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // Keep in sync if dev mode hotkey causes reload, etc.
  syncButton();

  // Expose helper (safe, small)
  if (typeof window.setTod !== "function"){
    window.setTod = (mode) => apply(mode ? String(mode) : "");
  }
}

// Public init
export function initTodDevPanel(){
  // Wait for DOM buttons to exist
  const tryMount = () => {
    mount();
    if (!document.getElementById("todDevBtn") && isDevMode()){
      // Buttons might not be ready yet, retry shortly.
      setTimeout(tryMount, 250);
    }
  };
  tryMount();
}
