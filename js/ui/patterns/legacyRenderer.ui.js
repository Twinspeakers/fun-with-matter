const TW_PROCESSED_ATTR = "data-tw";

export function twOnce(el, cls){
  if (!el) return;
  try{
    if (el.getAttribute(TW_PROCESSED_ATTR) === "1") return;
    cls.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
    el.setAttribute(TW_PROCESSED_ATTR, "1");
  }catch(_){/* ignore */}
}

export function twAdd(el, cls){
  if (!el) return;
  try{ cls.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c)); }catch(_){/* ignore */}
}

export function setShown(el, shown, displayClass="block"){
  if (!el) return;
  if (shown){
    el.classList.remove("hidden");
    if (displayClass) el.classList.add(displayClass);
  } else {
    el.classList.add("hidden");
    if (displayClass) el.classList.remove(displayClass);
  }
}

export function applyTierClass(el, tier){
  if (!el) return;
  const t = Number(tier);
  if (!t || Number.isNaN(t)) return;
  el.classList.add(`tier-${t}`);
}

// Apply baseline Tailwind utilities to static DOM once.
export function applyTailwindStaticSkin(){
  try{
    // Theme boundary: keep base classes minimal and let css/fwm-theme.css own the look.
    // (Tailwind utilities are still used for layout/spacing, but surfaces/borders are controlled by the design system.)
    document.body.classList.add("m-0", "font-sans", "fwm");
  }catch(_){/* ignore */}

  const app = document.querySelector(".app");
  if (app){
    // grid-cols-[clamp(280px,24vw,360px)_1fr]
    twOnce(app, "mx-auto grid min-h-screen gap-4 p-4 w-full max-w-[1280px] grid-cols-[clamp(280px,24vw,360px)_1fr] max-[1100px]:max-w-none");
  }

  document.querySelectorAll(".stack").forEach(el => twOnce(el, "flex flex-col gap-3"));
  document.querySelectorAll(".row").forEach(el => twOnce(el, "flex items-center justify-between gap-3"));
  // Panels: no loud borders; use subtle surfaces (design system overrides final appearance).
  document.querySelectorAll(".panel").forEach(el => twOnce(el, "rounded-2xl p-4 shadow-sm"));
  document.querySelectorAll(".title").forEach(el => twOnce(el, "text-base font-normal tracking-tight"));
  document.querySelectorAll(".muted").forEach(el => twOnce(el, "text-sm text-slate-500 dark:text-slate-400"));
  document.querySelectorAll(".small").forEach(el => twOnce(el, "text-xs"));

  // Inputs
  document.querySelectorAll("input[type=\"text\"],input[type=\"number\"],input[type=\"search\"],input[type=\"password\"],textarea,select").forEach(el => {
    twOnce(el, "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900/40 dark:focus:border-sky-700");
  });

  // Buttons (base)
  document.querySelectorAll("button").forEach(el => {
    if (el.classList.contains("navBtn")) return; // handled below
    twOnce(el, "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-normal shadow-sm hover:opacity-90 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed");
  });

  // Pages: Tailwind uses hidden/block instead of CSS .page/.active
  document.querySelectorAll(".page").forEach(p => {
    const isActive = p.classList.contains("active");
    setShown(p, isActive, "block");
  });

  // Collapsible bodies
  document.querySelectorAll(".panelCollapse").forEach(el => {
    const isOpen = el.classList.contains("open");
    setShown(el, isOpen, "block");
  });

  // Nav buttons
  // Nav: keep horizontal (no accidental vertical stacking). Scroll on small screens.
  document.querySelectorAll(".navRow").forEach(el => twOnce(el, "mb-3 flex flex-nowrap gap-2 overflow-x-auto"));
  document.querySelectorAll(".navBtn").forEach(el => twOnce(el, "relative grid h-11 w-11 place-items-center rounded-xl shadow-sm"));

  // Inspectors
  const insp = document.getElementById("itemInspector");
  if (insp){
    twOnce(insp, "fixed z-[9999] hidden w-[340px] max-w-[92vw] rounded-2xl p-3 shadow-xl");
    // Ensure inspectors appear above loot modals (lootOverlay uses z-index:10000)
    // but below confirm/action modals (actionOverlay uses z-index:11000).
    insp.style.zIndex = "10500";
  }
  const attrInsp = document.getElementById("attrInspector");
  if (attrInsp){
    twOnce(attrInsp, "fixed z-[9999] hidden w-[360px] max-w-[92vw] rounded-2xl p-3 shadow-xl");
    attrInsp.style.zIndex = "10500";
  }

  // Tier badge baseline (no background by default; we tint via tier classes when used)
  document.querySelectorAll(".tierBadge").forEach(el => twOnce(el, "text-[11px] font-normal tracking-tight"));
  // Slot symbol baseline
  document.querySelectorAll(".slotSymbol").forEach(el => twOnce(el, "grid place-items-center text-xl leading-none select-none"));

  // Equipped + toolbelt containers if present
  const eg = document.getElementById("equipGrid");
  if (eg) twOnce(eg, "grid grid-cols-3 grid-rows-6 gap-2 justify-items-center");
  const tg = document.getElementById("toolbeltGrid");
  if (tg) twOnce(tg, "flex flex-wrap gap-2");

  // Mini grids (left inventory, etc)
  document.querySelectorAll(".miniGrid").forEach(el => twOnce(el, "grid grid-cols-4 gap-2"));

  // Icon grids (store/craft/distillery): must wrap into rows (no vertical list mode)
  document.querySelectorAll(".storeGrid").forEach(el => twOnce(el, "flex flex-wrap items-start justify-start gap-2"));
}

// Apply Tailwind utilities to dynamic nodes (slots, lists) every render.
export function applyTailwindDynamicSkin(){
  try{
    // Slots
    document.querySelectorAll(".slot,.miniSlot").forEach(slot => {
      // Slots are recreated on each render, so a one-time marker is fine.
      if (slot.getAttribute(TW_PROCESSED_ATTR) === "1") return;

      // Icon Tile System owns sizing/colors/hover; Tailwind only provides basic layout helpers.
      twOnce(slot, "relative grid place-items-center overflow-hidden cursor-pointer select-none");

      if (slot.classList.contains("is-empty")) twAdd(slot, "opacity-50");
    });

    // Pills
    document.querySelectorAll(".pill").forEach(p => {
      twOnce(p, "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-normal tracking-tight");
    });

    // Generic rows/cards
    document.querySelectorAll(".itemRow").forEach(r => {
      twOnce(r, "flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900");
    });
    document.querySelectorAll(".nodeCard").forEach(r => {
      twOnce(r, "flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900");
    });
  }catch(_){/* ignore */}
}

const sortChipsRegistry = new Map(); // selectEl -> {buttons: HTMLButtonElement[]}

export function mountSortChips(selectEl, mountEl){
  if (!selectEl || !mountEl) return;
  if (mountEl.getAttribute("data-mounted") === "1") return;

  const wrap = document.createElement("div");
  wrap.className = "sortChips";
  wrap.setAttribute("role", "group");

  const buttons = [];
  const opts = Array.from(selectEl.options || []);

  for (const opt of opts){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sortChip";
    btn.textContent = String(opt.textContent || opt.value);
    btn.dataset.value = String(opt.value);
    btn.setAttribute("aria-pressed", "false");

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const v = btn.dataset.value;
      if (!v) return;
      if (selectEl.value !== v) selectEl.value = v;
      // Drive existing change listeners.
      try{ selectEl.dispatchEvent(new Event("change", { bubbles: true })); }catch(_){
        // Fallback for older browsers
        try{ const ev = document.createEvent("HTMLEvents"); ev.initEvent("change", true, false); selectEl.dispatchEvent(ev); }catch(__){}
      }
      syncSortChips(selectEl);
    });

    buttons.push(btn);
    wrap.appendChild(btn);
  }

  mountEl.innerHTML = "";
  mountEl.appendChild(wrap);
  mountEl.setAttribute("data-mounted", "1");

  sortChipsRegistry.set(selectEl, { buttons, mountEl, wrap });

  // Initial sync
  syncSortChips(selectEl);
}

export function syncSortChips(selectEl){
  const reg = sortChipsRegistry.get(selectEl);
  if (!reg) return;
  const current = selectEl?.value;
  reg.buttons.forEach(btn => {
    const active = btn.dataset.value === current;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}
