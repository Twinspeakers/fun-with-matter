
import { state, SAVE_KEY, saveGame, loadGame, resetToNewGame, resetLevelsKeepProgress, hasResources, spendResources, addResources, grantBlueprint, toggleQuickSlot, startMonsterBrawl, battleAct, regenHpTick, oxygenTick, startRefineJob, collectRefineJob, startCraftJob, collectCraftJob, startJunkyardScavenge, junkyardTick, storeTick, buyThing, sellThing, salvageThing, deleteThing, labelFor, toggleLock, undoLastSale, equipGear, unequipGear, toggleToolbelt, equippedSlotFor, setActiveCharacter, chargeGadget, upgradeGadget, distilleryStoreElement, distilleryUpgradeContainer, distilleryUnloadInventory, distilleryBottle, distillScrap, toggleBreathe, a1ApplyStorageUpgrade, a1ApplyLinkUpgrade, a1DepositFromCabinet } from "../core/state/store.js";
import { story, chapters } from "../data/story/nodes.js";
import { initUI, renderAll, renderTickUI } from "../ui/patterns/legacyRenderer.js";
import { createGatheringSystem } from "../features/gathering/gathering.logic.js";
import { initDevMode, applyDevThemeOverrides, isDevMode } from "./devMode.js";
import { hasDevStoryOverride, saveDevStoryOverride, clearDevStoryOverride } from "./devStoryOverrides.js";

// If anything throws during boot, the app used to look like it "lost" the right column.
// This lightweight overlay makes the error visible (and keeps the UI usable for debugging).
function showBootError(err){
  try{
    const existing = document.getElementById("bootErrorOverlay");
    if (existing) existing.remove();
    const wrap = document.createElement("div");
    wrap.id = "bootErrorOverlay";
    wrap.style.position = "fixed";
    wrap.style.left = "14px";
    wrap.style.right = "14px";
    wrap.style.bottom = "14px";
    wrap.style.zIndex = "9999";
    wrap.style.maxHeight = "40vh";
    wrap.style.overflow = "auto";
    wrap.style.background = "rgba(0,0,0,.85)";
    wrap.style.color = "#fff";
    wrap.style.borderRadius = "12px";
    wrap.style.padding = "12px";
    wrap.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
    wrap.style.fontSize = "12px";
    wrap.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
        <div><span class="label">Boot error</span> (right column may not render)</div>
        <button id="bootErrorClose" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;cursor:pointer">Close</button>
      </div>
      <pre style="white-space:pre-wrap;margin:10px 0 0">${String(err?.stack || err)}</pre>`;
    document.body.appendChild(wrap);
    wrap.querySelector("#bootErrorClose")?.addEventListener("click", () => wrap.remove());
  }catch(_){/* ignore */}
}

let gathering = null;
let bootOk = false;
let didBootstrap = false;

// -----------------------------
// Time of Day (Phase 2 — cosmetic)
// - Smooth dawn/dusk progression via CSS vars
// - Dedicated sky layers (sunrise/sun, clouds, noise, stars)
// -----------------------------
const TOD_CLASSES = ["tod-day","tod-dusk","tod-night","tod-dawn"];
const TOD_OVERRIDE_KEY = "fwm_tod_override";

function ensureTodLayers(){
  try{
    if (!document || !document.body) return;
    const body = document.body;

    // Create any missing sky layers. CSS assigns z-index so ordering isn't fragile.
    const ids = ["todBackdrop", "todSun", "todSunrise", "todClouds", "todNoise", "todStars"];
    for (const id of ids){
      let el = document.getElementById(id);
      if (!el){
        el = document.createElement("div");
        el.id = id;
        body.prepend(el);
      }
    }
  }catch(_){/* ignore */}
}

function clamp01(n){
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function computeTodMeta(d = new Date()){
  // Local time bands:
  // Dawn 05:00–07:59, Day 08:00–16:59, Dusk 17:00–19:59, Night 20:00–04:59
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  const mins = (h * 60) + m + (s / 60);

  const DAWN_A = 5 * 60;
  const DAY_A  = 8 * 60;
  const DUSK_A = 17 * 60;
  const NITE_A = 20 * 60;

  if (mins >= DAWN_A && mins < DAY_A){
    return { mode: "dawn", progress: clamp01((mins - DAWN_A) / (DAY_A - DAWN_A)), inBand: true };
  }
  if (mins >= DAY_A && mins < DUSK_A){
    return { mode: "day", progress: 1, inBand: true };
  }
  if (mins >= DUSK_A && mins < NITE_A){
    return { mode: "dusk", progress: clamp01((mins - DUSK_A) / (NITE_A - DUSK_A)), inBand: true };
  }
  // Night wraps across midnight
  return { mode: "night", progress: 1, inBand: true };
}

function applyTimeOfDay(mode){
  const m = String(mode || "").toLowerCase();
  if (!m) return;
  const body = document.body;
  if (!body) return;
  const cls = `tod-${m}`;
  const changed = !body.classList.contains(cls);
  if (changed){
    for (const c of TOD_CLASSES) body.classList.remove(c);
    body.classList.add(cls);
  }
  try{ body.dataset.tod = m; }catch(_){/* ignore */}
  // Unified theme: dusk/night => dark, dawn/day => light
  try{ document.documentElement.dataset.theme = (m === "night" || m === "dusk") ? "dark" : "light"; }catch(_){/* ignore */}
  return changed;
}

function easeInOut(t){
  const x = clamp01(t);
  // smoothstep-ish
  return x * x * (3 - 2 * x);
}

function applyTodVars(mode, progress, meta){
  const body = document.body;
  if (!body) return;

  const p = clamp01(progress);
  const pct = `${(p * 100).toFixed(2)}%`;
  body.style.setProperty("--tod-p", String(p.toFixed(4)));
  body.style.setProperty("--tod-pct", pct);

  // Stars fade in/out across dusk/dawn
  let stars = 0;
  if (mode === "night") stars = 0.55;
  else if (mode === "dusk") stars = 0.55 * easeInOut(p);
  else if (mode === "dawn") stars = 0.55 * (1 - easeInOut(p));
  body.style.setProperty("--tod-stars-opacity", String(stars.toFixed(3)));

  // Sun + clouds live in day-ish times and taper off
  let sun = 0;
  let sunrise = 0;
  let clouds = 0;
  if (mode === "day"){
    sun = 1;
    sunrise = 0;
    clouds = 0.22;
  }else if (mode === "dawn"){
    sun = easeInOut(p);
    sunrise = easeInOut(Math.min(1, p * 1.35));
    clouds = 0.18 + (0.10 * easeInOut(p));
  }else if (mode === "dusk"){
    sun = 1 - easeInOut(p);
    sunrise = easeInOut(1 - Math.min(1, p * 1.15));
    clouds = 0.18 + (0.06 * (1 - easeInOut(p)));
  }else{
    sun = 0;
    sunrise = 0;
    clouds = 0;
  }
  body.style.setProperty("--tod-sun-opacity", String(clamp01(sun).toFixed(3)));
  body.style.setProperty("--tod-sunrise-opacity", String(clamp01(sunrise).toFixed(3)));
  body.style.setProperty("--tod-clouds-opacity", String(clamp01(clouds).toFixed(3)));

  // Helpful for CSS debugging
  try{ body.dataset.todP = String(p.toFixed(3)); }catch(_){/* ignore */}
}

function initTimeOfDay(){
  if (typeof window === "undefined" || typeof document === "undefined") return;
  ensureTodLayers();

  const readOverride = () => {
    try{
      const ov = window.localStorage ? localStorage.getItem(TOD_OVERRIDE_KEY) : null;
      const m = String(ov || "").toLowerCase();
      return ["day","dawn","dusk","night"].includes(m) ? m : "";
    }catch(_){
      return "";
    }
  };

  const update = () => {
    const now = new Date();
    const meta = computeTodMeta(now);
    const ov = readOverride();

    let mode = ov || meta.mode;
    let progress = meta.progress;

    // If the user forces a different band, show a sensible mid-state for dawn/dusk.
    if (ov && ov !== meta.mode){
      progress = (ov === "dawn" || ov === "dusk") ? 0.5 : 1;
    }

    applyTimeOfDay(mode);
    applyTodVars(mode, progress, meta);
  };

  // First paint
  update();

  // Responsive updates (low cost; gradients update via CSS vars)
  // Some UI toggles only persist the override; polling faster keeps manual switches snappy.
  setInterval(update, 1_000);

  // External changes (theme toggle/dev panel)
  window.addEventListener("fwm:tod-override-changed", update);

  // Dev helper: setTod("night") / setTod(null)
  try{
    window.setTod = (mode) => {
      if (mode == null || mode === ""){
        try{ localStorage.removeItem(TOD_OVERRIDE_KEY); }catch(_){}
        update();
        return;
      }
      const m = String(mode).toLowerCase();
      if (!["day","dawn","dusk","night"].includes(m)) return;
      try{ localStorage.setItem(TOD_OVERRIDE_KEY, m); }catch(_){}
      update();
    };
  }catch(_){/* ignore */}
}

export function bootstrap(){
  if (didBootstrap) return;
  didBootstrap = true;
  // Cosmetic day/night cycle (Phase 2)
  try{ initTimeOfDay(); }catch(_){/* ignore */}

  window.addEventListener("error", (e) => {
    showBootError(e?.error || e?.message || e);
  });
  window.addEventListener("unhandledrejection", (e) => {
    showBootError(e?.reason || e);
  });

  gathering = createGatheringSystem({ renderAll });
  runBoot();
}

function gotoNode(nodeId){
  const id = String(nodeId || "").trim();
  if (!id) return;
  const canGo = !!story[id] || (isDevMode() && hasDevStoryOverride(id));
  if (!canGo) return;
  state.currentNodeId = id;
  state.ui.activePage = "story";
  // Reset beat cursor when jumping.
  if (!state.ui) state.ui = {};
  state.ui.storyBeatNodeId = id;
  state.ui.storyBeatIndex = 0;
  saveGame();
  renderAll();
}

// -----------------------------
// Chapter progress tracking
// -----------------------------
function ensureChapterProgress(){
  if (!state.storyProgress || typeof state.storyProgress !== "object"){
    state.storyProgress = { chapters: {} };
  }
  if (!state.storyProgress.chapters || typeof state.storyProgress.chapters !== "object"){
    state.storyProgress.chapters = {};
  }
}

function getChapterProgress(chKey){
  ensureChapterProgress();
  if (!state.storyProgress.chapters[chKey]){
    state.storyProgress.chapters[chKey] = { status: "not_started", timesCompleted: 0 };
  }
  return state.storyProgress.chapters[chKey];
}

function markChapterStarted(chKey){
  const prog = getChapterProgress(chKey);
  if (prog.status === "finished") return;
  prog.status = "in_progress";
}

function markChapterFinished(chKey){
  const prog = getChapterProgress(chKey);
  prog.status = "finished";
}

function incrementChapterWin(chKey){
  const prog = getChapterProgress(chKey);
  prog.timesCompleted = Math.max(0, Math.floor(prog.timesCompleted ?? 0)) + 1;
}

function openChapter(chKey){
  const ch = chapters.find(c => c.key === chKey);
  if (!ch) return;
  if (!state.ui) state.ui = {};
  state.ui.activeChapterKey = chKey;

  // Only non-repeatable chapters track Started/Finished.
  if (!ch.repeatable){
    markChapterStarted(chKey);
  }
  gotoNode(ch.startNodeId);
}

function onChoice(choice){
  if (choice.requires && !hasResources(choice.requires)) return;

  if (choice.spend) spendResources(choice.spend);
  if (choice.rewardBlueprint) grantBlueprint(choice.rewardBlueprint);

  // Actions
  if (choice.action){
    if (choice.action === "start_brawl"){
      startMonsterBrawl();
      if (!state.ui) state.ui = {};
      delete state.ui.vulkraineBeats;
      delete state.ui.vulkraineLogLen;

    } else if (choice.action === "start_junkyard"){
      // Start a 20s scavenging run. The 1s tick loop resolves the timer and opens the Loot modal.
      startJunkyardScavenge();

    } else if (choice.action === "clear_junkyard_distilled"){
      if (!state.ui) state.ui = {};
      state.ui.lastJunkyardDistilled = null;

    } else if (choice.action === "exit_chapter"){
      // Leave a chapter cleanly (especially important for repeatable chapters).
      if (!state.ui) state.ui = {};
      state.ui.activeChapterKey = null;
      state.ui.storyBeatNodeId = choice.next || "choose_adventure";
      state.ui.storyBeatIndex = 0;

      // If the player backs out mid-scavenge, cancel the run to avoid surprise loot popping later.
      try{
        if (state?.jobs?.junkyard?.active){
          state.jobs.junkyard.active = false;
          state.jobs.junkyard.endAt = 0;
          state.jobs.junkyard.pendingKey = null;
        }
      }catch(_){ /* ignore */ }

    } else if (choice.action === "finish_chapter"){
      const chKey = choice.chapterKey || state?.ui?.activeChapterKey || null;
      const ch = chKey ? chapters.find(c => c.key === chKey) : null;

      // Clear battle UI state
      state.battle = null;
      if (state.ui){
        delete state.ui.vulkraineBeats;
        delete state.ui.vulkraineLogLen;
        state.ui.storyBeatNodeId = choice.next || "choose_adventure";
        state.ui.storyBeatIndex = 0;
        state.ui.activeChapterKey = null;
      }

      if (chKey && ch){
        if (ch.repeatable){
          if (choice.result === "victory") incrementChapterWin(chKey);
        } else {
          markChapterFinished(chKey);
        }
      }
    }
  }

  // Normal navigation
  if (choice.next) {
    state.currentNodeId = choice.next;
  }

  saveGame();
  renderAll();
}

// -----------------------------
// Battle UI actions (Monster Brawl)
// -----------------------------
function onBattleAction(kind, key){
  const res = battleAct(kind, key);
  if (res?.next){
    state.currentNodeId = res.next;
  }
  saveGame();
  renderAll();
}

// Story beats: advance the current node one beat when applicable.
function onStoryAdvance(){
  // If a battle is on-screen, taps should not advance story beats.
  if (state?.battle?.active) return;
  const node = story[state.currentNodeId];
  if (!node) return;

  // Determine whether this node uses beats.
  let rawBeats = null;
  if (node.beats !== undefined){
    rawBeats = (typeof node.beats === "function") ? node.beats(state) : node.beats;
  } else if (Array.isArray(node.text)) {
    rawBeats = node.text;
  } else if (typeof node.text === "function"){
    const res = node.text(state);
    if (Array.isArray(res)) rawBeats = res;
  }
  if (!Array.isArray(rawBeats) || rawBeats.length === 0) return;

  if (!state.ui) state.ui = {};
  if (state.ui.storyBeatNodeId !== state.currentNodeId){
    state.ui.storyBeatNodeId = state.currentNodeId;
    state.ui.storyBeatIndex = 0;
  }

  const idx = Math.max(0, Math.floor(state.ui.storyBeatIndex ?? 0));
  if (idx >= rawBeats.length - 1){
    // At final beat. If no choices + autoNext, allow click-to-advance.
    let rawChoices = [];
    try{
      rawChoices = (typeof node.choices === "function") ? (node.choices(state) ?? []) : (node.choices ?? []);
    }catch(_){ rawChoices = node.choices ?? []; }
    const hasChoices = Array.isArray(rawChoices) && rawChoices.length > 0;

    let nextId = null;
    if (!hasChoices && node.autoNext){
      nextId = (typeof node.autoNext === "function") ? node.autoNext(state) : node.autoNext;
    }
    if (!hasChoices && nextId){
      state.currentNodeId = nextId;
      state.ui.storyBeatNodeId = nextId;
      state.ui.storyBeatIndex = 0;
      saveGame();
      renderAll();
    }
    return;
  }

  state.ui.storyBeatIndex = idx + 1;
  saveGame();
  renderAll();
}

function onNavigate(pageId){
  state.ui.activePage = pageId;
  saveGame();
  renderAll();
}

function onSave(){
  saveGame();
  renderAll();
}

function onLoad(){
  gathering.stopAllGathering();
  const ok = loadGame();

  if (!ok) alert("No save found yet.");
  renderAll();
}

function onResetLevels(){
  const ok = confirm("Reset levels/XP only? (Keeps your inventory, blueprints, and story progress.)");
  if (!ok) return;
  gathering.stopAllGathering();
  resetLevelsKeepProgress();
  saveGame();
  renderAll();
}

function onResetFull(){
  const ok = confirm("Full reset to a new game? (This overwrites your current save.)");
  if (!ok) return;
  gathering.stopAllGathering();
  resetToNewGame();
  saveGame();
  renderAll();
}

function onToggleQuick(key){
  const changed = toggleQuickSlot(key);
  if (!changed){
    alert("You can only pin 3 elements to Quick Gather.");
    return;
  }
  saveGame();
  renderAll();
}

function onSetAvatar(avatarId){
  setActiveCharacter(avatarId);
  state.ui.playerMenuOpen = false;
  saveGame();
  renderAll();
}

function onStartRefine(recipeKey){
  const res = startRefineJob(recipeKey);
  if (!res.ok && res.reason) alert(res.reason);
  saveGame();
  renderAll();
}

function onCollectRefine(recipeKey){
  const res = collectRefineJob(recipeKey);
  if (!res.ok && res.reason) alert(res.reason);
  saveGame();
  renderAll();
}

function onStartCraft(blueprintKey){
  const res = startCraftJob(blueprintKey);
  if (!res.ok && res.reason) alert(res.reason);
  saveGame();
  renderAll();
}

function onCollectCraft(blueprintKey){
  const res = collectCraftJob(blueprintKey);
  if (!res.ok && res.reason) alert(res.reason);
  saveGame();
  renderAll();
}

// Store
function onBuy(key, qty){
  const res = buyThing(key, qty);
  if (!res.ok && res.reason) alert(res.reason);
  saveGame();
  renderAll();
}

function onSell(key, qty){
  const res = sellThing(key, qty);
  if (!res.ok && res.reason) alert(res.reason);
  saveGame();
  renderAll();
}

function onSalvage(key, qty = null){
  const res = salvageThing(key, qty);
  if (!res.ok && res.reason) alert(res.reason);
  saveGame();
  renderAll();
}

function onEquipToggle(key){
  // If it's already equipped, try to unequip.
  if (equippedSlotFor(key)){
    const res = unequipGear(key);
    if (!res.ok && res.reason) alert(res.reason);
    saveGame();
    renderAll();
    return;
  }

  const res = equipGear(key);
  if (!res.ok && res.reason) alert(res.reason);
  saveGame();
  renderAll();
}

function onToolbeltToggle(key){
  const res = toggleToolbelt(key);
  if (!res.ok && res.reason) alert(res.reason);
  saveGame();
  renderAll();
}

function onDelete(key){
  const ok = confirm(`Delete ${labelFor(key)}? This cannot be undone.`);
  if (!ok) return;
  const res = deleteThing(key);
  if (!res.ok && res.reason) alert(res.reason);
  saveGame();
  renderAll();
}

function onToggleLock(key){
  toggleLock(key);
  saveGame();
  renderAll();
}

function onUndoLastSale(){
  const res = undoLastSale();
  if (!res.ok && res.reason) alert(res.reason);
  saveGame();
  renderAll();
}

// -----------------------------
// SAVE TRANSFER (export/import)
// The game progress lives under SAVE_KEY (fun_with_matter_save_*),
// while some UI/settings use storygame_* and fwm_* keys.
// Export/import should transfer progress FIRST, and optionally bring
// along relevant settings.
// -----------------------------
function isTransferKey(k){
  if (!k) return false;
  if (k === SAVE_KEY) return true;                // full game state
  if (k.startsWith('storygame_')) return true;    // theme + legacy settings
  if (k.startsWith('fwm_')) return true;          // project-specific settings (e.g. TOD override)
  return false;
}

function listTransferStorageKeys(){
  const keys = [];
  for (let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if (!k) continue;
    if (isTransferKey(k)) keys.push(k);
  }
  keys.sort();
  return keys;
}

function buildSaveBundle(){
  const storage = {};
  for (const k of listTransferStorageKeys()){
    storage[k] = localStorage.getItem(k);
  }
  return {
    schema: 'storygame_save_bundle_v1',
    exportedAt: new Date().toISOString(),
    storage
  };
}

function getSaveTransferText(){
  try{
    return JSON.stringify(buildSaveBundle());
  }catch(e){
    console.error(e);
    return '';
  }
}

function looksLikeGameState(obj){
  return obj && typeof obj === 'object' && obj.player && typeof obj.player === 'object' && ('currentNodeId' in obj || 'ui' in obj);
}

function applySaveBundle(bundle){
  if (!bundle || typeof bundle !== 'object') return { ok:false, reason:'Invalid JSON.' };

  // Case A: Our bundle format
  if (bundle.schema === 'storygame_save_bundle_v1' && bundle.storage && typeof bundle.storage === 'object'){
    // Clear existing transferable keys first (atomic-ish: we only do this after validating input).
    for (const k of listTransferStorageKeys()) localStorage.removeItem(k);

    for (const [k,v] of Object.entries(bundle.storage)){
      const key = String(k);
      if (!isTransferKey(key)) continue;
      // localStorage only stores strings; treat null/undefined as removal
      if (v === null || v === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, String(v));
    }
    return { ok:true, reload:false };
  }

  // Case B: A raw state.json (older/manual exports)
  if (looksLikeGameState(bundle)){
    localStorage.setItem(SAVE_KEY, JSON.stringify(bundle));
    return { ok:true, reload:false };
  }

  return { ok:false, reason:'Unrecognized save format.' };
}

function syncThemeFromStorage(){
  try{
    const ov = localStorage.getItem(TOD_OVERRIDE_KEY);
    const meta = computeTodMeta(new Date());
    const o = String(ov || "").toLowerCase();
    const hasOv = o && ["day","dawn","dusk","night"].includes(o);
    const mode = hasOv ? o : meta.mode;
    const progress = (hasOv && o !== meta.mode && (o === "dawn" || o === "dusk")) ? 0.5 : meta.progress;
    try{ applyTimeOfDay(mode); }catch(_){/* ignore */}
    try{ applyTodVars(mode, progress, meta); }catch(_){/* ignore */}

    // Nudge any listeners (World Time button, dev panel) to refresh labels.
    try{ window.dispatchEvent(new CustomEvent("fwm:tod-override-changed", { detail:{ mode: ov || null }})); }catch(_){/* ignore */}
  }catch(_){/* ignore */}
}

function applySaveTransferText(txt){
  try{
    const data = JSON.parse(String(txt || ''));
    const res = applySaveBundle(data);
    if (!res.ok) return res;

    // Reload game state from localStorage into memory
    gathering.stopAllGathering();
    loadGame();
    syncThemeFromStorage();
    renderAll();

    return { ok:true, reload:false };
  }catch(e){
    console.error(e);
    return { ok:false, reason:'Could not parse JSON.' };
  }
}

// -----------------------------
// Left column: drag-reorder panels
// (Attributes / Inventory / Quick Gather / Quick Scavenge / History)
// -----------------------------
const LEFT_PANEL_DEFAULT_ORDER = ["statsPanel","invPanel","quickPanel","scavengePanel","historyPanel"];

function applyLeftPanelOrderFromState(){
  try{
    const host = document.getElementById("leftModules");
    if (!host) return;
    if (!state.ui || typeof state.ui !== "object") state.ui = {};

    const want = Array.isArray(state.ui.leftPanelOrder) ? state.ui.leftPanelOrder.slice() : null;
    const order = (want && want.length) ? want : LEFT_PANEL_DEFAULT_ORDER.slice();

    const map = {};
    host.querySelectorAll("[data-left-panel]").forEach(el => {
      const id = String(el.dataset.leftPanel || "");
      if (id) map[id] = el;
    });

    // Append in order, then any remaining panels.
    const applied = [];
    for (const id of order){
      const el = map[id];
      if (!el) continue;
      host.appendChild(el);
      applied.push(id);
      delete map[id];
    }
    for (const el of Object.values(map)){
      host.appendChild(el);
      if (el?.dataset?.leftPanel) applied.push(String(el.dataset.leftPanel));
    }

    state.ui.leftPanelOrder = applied;
  }catch(_){/* ignore */}
}

function initLeftPanelReorder(){
  const host = document.getElementById("leftModules");
  if (!host) return;

  applyLeftPanelOrderFromState();

  let drag = null;
  const threshold = 6;

  const saveOrder = () => {
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    const ids = Array.from(host.querySelectorAll("[data-left-panel]")).map(el => String(el.dataset.leftPanel || el.id || "")).filter(Boolean);
    state.ui.leftPanelOrder = ids;
    saveGame();
  };

  const getPanelFromTarget = (t) => t?.closest?.("[data-left-panel]");
  const getHandleFromTarget = (t) => t?.closest?.(".panelToggle");

  // Prevent accidental collapse toggle right after a drag.
  host.querySelectorAll(".panelToggle").forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (btn.dataset.dragSuppress === "1"){
        e.preventDefault();
        e.stopPropagation();
        btn.dataset.dragSuppress = "0";
      }
    }, true);
  });

  host.addEventListener("pointerdown", (e) => {
    const handle = getHandleFromTarget(e.target);
    if (!handle) return;
    // Only left mouse button.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const panel = getPanelFromTarget(handle);
    if (!panel) return;

    drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      started: false,
      panel,
      handle,
    };
    try{ handle.setPointerCapture(e.pointerId); }catch(_){/* ignore */}
  });

  host.addEventListener("pointermove", (e) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dy = e.clientY - drag.startY;
    const dx = e.clientX - drag.startX;

    if (!drag.started){
      if (Math.abs(dy) < threshold && Math.abs(dx) < threshold) return;
      drag.started = true;
      drag.panel.classList.add("leftPanelDragging");
      // If we dragged, suppress the next click on the handle.
      drag.handle.dataset.dragSuppress = "1";
    }

    e.preventDefault();

    const over = document.elementFromPoint(e.clientX, e.clientY);
    const overPanel = getPanelFromTarget(over);
    if (!overPanel || overPanel === drag.panel) return;

    const rect = overPanel.getBoundingClientRect();
    const before = (e.clientY < rect.top + rect.height / 2);
    if (before){
      host.insertBefore(drag.panel, overPanel);
    } else {
      host.insertBefore(drag.panel, overPanel.nextSibling);
    }
  }, { passive: false });

  const endDrag = (e) => {
    if (!drag || (e && drag.pointerId !== e.pointerId)) return;
    const wasStarted = !!drag.started;
    if (drag.handle){
      try{ drag.handle.releasePointerCapture(drag.pointerId); }catch(_){/* ignore */}
    }
    if (drag.panel) drag.panel.classList.remove("leftPanelDragging");
    drag = null;
    if (wasStarted) saveOrder();
  };

  host.addEventListener("pointerup", endDrag);
  host.addEventListener("pointercancel", endDrag);
}

function runBoot(){
  // Boot
  try{
    initUI({
  onNavigate,
  onSave,
  onLoad,
  onReset: onResetLevels,
  onResetLevels,
  onResetFull,

  getSaveTransferText,
  applySaveTransferText,

  onGather: (nodeId) => gathering.startGathering(nodeId),
  onCollect: (nodeId) => gathering.collectNode(nodeId),
  onGatherAll: () => gathering.gatherAllUnlocked(),
  onCollectAll: () => gathering.collectAllReady(),
  getNodeState: (nodeId) => gathering.getNodeState(nodeId),

  onChoice,
  onBattleAction,
  onStoryAdvance,
  onToggleBreathe: () => {
    const res = toggleBreathe();
    saveGame();
    renderAll();
    return res;
  },
  onFaintLeave: () => {
    // Return the player to the Choose Your Adventure screen.
    if (!state.ui) state.ui = {};
    delete state.ui.faintModal;
    delete state.ui.lootModal;
    state.ui.activePage = "story";
    state.currentNodeId = "choose_adventure";
    state.ui.storyBeatNodeId = "choose_adventure";
    state.ui.storyBeatIndex = 0;
    // Clear any lingering event context.
    if (state.battle) state.battle = null;
    if (state.jobs?.junkyard) state.jobs.junkyard.active = false;
    state.player.status = "Idle";
    saveGame();
    renderAll();
    return { ok:true };
  },
  onJunkyardScavenge: () => {
    const res = startJunkyardScavenge();
    if (res?.ok){
      saveGame();
      renderAll();
    }
    return res;
  },
  onGotoNode: gotoNode,
  onOpenChapter: openChapter,
  onToggleQuick,

  onStartRefine,
  onCollectRefine,

  onStartCraft,
  onCollectCraft,

  onBuy,
  onSell,
  onUndoLastSale,
  onToggleLock,
  onSalvage,
  onDelete,

  // A1 store upgrades (Store page)
  onA1UpgradeStorage: () => {
    const res = a1ApplyStorageUpgrade();
    if (!res?.ok && res?.reason) alert(res.reason);
    saveGame();
    renderAll();
    return res;
  },
  onA1UpgradeLink: () => {
    const res = a1ApplyLinkUpgrade();
    if (!res?.ok && res?.reason) alert(res.reason);
    saveGame();
    renderAll();
    return res;
  },

  onA1DepositFromCabinet: (elementKey, gramsQty) => {
    const res = a1DepositFromCabinet(elementKey, gramsQty);
    if (!res?.ok && res?.reason) alert(res.reason);
    saveGame();
    renderAll();
    return res;
  },

  onGadgetCharge: (gadgetKey) => { chargeGadget(gadgetKey); saveGame(); renderAll(); },
  onGadgetUpgrade: (gadgetKey) => { upgradeGadget(gadgetKey); saveGame(); renderAll(); },

  onEquipToggle,
  onToolbeltToggle,

  onCabinetStore: (elementKey) => {
    const res = distilleryStoreElement(elementKey, null);
    if (!res?.ok && res?.reason) alert(res.reason);
    saveGame();
    renderAll();
    return res;
  },
  onCabinetUpgrade: (elementKey) => {
    const res = distilleryUpgradeContainer(elementKey);
    if (!res?.ok && res?.reason) alert(res.reason);
    saveGame();
    renderAll();
    return res;
  },
  onCabinetBottle: (elementKey, tubeQty) => {
    const res = distilleryBottle(elementKey, tubeQty);
    if (!res?.ok && res?.reason) alert(res.reason);
    saveGame();
    renderAll();
    return res;
  },
  onCabinetBottleSell: (elementKey, tubeQty) => {
    // Full flow: Bottle -> item created -> sell via normal Store logic.
    const bottled = distilleryBottle(elementKey, tubeQty);
    if (!bottled?.ok){
      if (bottled?.reason) alert(bottled.reason);
      saveGame();
      renderAll();
      return bottled;
    }

    const s = sellThing(bottled.filledKey, bottled.tubesUsed);
    // If selling fails for any reason (locked, unsellable, etc.), we keep the items.
    const res = (s && s.ok)
      ? { ok:true, ...bottled, sold:true, payout: s.gained || 0 }
      : { ok:true, ...bottled, sold:false, payout: 0, sellError: s?.reason || "Cannot sell." };

    if (!res.sold && res.sellError) alert(res.sellError);
    saveGame();
    renderAll();
    return res;
  },
  onCabinetUnload: () => {
    const res = distilleryUnloadInventory();
    if (!res?.ok && res?.reason) alert(res.reason);
    saveGame();
    renderAll();
    return res;
  },
  // Primary action button from the loot modal (context-aware).
  onLootPrimary: (primary) => {
    const p = primary || {};

    // Lightweight navigation actions from the loot modal.
    // (Used by result modals like Salvage -> elements moved to Distillery Cabinet.)
    if (p.kind === "open_refining"){
      if (!state.ui) state.ui = {};
      state.ui.activePage = "refining";
      try { if (state.ui && typeof state.ui === "object" && state.ui.lootModal) delete state.ui.lootModal; } catch (_) { /* ignore */ }
      saveGame();
      renderAll();
      return { ok:true };
    }

    if (p.kind === "junkyard_salvage"){
      const scrapKey = String(p.scrapKey || "");
      const qty = Math.max(1, Math.floor(Number(p.qty) || 1));

      // Mark context so the Distilled loot modal can prioritize Continue.
      if (!state.ui) state.ui = {};
      state.ui._distillContext = "junkyard";

      const res = distillScrap(scrapKey, qty);

      // Clear context so other distills (Refine page) keep default button order.
      delete state.ui._distillContext;
      if (!res?.ok && res?.reason) alert(res.reason);
      if (res?.ok){
        if (!state.ui) state.ui = {};
        // Once salvaged, the scrap is consumed and we don't want the story
        // frame to fall back to the old "Found" messaging.
        state.ui.lastJunkyardLoot = null;

        const gained = res.gained || {};
        const xp = Math.max(0, Number((res && (res.xp ?? res.xpGained)) ?? 0) || 0);
        state.ui.lastJunkyardDistilled = {
          scrapKey,
          label: labelFor(scrapKey),
          gained,
          xpGained: xp,
          at: Date.now(),
        };

        // Show an overlay with the element results (same style as the Junkyard loot modal).
        // This is especially important for Quick Scavenge, where the story frame isn't visible.
        const items = Object.entries(gained || {})
          .map(([k, v]) => ({ key: String(k), qty: Math.max(0, Math.floor(Number(v) || 0)), kind: "item" }))
          .filter(it => !!it.key && it.qty > 0);
        const totalUnits = items.reduce((acc, it) => acc + (it.qty || 0), 0);
        state.ui.lootModal = {
          open: true,
          title: "Salvage Results",
          enemyName: labelFor(scrapKey),
          itemCount: totalUnits,
          blueprintCount: 0,
          items,
          primaryLabel: "Open Distillery",
          primaryAction: { kind: "open_refining" },
          continueLabel: "Close",
          // In Junkyard context, put Close first (faster loop).
          swapActions: true,
          at: Date.now(),
        };
      }

      saveGame();
      renderAll();
      return res;
    }
    return { ok:false, reason:"Unknown action." };
  },
  onDistillScrap: (scrapKey, qty) => {
    const res = distillScrap(scrapKey, qty);
    if (!res?.ok && res?.reason) alert(res.reason);

    // Show distill results in an overlay modal (works across pages).
    if (res?.ok){
      if (!state.ui) state.ui = {};
      const gained = res.gained || {};
      const items = Object.entries(gained)
        .map(([k, v]) => ({ key: String(k), qty: Math.max(0, Math.floor(Number(v) || 0)), kind: "item" }))
        .filter(it => !!it.key && it.qty > 0);
      const totalUnits = items.reduce((acc, it) => acc + (it.qty || 0), 0);
      state.ui.lootModal = {
        open: true,
        title: "Distill Results",
        enemyName: labelFor(String(scrapKey || "")),
        itemCount: totalUnits,
        blueprintCount: 0,
        items,
        primaryLabel: "Open Distillery",
        primaryAction: { kind: "open_refining" },
        continueLabel: "Close",
        at: Date.now(),
      };
    }

    saveGame();
    renderAll();
    return res;
  },

  onSetAvatar
    });
    // Dev Mode (local-only): drafts + theme overrides + convenience helpers.
    initDevMode();
    applyDevThemeOverrides().then(() => {
      // Re-render so CSS var overrides take effect even if the first render already happened.
      try{ renderAll(); }catch(_){/* ignore */}
    });

    // Expose a tiny dev API (dev mode only) so drafting/testing can happen quickly.
    try{
      window.FWM_DEV = window.FWM_DEV || {};
      window.FWM_DEV.isDevMode = isDevMode;
      window.FWM_DEV.gotoNode = gotoNode;
      window.FWM_DEV.saveScene = saveDevStoryOverride;
      window.FWM_DEV.clearScene = clearDevStoryOverride;
    }catch(_){/* ignore */}

    // Auto-load
    gathering.stopAllGathering();
    loadGame();

    // If the user toggled Dev Mode (Ctrl+Shift+D), reset the UI to a known-safe landing state.
    // This avoids "Loading reference…" limbo caused by carrying dev-only wiki selections across modes.
    try{
      const href = String(window.location.href || "");
      const url = new URL(href);
      const resetUi = url.searchParams.get("resetui") === "1";
      if (resetUi){
        // Remove the one-shot flag from the URL so refreshes don't keep resetting.
        url.searchParams.delete("resetui");
        try{ window.history.replaceState({}, "", url.toString()); }catch(_){/* ignore */}

        if (!state.ui) state.ui = {};
        // Default to the Wiki (Glossary) page and the Reference wiki section.
        // Dev-mode toggles should feel like a controlled reset, not a page jump back into Story.
        state.ui.activePage = "glossary";
        // On mobile, keep the user in the Wiki pane after a reset.
        state.ui.mobilePane = "wiki";
        // Reset wiki state to the canonical home page.
        state.ui.wiki = {
          pageId: "start_reference",
          q: "",
          cat: "All",
          focus: false,
          editingId: "",
          openNodes: {},
          hist: ["start_reference"],
          histIndex: 0,
        };
        // Ensure focus/expand layout is cleared.
        try{ document.body.classList.remove("focusWiki"); }catch(_){/* ignore */}

        saveGame();
      }
    }catch(_){/* ignore */}

    // Left column panel reorder (persisted in state.ui.leftPanelOrder)
    initLeftPanelReorder();

// vNext: Migrate legacy Monster Brawl nodes (old click-to-attack loop) to the new Pokemon-style battle UI.
// This prevents old saves from feeling "unchanged" after updates.
try{
  const legacyBrawlNodes = new Set(["sq_vulkraine_brawl","sq_monster_fight","sq_monster_result"]);
  if (legacyBrawlNodes.has(state.currentNodeId)){
    // Clear legacy combat-loop state.
    if (!state.ui) state.ui = {};
    delete state.ui.vulkraineBeats;
    delete state.ui.vulkraineLogLen;

    // Start the new battle module and jump into its render node.
    startMonsterBrawl();
    const brawlNode = story.sq_brawl_battle ? "sq_brawl_battle" : (story.sq_vulkraine_minion ? "sq_vulkraine_minion" : "sq_monster_intro");
    state.currentNodeId = brawlNode;
    state.ui.storyBeatNodeId = brawlNode;
    state.ui.storyBeatIndex = 0;
    saveGame();
  }
}catch(_){ /* ignore migration errors */ }

// If the save points at a story node that no longer exists (common after updates),
// recover to a safe entry point so the Story page can render.
// (Dev mode can intentionally point at a draft override.)
if (!story[state.currentNodeId] && !(isDevMode() && hasDevStoryOverride(state.currentNodeId))){
  const fallback = story.sq_monster_intro ? "sq_monster_intro" : (story.start ? "start" : Object.keys(story)[0]);
  if (fallback){
    state.currentNodeId = fallback;
    if (!state.ui) state.ui = {};
    state.ui.storyBeatNodeId = fallback;
    state.ui.storyBeatIndex = 0;
    // Clear any half-baked battle UI state
    if (state?.battle?.active) state.battle = null;
    saveGame();
  }
}
    renderAll();
    bootOk = true;
  }catch(e){
    showBootError(e);
  }

  if (bootOk){
    // Passive HP regen + Oxygen tick: runs every 30 seconds
    setInterval(() => {
      const changed = !!regenHpTick() || !!oxygenTick();
      if (changed){
        saveGame();
        renderAll();
      }
    }, 30_000);

    // Keep countdowns fresh + resolve time-based events
    // IMPORTANT: do NOT re-render the whole UI every second. That causes DOM rebuild regressions
    // (scroll/caret resets in the wiki editor, focus layout flicker, etc.).
    // Instead: resolve time-based state changes, then do a lightweight tick UI update.
    setInterval(() => {
      const changed = !!junkyardTick() || !!storeTick();
      if (changed){
        saveGame();
        renderAll();
        return;
      }
      try{ renderTickUI(); }catch(_){ /* ignore */ }
    }, 1000);
  }
}
