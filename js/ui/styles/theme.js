// Fun With Matter — World Time Toggle (unified theme)
//
// Backwards-compat note:
// The app historically had a Light/Dark toggle stored under `storygame_theme`.
// We now have ONE system: World Time (dawn/day/dusk/night). The UI theme
// (light/dark) is derived from World Time.
//
// We keep the export name `initThemeToggle` so the rest of the app doesn't need
// sweeping refactors.

const TOD_OVERRIDE_KEY = "fwm_tod_override";

const ORDER = ["", "dawn", "day", "dusk", "night"]; // "" = Auto

function themeForTod(m){
  return (m === "night" || m === "dusk") ? "dark" : "light";
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

function getOverride(){
  try{
    const v = localStorage.getItem(TOD_OVERRIDE_KEY);
    const m = String(v || "").toLowerCase();
    return ["day","dawn","dusk","night"].includes(m) ? m : "";
  }catch(_){
    return "";
  }
}

function setOverride(mode){
  try{
    if (!mode) localStorage.removeItem(TOD_OVERRIDE_KEY);
    else localStorage.setItem(TOD_OVERRIDE_KEY, mode);
  }catch(_){/* ignore */}
}

function computeFromBody(){
  try{
    const m = String(document.body?.dataset?.tod || "").toLowerCase();
    return ["day","dawn","dusk","night"].includes(m) ? m : "day";
  }catch(_){
    return "day";
  }
}

function apply(mode){
  const m = String(mode || "").toLowerCase();

  // Persist override (or clear for Auto)
  setOverride(m);

  // Prefer the canonical helper from bootstrap (keeps class + theme in sync)
  if (typeof window !== "undefined" && typeof window.setTod === "function"){
    window.setTod(m || null);
  }else{
    // Fallback (should be rare)
    const body = document.body;
    if (body){
      body.classList.remove("tod-day","tod-dawn","tod-dusk","tod-night");
      const use = m || computeFromBody();
      body.classList.add(`tod-${use}`);
      try{ body.dataset.tod = use; }catch(_){/* ignore */}
      try{ document.documentElement.dataset.theme = themeForTod(use); }catch(_){/* ignore */}
    }
  }

  // Notify any listeners (dev panel, etc.)
  try{
    window.dispatchEvent(new CustomEvent("fwm:tod-override-changed", { detail:{ mode: m || null }}));
  }catch(_){/* ignore */}
}

function nextMode(current){
  const idx = Math.max(0, ORDER.indexOf(current));
  return ORDER[(idx + 1) % ORDER.length];
}

export function initThemeToggle(btn){
  if (!btn) return;

  // Make the intent clear in the UI.
  btn.title = "World Time (Auto/Dawn/Day/Dusk/Night)";

  const sync = () => {
    const ov = getOverride();
    const effective = ov || computeFromBody();
    btn.textContent = iconFor(ov || "");
    btn.setAttribute("aria-label", `World Time: ${labelFor(ov || "")} (now: ${labelFor(effective)})`);
    btn.dataset.mode = ov || "";
  };

  // Initial paint
  sync();

  // Cycle through modes on click
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const cur = getOverride();
    const nxt = nextMode(cur);
    apply(nxt);
    sync();
  });

  // Keep label fresh as TOD changes in Auto mode
  setInterval(sync, 60_000);

  // External changes (dev panel, console, save import)
  window.addEventListener("fwm:tod-override-changed", sync);
}
