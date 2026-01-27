
import { state, saveGame, loadGame, resetToNewGame, hasResources, hasTool, toggleQuickSlot,
         startRefineJob, collectRefineJob, getRefineJob,
         startCraftJob, collectCraftJob, getCraftJob,
         labelFor, symbolFor, setStatus, spendResources, grantBlueprint, LOOTPOOLS,
         setPlayerName,
         adjustMU,
         LEVEL_CAP, LEVEL_XP_REQUIREMENTS,
         ATTRIBUTE_KEYS, getAttributeLevel, getAttributeProgress,
         CHARACTER_IDS, COMBAT_STAT_KEYS, getCharacter, getActiveCharId, getCombatStatLevel, getCombatStatProgress,
         getCombatTrainingTarget, setCombatTrainingTarget,
         equippedSlotFor, toolbeltSlotFor,
         BRAWL_MOVES, BRAWL_TECH, getMovePoolForChar,
         GADGET_KEYS, getGadgetState, getGadgetBattleActionName, getGadgetBattleReqLevel,
         distilleryCapFor, distilleryStoredFor, distilleryNextUpgradeGainFor, distilleryUpgradeCostFor, knownDistilledScraps,
         getA1StoreUpgradeStatus } from "../../core/state/store.js";
import { nodes, nodesL1, gatherables, gatherablesL1, thingByKey, ALLOWED_ELEMENTS_L1 } from "../../data/items/store.js";
import { story, chapters } from "../../data/story/nodes.js";
import { refineRecipes, blueprintCatalog } from "../../data/items/blueprints.js";
import { periodicTable, findabilityTierFor, tierLabel } from "../../data/items/elements.js";

const PERIODIC_Z_BY_SYMBOL = (() => {
  const m = {};
  (periodicTable || []).forEach(e => {
    if (e && e.symbol && e.Z) m[String(e.symbol)] = Number(e.Z);
  });
  return m;
})();
// Wiki now loads from /wiki/index.json + /wiki/pages/*.md via wikiFS.
import {
  ensureWikiFSLoaded,
  getWikiFSState,
  wikiFSGetSections,
  wikiFSGetPageMeta,
  wikiFSListPages,
  wikiFSHas,
  resolveWikiId,
  wikiFSLoadPage
} from "../../data/wiki/wikiFS.js";
import { formatTimeMs } from "../../core/engine/rng/rng.js";
import { avatars, avatarById } from "../../data/story/avatars.js";
import { isDevMode } from "../../app/devMode.js";
import { getDevStoryNode, saveDevStoryOverride, clearDevStoryOverride } from "../../app/devStoryOverrides.js";
import {
  applyTailwindDynamicSkin,
  applyTailwindStaticSkin,
  applyTierClass,
  mountSortChips,
  setShown,
  syncSortChips,
  twAdd,
  twOnce
} from "./legacyRenderer.ui.js";
import {
  closeActionModal as closeActionModalImpl,
  getActionModalRefs as getActionModalRefsImpl,
  openActionModal as openActionModalImpl,
  renderActionModal as renderActionModalImpl,
  renderFaintModal as renderFaintModalImpl,
  renderLootModal as renderLootModalImpl
} from "./legacyRenderer.modals.js";
import {
  renderHistory as renderHistoryImpl,
  renderInventoryPage as renderInventoryPageImpl,
  renderInventoryPanels as renderInventoryPanelsImpl,
  renderLeftPanels as renderLeftPanelsImpl,
  renderMiniInventory as renderMiniInventoryImpl,
  renderStats as renderStatsImpl
} from "./legacyRenderer.inventory.js";
import {
  a1StoreOnEnter as a1StoreOnEnterImpl,
  a1StoreTalk as a1StoreTalkImpl,
  fmtMsCompact,
  openA1TransferModal as openA1TransferModalImpl,
  renderA1UpgradePanel as renderA1UpgradePanelImpl,
  renderStore as renderStoreImpl
} from "./legacyRenderer.store.js";

let els = null;
let handlers = null;

// In some hosting setups (or after live-reload), it's possible to end up with multiple
// module instances. We keep a tiny shared reference on `window` so renderAll can recover
// even if its local module-scoped `els` hasn't been initialized yet.
function syncUIRefsToWindow(){
  try{
    if (typeof window === "undefined") return;
    window.__FWM_UI = window.__FWM_UI || {};
    if (els) window.__FWM_UI.els = els;
    if (handlers) window.__FWM_UI.handlers = handlers;
  }catch(_){/* ignore */}
}

function recoverUIRefsFromWindow(){
  try{
    if (typeof window === "undefined") return;
    const bag = window.__FWM_UI;
    if (!els && bag?.els) els = bag.els;
    if (!handlers && bag?.handlers) handlers = bag.handlers;
  }catch(_){/* ignore */}
}

// --- Sorting helpers (Type / Tier / Name) ---
function kindOrder(kind){
  if (kind === "Gear") return 0;
  if (kind === "Tool") return 1;
  if (kind === "Item") return 2;
  if (kind === "Material") return 3;
  return 9;
}

function sortKeyList(keys, mode){
  const m = (mode || "type").toLowerCase();
  return keys.slice().sort((a,b) => {
    const ta = thingByKey[a] || {};
    const tb = thingByKey[b] || {};
    if (m === "name"){
      const na = (ta.label || a).toLowerCase();
      const nb = (tb.label || b).toLowerCase();
      return na.localeCompare(nb);
    }
    if (m === "tier"){
      const da = Number(ta.tier ?? 99);
      const db = Number(tb.tier ?? 99);
      if (da !== db) return da - db;
      const na = (ta.label || a).toLowerCase();
      const nb = (tb.label || b).toLowerCase();
      return na.localeCompare(nb);
    }
    // type (default)
    const ka = kindOrder(ta.kind);
    const kb = kindOrder(tb.kind);
    if (ka !== kb) return ka - kb;
    const da = Number(ta.tier ?? 99);
    const db = Number(tb.tier ?? 99);
    if (da !== db) return da - db;
    const na = (ta.label || a).toLowerCase();
    const nb = (tb.label || b).toLowerCase();
    return na.localeCompare(nb);
  });
}

let inspectorKey = null;
let inspectorAnchorEl = null;
let inspectorContext = "inventory"; // "inventory" | "store-buy" | "store-sell"
let hideInspectorTimer = null;

let inspectorAnimTimer = null;
let attrInspectorAnimTimer = null;
let attrInspectorKey = null;
let attrInspectorAnchorEl = null;
let hideAttrInspectorTimer = null;
// Attribute inspector is click-open only (no hover). It remains open until closed via the X button
// or by clicking outside the inspector.
let attrInspectorPinned = false;
let attrScrollY = 0;
let attrScrollMax = 0;
let wikiBuilt = false;

// Story beats (click-to-advance) rendering
let lastStoryTextRendered = null;
let lastStorySpeakerRendered = null;
let lastStoryBgRendered = null;
let lastStoryCgRendered = null;
let lastStoryCharsRendered = null;

// -----------------------------
// Battle UI (Monster Brawl)
// -----------------------------
function hpFillPct(cur, max){
  const c = Math.max(0, Math.floor(Number(cur) || 0));
  const m = Math.max(1, Math.floor(Number(max) || 1));
  return Math.max(0, Math.min(1, c / m));
}

function renderBattle(){
  const wrap = els?.battleWrap;
  if (!wrap) return;
  const b = state?.battle;
  const active = !!(b && b.active);

  if (!active){
    wrap.hidden = true;
    wrap.innerHTML = "";
    return;
  }

  wrap.hidden = false;

  const charId = b.playerCharId || getActiveCharId();
  const ch = getCharacter(charId);
  const playerName = ch.name;
  const playerHp = ch.hp ?? 0;
  const playerMax = ch.maxHp ?? 100;
  const playerLvl = ch.level ?? 1;
  const playerSprite = `./assets/ui/avatars/${ch.id}.png`;
  const enemy = b.enemy || { name: "Minion", level: 1, hp: 1, maxHp: 1 };

  const msg = (Array.isArray(b.msgLines) && b.msgLines.length)
    ? b.msgLines.join("\n")
    : (b.msg || "");

  // Build menu
  const menu = String(b.menu || "root");
  const makeBtn = ({ text, kind, key, disabled=false, sub=false }) => {
    const cls = sub ? "battleBtn" : "battleBtn";
    return `<button class="${cls}" data-kind="${kind}" data-key="${key}" ${disabled ? "disabled" : ""}>${text}</button>`;
  };


let menuHtml = "";
if (menu === "move"){
  const moveKeys = (getMovePoolForChar(charId) || []).filter(k => !!BRAWL_MOVES?.[k]);
  const movesBtns = moveKeys.map(k => {
    const mv = BRAWL_MOVES[k];
    return makeBtn({ text: mv?.name || k, kind: "move", key: k });
  }).join("");

  menuHtml = `
    <div class="battleSubMenu">
      ${movesBtns}
    </div>
    <div class="battleMenu" style="grid-template-columns:1fr">
      ${makeBtn({ text:"Back", kind:"menu", key:"root" })}
    </div>
  `;
} else if (menu === "item"){
  const have = Math.max(0, Math.floor(b.items?.synthfruit ?? 0));
  menuHtml = `
    <div class="battleSubMenu" style="grid-template-columns:1fr">
      ${makeBtn({ text:`Synthfruit (x${have})`, kind:"item", key:"synthfruit", disabled: have <= 0 })}
    </div>
    <div class="battleMenu" style="grid-template-columns:1fr">
      ${makeBtn({ text:"Back", kind:"menu", key:"root" })}
    </div>
  `;
} else if (menu === "tech"){
  const techBtns = Object.entries(BRAWL_TECH || {}).map(([k, meta]) =>
    makeBtn({ text: meta?.name || k, kind:"tech", key:k })
  ).join("");

  const gadgetBtns = (GADGET_KEYS || []).filter(gk => {
    const owned = Math.max(0, Math.floor(Number(state.player?.inventory?.[gk]) || 0));
    return owned > 0;
  }).map(gk => {
    const gs = getGadgetState(gk);
    const actionName = getGadgetBattleActionName(gk);
    const reqLvl = getGadgetBattleReqLevel(gk);
    const label = gs ? `${actionName} (${gs.charges}/${gs.maxCharges})` : actionName;

    const charId = getActiveCharId();
    const ch = getCharacter(charId);
    const tooLow = (ch?.level || 1) < reqLvl;
    const disabled = !gs || gs.charges <= 0 || tooLow;

    const btnText = tooLow ? `${label}  •  Lv ${reqLvl}` : label;
    return makeBtn({ text: btnText, kind:"gadget", key:gk, disabled });

  }).join("");

  menuHtml = `
    <div class="battleSubMenu">
      ${techBtns}
      ${gadgetBtns}
    </div>
    <div class="battleMenu" style="grid-template-columns:1fr">
      ${makeBtn({ text:"Back", kind:"menu", key:"root" })}
    </div>
  `;
} else {
  menuHtml = `
    <div class="battleMenu">
      ${makeBtn({ text:"Move", kind:"menu", key:"move" })}
      ${makeBtn({ text:"Item", kind:"menu", key:"item" })}
      ${makeBtn({ text:"Tech", kind:"menu", key:"tech" })}
      ${makeBtn({ text:"Run", kind:"run", key:"run" })}
    </div>
  `;
}

  wrap.innerHTML = `
    <div class="battleStage" role="img" aria-label="Battle scene">
      <div class="battleMon battleMon--enemy">
        <div class="battleNameRow">
          <div class="battleName">${enemy.name}</div>
          <div class="battleLvl">Lv ${enemy.level ?? 1}</div>
        </div>
        <div class="battleHp">
          <div class="battleHpBar"><div class="battleHpFill" style="width:${Math.round(hpFillPct(enemy.hp, enemy.maxHp)*100)}%"></div></div>
          <div class="battleHpText">${Math.max(0, enemy.hp|0)}/${Math.max(1, enemy.maxHp|0)}</div>
        </div>
        <div class="battleSprite"><img src="./assets/sprites/minion.svg" alt="" /></div>
      </div>

      <div class="battleMon battleMon--player">
        <div class="battleNameRow">
          <div class="battleName">${playerName}</div>
          <div class="battleLvl">Lv ${playerLvl}</div>
        </div>
        <div class="battleHp">
          <div class="battleHpBar"><div class="battleHpFill" style="width:${Math.round(hpFillPct(playerHp, playerMax)*100)}%"></div></div>
          <div class="battleHpText">${Math.max(0, playerHp|0)}/${Math.max(1, playerMax|0)}</div>
        </div>
        <div class="battleSprite battleSprite--player"><img src="${playerSprite}" alt="" /></div>
      </div>

      <div class="battleHud" aria-label="Battle controls">
        <div class="battleMsg" id="battleMsg">${msg}</div>
        <div class="battleMenus">${menuHtml}</div>
      </div>
    </div>
  `;

  // Wire buttons
  wrap.querySelectorAll("button[data-kind]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const kind = btn.getAttribute("data-kind");
      const key = btn.getAttribute("data-key");
      handlers?.onBattleAction?.(kind, key);
    });
  });

  // Tap stage to go back to root menu if you're in a submenu (mobile-friendly)
  const stage = wrap.querySelector(".battleStage");
  stage?.addEventListener("click", (e) => {
    if (!state?.battle?.active) return;
    const m = String(state.battle.menu || "root");
    if (m !== "root" && !e.target?.closest?.("button")){
      handlers?.onBattleAction?.("menu", "root");
    }
  });
}


// -----------------------------
// Loot Victory Modal
// -----------------------------
function getModalDeps(){
  return {
    els,
    state,
    handlers,
    thingByKey,
    applyTierClass,
    symbolFor,
    openInspector,
    scheduleCloseInspector,
    closeInspector,
    saveGame,
    renderAll,
  };
}

function renderLootModal(){
  return renderLootModalImpl(getModalDeps());
}

// -----------------------------
// Action Modal (Store confirmations)
// -----------------------------
function renderActionModal(){
  return renderActionModalImpl(getModalDeps());
}

function openActionModal(opts = {}){
  return openActionModalImpl(getModalDeps(), opts);
}

function closeActionModal(){
  return closeActionModalImpl(getModalDeps());
}

function getActionModalRefs(){
  return getActionModalRefsImpl(getModalDeps());
}

// -----------------------------
// Out-of-air (Faint) Modal
// -----------------------------
function renderFaintModal(){
  return renderFaintModalImpl(getModalDeps());
}

function getInventoryDeps(){
  return {
    els,
    state,
    handlers,
    setShown,
    thingByKey,
    applyTierClass,
    symbolFor,
    labelFor,
    sortKeyList,
    twAdd,
    openInspector,
    scheduleCloseInspector,
    COMBAT_STAT_KEYS,
    LEVEL_CAP,
    getActiveCharId,
    getCharacter,
    getCombatTrainingTarget,
    getCombatStatLevel,
    getAttributeLevel,
    getAttributeProgress
  };
}

function getStoreDeps(){
  return {
    els,
    state,
    handlers,
    thingByKey,
    labelFor,
    symbolFor,
    sortKeyList,
    applyTierClass,
    getA1StoreUpgradeStatus,
    distilleryStoredFor,
    escapeHtml,
    saveGame,
    renderAll,
    openInspector,
    openActionModal,
    closeActionModal,
    getActionModalRefs,
    syncSortChips
  };
}

function a1StoreOnEnter(){
  return a1StoreOnEnterImpl(getStoreDeps());
}

function a1StoreTalk(){
  return a1StoreTalkImpl(getStoreDeps());
}

function renderLeftPanels(){
  return renderLeftPanelsImpl(getInventoryDeps());
}

function renderInventoryPanels(){
  return renderInventoryPanelsImpl(getInventoryDeps());
}


function renderDistilleryPanels(){
  const distillerOpen = (state.ui.distillerOpen ?? true);
  if (els.distillerBody) setShown(els.distillerBody, distillerOpen, "block");
  if (els.distillerToggle) els.distillerToggle.setAttribute("aria-expanded", distillerOpen ? "true" : "false");

  const cabinetOpen = (state.ui.cabinetOpen ?? true);
  if (els.cabinetBody) setShown(els.cabinetBody, cabinetOpen, "block");
  if (els.cabinetToggle) els.cabinetToggle.setAttribute("aria-expanded", cabinetOpen ? "true" : "false");
}


const TIER_COLOR_TL = {
  1:"#eb0b00", // Singular
  2:"#ffcc00", // Unbounded
  3:"#ab00eb", // Distorted
  4:"#0095eb", // Hazardous
  5:"#2e7d32", // Reactive
  6:"#747474", // Stable
};

function closeInspector({ immediate = false } = {}){
  inspectorKey = null;
  inspectorAnchorEl = null;
  inspectorContext = "inventory";
  if (!els?.itemInspector) return;

  const panel = els.itemInspector;
  clearTimeout(inspectorAnimTimer);

  // If we're not open (or need an instant shutdown), hard-hide.
  const hardHide = () => {
    panel.classList.remove("open","closing");
    panel.classList.add("hidden");
    panel.setAttribute("aria-hidden","true");
    panel.style.display = "none";
    panel.style.visibility = "hidden";
    panel.style.pointerEvents = "none";
    // Clear any inline opacity a previous build may have applied
    panel.style.opacity = "";
  };

  if (immediate || !panel.classList.contains("open")){
    hardHide();
    return;
  }

  // Animate out, then re-apply Tailwind's hidden (display:none).
  panel.classList.remove("open");
  panel.classList.add("closing");
  panel.setAttribute("aria-hidden","true");
  panel.style.pointerEvents = "none";

  inspectorAnimTimer = setTimeout(() => {
    hardHide();
  }, 190);
}

function closeAttrInspector({ immediate = false } = {}){
  attrInspectorKey = null;
  attrInspectorAnchorEl = null;
  attrInspectorPinned = false;
  attrScrollY = 0;
  attrScrollMax = 0;
  if (!els?.attrInspector) return;

  const panel = els.attrInspector;
  clearTimeout(attrInspectorAnimTimer);

  const hardHide = () => {
    panel.classList.remove("open","closing");
    panel.classList.add("hidden");
    panel.setAttribute("aria-hidden","true");
    panel.style.display = "none";
    panel.style.visibility = "hidden";
    panel.style.pointerEvents = "none";
    panel.style.opacity = "";
  };

  if (immediate || !panel.classList.contains("open")){
    hardHide();
    return;
  }

  panel.classList.remove("open");
  panel.classList.add("closing");
  panel.setAttribute("aria-hidden","true");
  panel.style.pointerEvents = "none";

  attrInspectorAnimTimer = setTimeout(() => hardHide(), 190);
}

function updateAttrScrollBounds(){
  if (!els?.attrScroll || !els?.attrScrollInner) { attrScrollMax = 0; return; }
  // We translate inner up (negative Y) as the user scrolls down.
  const viewport = els.attrScroll.clientHeight;
  const content = els.attrScrollInner.scrollHeight;
  attrScrollMax = Math.max(0, content - viewport);
  attrScrollY = Math.max(0, Math.min(attrScrollY, attrScrollMax));
}

function applyAttrScroll(){
  if (!els?.attrScrollInner) return;
  els.attrScrollInner.style.transform = `translateY(${-Math.round(attrScrollY)}px)`;
}

function positionAttrInspector(){
  if (!els?.attrInspector) return;
  const panel = els.attrInspector;

  // If we have an anchor, behave like the item inspector. Otherwise keep it near top-right.
  const hasAnchor = !!attrInspectorAnchorEl;
  const rect = hasAnchor ? attrInspectorAnchorEl.getBoundingClientRect() : null;

  const pad = 10;
  const gap = 12;

  const wasHidden = panel.classList.contains("hidden");
  if (wasHidden){
    panel.classList.remove("hidden");
    panel.style.display = "block";
    panel.style.visibility = "hidden";
  }

  panel.style.left = "-9999px";
  panel.style.top  = "-9999px";
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left, top;

  if (hasAnchor){
    left = rect.right + gap;
    top  = rect.top;
    if (left + pw + pad > vw) left = rect.left - pw - gap;
  }else{
    left = vw - pw - pad;
    top  = pad;
  }

  left = Math.max(pad, Math.min(left, vw - pw - pad));
  top  = Math.max(pad, Math.min(top,  vh - ph - pad));

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top  = `${Math.round(top)}px`;
  panel.style.visibility = "visible";
}

function scheduleCloseInspector(){
  clearTimeout(hideInspectorTimer);
  hideInspectorTimer = setTimeout(() => closeInspector(), 120);
}

function renderAttrInspector(){
  if (!els?.attrInspector) return;
  if (!attrInspectorKey){
    closeAttrInspector();
    return;
  }

  const k = attrInspectorKey;
  const activeId = getActiveCharId();

  const combatLabels = { attack:"Attack", strength:"Strength", defence:"Defence", hp:"HP" };
  const title = combatLabels[k] || (k ? (String(k).charAt(0).toUpperCase() + String(k).slice(1)) : "");

  // Small UI-side replica of combat formulas (so we can show the player what their levels mean).
  function uiGearBonuses(charId){
    const ch = getCharacter(charId);
    const eq = ch?.equipment || {};
    let attackBonus = 0;
    let strengthBonus = 0;
    let defenceBonus = 0;

    for (const itemKey of Object.values(eq)){
      if (!itemKey) continue;
      const t = thingByKey?.[itemKey];
      const eff = t?.effect || {};
      if (typeof eff.accuracy === "number") attackBonus += Math.round(eff.accuracy * 8);
      if (typeof eff.defense === "number") defenceBonus += Math.round(eff.defense * 8);
      if (typeof eff.strength === "number") strengthBonus += Math.round(eff.strength * 8);
      if (typeof eff.speed === "number") attackBonus += Math.round(eff.speed * 4);
    }
    return { attackBonus, strengthBonus, defenceBonus };
  }

  function uiMaxHit(strLevel, strBonus){
    const s = Math.max(1, Math.floor(Number(strLevel) || 1));
    const b = Math.max(0, Math.floor(Number(strBonus) || 0));
    return Math.max(1, Math.floor(0.5 + (s * (b + 64)) / 640));
  }

  function uiHitChance(aRoll, dRoll){
    const a = Math.max(0, Math.floor(Number(aRoll) || 0));
    const d = Math.max(0, Math.floor(Number(dRoll) || 0));
    if (a > d) return 1 - (d + 2) / (2 * (a + 1));
    return a / (2 * (d + 1));
  }

  const trainTarget = getCombatTrainingTarget();

  if (els.attrTitle) els.attrTitle.textContent = title;

  if (COMBAT_STAT_KEYS.includes(k)){
    const lvl = getCombatStatLevel(activeId, k);
    const prog = getCombatStatProgress(activeId, k);
    const isTrainable = (k === "attack" || k === "strength" || k === "defence");
    const isActive = isTrainable && trainTarget === k;
    const gb = uiGearBonuses(activeId);

    const pct = Math.max(0, Math.min(100, Math.round((prog?.pct || 0) * 100)));
    if (els.attrMeta) els.attrMeta.innerHTML = `
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
        <div><span class="label">Level ${lvl}</span> / ${LEVEL_CAP}</div>
        <div class="muted small">${prog?.cur ?? 0}/${prog?.need ?? 0} XP</div>
      </div>
      <div class="attrBar attrBar--insp"><div class="attrFill" style="width:${pct}%"></div></div>
    `;

    let desc = "";
    let summaryLines = [];

    if (k === "attack"){
      desc = "Improves your chance to land hits. Higher Attack makes your damage more consistent by turning misses into hits.";
      const atkRoll = lvl * (gb.attackBonus + 64);
      // Show a neutral example: vs equal Defence and zero bonuses.
      const exampleDef = Math.max(1, lvl);
      const exampleDefRoll = exampleDef * (64);
      const ex = uiHitChance(atkRoll, exampleDefRoll);
      summaryLines.push(`<div><span class="label">Attack roll:</span> ${atkRoll}</div>`);
      summaryLines.push(`<div><span class="label">Example hit chance (vs equal Defence, no enemy bonuses):</span> ${(ex*100).toFixed(1)}%</div>`);
      if (gb.attackBonus) summaryLines.push(`<div class="muted small">Gear accuracy bonus: +${gb.attackBonus}</div>`);
    } else if (k === "strength"){
      desc = "Increases your maximum possible damage per hit.";
      const base = uiMaxHit(lvl, gb.strengthBonus);
      // Strike uses flat +1 in the current move set.
      summaryLines.push(`<div><span class="label">Base max hit:</span> ${base}</div>`);
      summaryLines.push(`<div><span class="label">Max hit with Strike:</span> ${base + 1}</div>`);
      if (gb.strengthBonus) summaryLines.push(`<div class="muted small">Gear strength bonus: +${gb.strengthBonus}</div>`);
    } else if (k === "defence"){
      desc = "Reduces how often enemies land hits on you (by improving your defence roll).";
      const defRoll = lvl * (gb.defenceBonus + 64);
      summaryLines.push(`<div><span class="label">Defence roll:</span> ${defRoll}</div>`);
      if (gb.defenceBonus) summaryLines.push(`<div class="muted small">Gear defence bonus: +${gb.defenceBonus}</div>`);
    } else if (k === "hp"){
      desc = "Increases your maximum HP. Each HP level adds +1 max HP.";
      const maxHp = lvl;
      summaryLines.push(`<div><span class="label">Max HP:</span> ${maxHp}</div>`);
    }

    if (els.attrDesc) els.attrDesc.textContent = desc;

    const trainBtn = isTrainable
      ? `<div style="margin-top:8px"><button class="trainPickBtn${isActive ? " active" : ""}" data-train="${k}">${isActive ? "Training Target" : "Set Training Target"}<span class="trainStarIcon" aria-hidden="true"></span></button></div>`
      : "";

    if (els.attrSummary) els.attrSummary.innerHTML =
      `<div class="muted small">Current effect:</div>` +
      `<div class="attrSummaryBlock">${summaryLines.join("")}${trainBtn}</div>`;

    if (els.attrPath) els.attrPath.textContent = "";
  } else {
    const lvl = getAttributeLevel(k);
    const prog = getAttributeProgress(k);
    const pct = Math.max(0, Math.min(100, Math.round((prog?.pct || 0) * 100)));
    if (els.attrMeta) els.attrMeta.innerHTML = `
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
        <div><span class="label">Level ${lvl}</span> / ${LEVEL_CAP}</div>
        <div class="muted small">${prog?.cur ?? 0}/${prog?.need ?? 0} XP</div>
      </div>
      <div class="attrBar attrBar--insp"><div class="attrFill" style="width:${pct}%"></div></div>
    `;

    const descMap = {
      distillery: "Improves your distilling capability (future hooks). Earn XP by salvaging scraps into elements.",
    };
    if (els.attrDesc) els.attrDesc.textContent = descMap[k] || "";
    if (els.attrSummary) els.attrSummary.innerHTML = `<div class="muted small">Perks:</div><div class="muted small">(Coming soon)</div>`;
    if (els.attrPath) els.attrPath.textContent = "";
  }

  // Recompute bounds after content updates.
  updateAttrScrollBounds();
  applyAttrScroll();

  els.attrInspector.classList.add("open");
  els.attrInspector.classList.remove("hidden");
  els.attrInspector.setAttribute("aria-hidden","false");
}


// -----------------------------
// Attribute details (right column page)
// -----------------------------

function openAttributePage(key){
  if (!key) return;
  // Remember where the user was, so Back returns them there.
  if (state?.ui?.activePage !== "attribute"){
    state.ui.prevPageBeforeAttribute = state?.ui?.activePage || "story";
  }
  state.ui.attrPageKey = key;
  // Close the floating inspector if it was open (we're replacing it).
  closeAttrInspector();
  state.ui.activePage = "attribute";
  if (isMobileLayout()){
    if (!state.ui) state.ui = {};
    state.ui.mobilePane = "game";
  }
  renderAll();
}

function closeAttributePage(){
  const prev = state?.ui?.prevPageBeforeAttribute || "story";
  state.ui.activePage = prev;
  renderAll();
}

function renderAttributePage(){
  if (!els?.pageAttribute) return;

  const k = state?.ui?.attrPageKey;

  // Empty state
  if (!k){
    if (els.attrPageHint) els.attrPageHint.textContent = "Click an attribute on the left to view details.";
    if (els.attrPageTitle) els.attrPageTitle.textContent = "—";
    if (els.attrPageSub) els.attrPageSub.textContent = "Details";
    if (els.attrPageMeta) els.attrPageMeta.innerHTML = "";
    if (els.attrPageDesc) els.attrPageDesc.textContent = "";
    if (els.attrPageSummary) els.attrPageSummary.innerHTML = "";
    if (els.attrPagePath) els.attrPagePath.textContent = "";
    if (els.attrPageIcon){ els.attrPageIcon.removeAttribute('src'); els.attrPageIcon.alt = ''; }
    return;
  }

  if (els.attrPageHint) els.attrPageHint.textContent = "";

  const activeId = getActiveCharId();

  const combatLabels = { attack:"Attack", strength:"Strength", defence:"Defence", hp:"HP" };
  const title = combatLabels[k] || (k ? (String(k).charAt(0).toUpperCase() + String(k).slice(1)) : "");
  if (els.attrPageTitle) els.attrPageTitle.textContent = title;

  // Icon (inline SVG data-uri)
if (els.attrPageIcon){
  const svgMap = {
    hp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="currentColor" stop-opacity="0.95"/>
        <stop offset="1" stop-color="currentColor" stop-opacity="0.35"/>
      </linearGradient></defs>
      <path d="M32 54C20 45 10 36 10 25c0-7 5-13 12-13 5 0 8 2 10 6 2-4 5-6 10-6 7 0 12 6 12 13 0 11-10 20-22 29z"
        fill="url(#g)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    </svg>`,
    attack: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="currentColor" stop-opacity="0.95"/>
        <stop offset="1" stop-color="currentColor" stop-opacity="0.30"/>
      </linearGradient></defs>
      <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="3"/>
      <circle cx="32" cy="32" r="6" fill="url(#g)" stroke="currentColor" stroke-width="3"/>
      <path d="M32 8v10M32 46v10M8 32h10M46 32h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    strength: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="currentColor" stop-opacity="0.95"/>
        <stop offset="1" stop-color="currentColor" stop-opacity="0.28"/>
      </linearGradient></defs>
      <!-- Dumbbell -->
      <rect x="10" y="25" width="6" height="14" rx="2" fill="url(#g)" stroke="currentColor" stroke-width="3"/>
      <rect x="16" y="21" width="6" height="22" rx="2" fill="url(#g)" stroke="currentColor" stroke-width="3"/>
      <rect x="42" y="21" width="6" height="22" rx="2" fill="url(#g)" stroke="currentColor" stroke-width="3"/>
      <rect x="48" y="25" width="6" height="14" rx="2" fill="url(#g)" stroke="currentColor" stroke-width="3"/>
      <rect x="22" y="30" width="20" height="4" rx="2" fill="url(#g)" stroke="currentColor" stroke-width="3"/>
    </svg>`,
    defence: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="currentColor" stop-opacity="0.95"/>
        <stop offset="1" stop-color="currentColor" stop-opacity="0.30"/>
      </linearGradient></defs>
      <path d="M32 8l18 8v18c0 14-10 23-18 27-8-4-18-13-18-27V16l18-8z"
        fill="url(#g)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
      <path d="M32 18v32" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    </svg>`,
    distillery: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="currentColor" stop-opacity="0.95"/>
        <stop offset="1" stop-color="currentColor" stop-opacity="0.28"/>
      </linearGradient></defs>
      <path d="M24 8h16v8l-2 2v10l12 18c3 5-1 12-7 12H21c-6 0-10-7-7-12l12-18V18l-2-2V8z"
        fill="url(#g)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
      <path d="M22 42h20" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.65"/>
    </svg>`,
  };

  const raw = svgMap[k] || svgMap.distillery;
  // currentColor inside data-uri falls back to black, which is fine for the page header.
  const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(raw.trim());
  els.attrPageIcon.src = src;
  els.attrPageIcon.alt = `${title} icon`;
}

  // Small UI-side replica of combat formulas (so we can show the player what their levels mean).
  function uiGearBonuses(charId){
    const ch = getCharacter(charId);
    const eq = ch?.equipment || {};
    let attackBonus = 0;
    let strengthBonus = 0;
    let defenceBonus = 0;

    for (const itemKey of Object.values(eq)){
      if (!itemKey) continue;
      const t = thingByKey?.[itemKey];
      const eff = t?.effect || {};
      if (typeof eff.accuracy === "number") attackBonus += Math.round(eff.accuracy * 8);
      if (typeof eff.defense === "number") defenceBonus += Math.round(eff.defense * 8);
      if (typeof eff.strength === "number") strengthBonus += Math.round(eff.strength * 8);
      if (typeof eff.speed === "number") attackBonus += Math.round(eff.speed * 4);
    }
    return { attackBonus, strengthBonus, defenceBonus };
  }

  function uiMaxHit(strLevel, strBonus){
    const s = Math.max(1, Math.floor(Number(strLevel) || 1));
    const b = Math.max(0, Math.floor(Number(strBonus) || 0));
    return Math.max(1, Math.floor(0.5 + (s * (b + 64)) / 640));
  }

  function uiHitChance(aRoll, dRoll){
    const a = Math.max(0, Math.floor(Number(aRoll) || 0));
    const d = Math.max(0, Math.floor(Number(dRoll) || 0));
    if (a > d) return 1 - (d + 2) / (2 * (a + 1));
    return a / (2 * (d + 1));
  }

  const trainTarget = getCombatTrainingTarget();

  if (COMBAT_STAT_KEYS.includes(k)){
    if (els.attrPageSub) els.attrPageSub.textContent = "Combat stat";

    const lvl = getCombatStatLevel(activeId, k);
    const prog = getCombatStatProgress(activeId, k);
    const isTrainable = (k === "attack" || k === "strength" || k === "defence");
    const isActive = isTrainable && trainTarget === k;
    const gb = uiGearBonuses(activeId);

    const pct = Math.max(0, Math.min(100, Math.round((prog?.pct || 0) * 100)));
    if (els.attrPageMeta) els.attrPageMeta.innerHTML = `
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
        <div><span class="label">Level ${lvl}</span> / ${LEVEL_CAP}</div>
        <div class="muted small">${prog?.cur ?? 0}/${prog?.need ?? 0} XP</div>
      </div>
      <div class="attrBar attrBar--insp"><div class="attrFill" style="width:${pct}%"></div></div>
    `;

    let desc = "";
    const summaryLines = [];

    if (k === "attack"){
      desc = "Improves your chance to land hits. Higher Attack makes your damage more consistent by turning misses into hits.";
      const atkRoll = lvl * (gb.attackBonus + 64);
      const exampleDef = Math.max(1, lvl);
      const exampleDefRoll = exampleDef * (64);
      const ex = uiHitChance(atkRoll, exampleDefRoll);
      summaryLines.push(`<div><span class="label">Attack roll:</span> ${atkRoll}</div>`);
      summaryLines.push(`<div><span class="label">Example hit chance (vs equal Defence, no enemy bonuses):</span> ${(ex*100).toFixed(1)}%</div>`);
      if (gb.attackBonus) summaryLines.push(`<div class="muted small">Gear accuracy bonus: +${gb.attackBonus}</div>`);
    } else if (k === "strength"){
      desc = "Increases your maximum possible damage per hit.";
      const base = uiMaxHit(lvl, gb.strengthBonus);
      summaryLines.push(`<div><span class="label">Base max hit:</span> ${base}</div>`);
      summaryLines.push(`<div><span class="label">Max hit with Strike:</span> ${base + 1}</div>`);
      if (gb.strengthBonus) summaryLines.push(`<div class="muted small">Gear strength bonus: +${gb.strengthBonus}</div>`);
    } else if (k === "defence"){
      desc = "Reduces how often enemies land hits on you (by improving your defence roll).";
      const defRoll = lvl * (gb.defenceBonus + 64);
      summaryLines.push(`<div><span class="label">Defence roll:</span> ${defRoll}</div>`);
      if (gb.defenceBonus) summaryLines.push(`<div class="muted small">Gear defence bonus: +${gb.defenceBonus}</div>`);
    } else if (k === "hp"){
      desc = "Increases your maximum HP. Each HP level adds +1 max HP.";
      summaryLines.push(`<div><span class="label">Max HP:</span> ${lvl}</div>`);
    }

    if (els.attrPageDesc) els.attrPageDesc.textContent = desc;

    const trainBtn = isTrainable
      ? `<div style="margin-top:8px"><button class="trainPickBtn${isActive ? " active" : ""}" data-train="${k}">${isActive ? "Training Target" : "Set Training Target"}<span class="trainStarIcon" aria-hidden="true"></span></button></div>`
      : "";

    if (els.attrPageSummary) els.attrPageSummary.innerHTML =
      `<div class="muted small">Current effect:</div>` +
      `<div class="attrSummaryBlock">${summaryLines.join("")}${trainBtn}</div>`;

    if (els.attrPagePath) els.attrPagePath.textContent = "";
  } else {
    if (els.attrPageSub) els.attrPageSub.textContent = "Skill";

    const lvl = getAttributeLevel(k);
    const prog = getAttributeProgress(k);
    const pct = Math.max(0, Math.min(100, Math.round((prog?.pct || 0) * 100)));
    if (els.attrPageMeta) els.attrPageMeta.innerHTML = `
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
        <div><span class="label">Level ${lvl}</span> / ${LEVEL_CAP}</div>
        <div class="muted small">${prog?.cur ?? 0}/${prog?.need ?? 0} XP</div>
      </div>
      <div class="attrBar attrBar--insp"><div class="attrFill" style="width:${pct}%"></div></div>
    `;

    const descMap = {
      distillery: "Improves your distilling capability (future hooks). Earn XP by salvaging scraps into elements.",
    };

    if (els.attrPageDesc) els.attrPageDesc.textContent = descMap[k] || "";
    if (els.attrPageSummary) els.attrPageSummary.innerHTML = `<div class="muted small">Perks:</div><div class="muted small">(Coming soon)</div>`;
    if (els.attrPagePath) els.attrPagePath.textContent = "";
  }
}

function positionInspector(){
  if (!els?.itemInspector || !inspectorAnchorEl) return;
  const panel = els.itemInspector;
  const rect = inspectorAnchorEl.getBoundingClientRect();

  const pad = 10;
  const gap = 12;

  const wasHidden = panel.classList.contains("hidden");
  if (wasHidden){
    panel.classList.remove("hidden");
    panel.style.display = "block";
    panel.style.visibility = "hidden";
  }

  // Measure at an offscreen position first.
  panel.style.left = "-9999px";
  panel.style.top  = "-9999px";
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Default: right of the icon.
  let left = rect.right + gap;
  let top  = rect.top;

  // Flip to left if overflowing.
  if (left + pw + pad > vw) left = rect.left - pw - gap;

  // Clamp to viewport.
  left = Math.max(pad, Math.min(left, vw - pw - pad));
  top  = Math.max(pad, Math.min(top,  vh - ph - pad));

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top  = `${Math.round(top)}px`;
  panel.style.visibility = "visible";
}

function openInspector(key, anchorEl, context = "inventory"){
  // Toggle behavior: clicking the same icon again closes the inspector.
  // This complements click-outside-to-dismiss.
  try{
    const isOpen = !!els?.itemInspector && els.itemInspector.classList.contains("open");
    const sameKey = (inspectorKey === key);
    const sameCtx = (inspectorContext === context);
    const sameAnchor = (!inspectorAnchorEl || !anchorEl) ? (inspectorAnchorEl === anchorEl)
      : (inspectorAnchorEl === anchorEl || inspectorAnchorEl.contains(anchorEl) || anchorEl.contains(inspectorAnchorEl));
    if (isOpen && sameKey && sameCtx && sameAnchor){
      closeInspector();
      return;
    }
  }catch(_){/* ignore */}

  inspectorKey = key;
  inspectorAnchorEl = anchorEl;
  inspectorContext = context;

  clearTimeout(hideInspectorTimer);
  clearTimeout(inspectorAnimTimer);

  if (!els?.itemInspector) return;
  const panel = els.itemInspector;

  const wasOpen = panel.classList.contains("open");

  // Make visible (Tailwind uses .hidden => display:none)
  panel.classList.remove("hidden","closing");
  panel.style.display = "block";
  panel.style.visibility = "visible";
  panel.style.pointerEvents = "auto";
  panel.setAttribute("aria-hidden","false");
  panel.style.opacity = ""; // let CSS drive opacity

  renderInspector();
  positionInspector();

  // Only animate on first open; switching items while open feels snappier without re-pop.
  if (!wasOpen){
    panel.classList.remove("open");
    requestAnimationFrame(() => panel.classList.add("open"));
  }else{
    panel.classList.add("open");
  }
}

function renderInspector(){
  if (!els?.itemInspector) return;
  if (!inspectorKey){
    closeInspector();
    return;
  }

  const key = inspectorKey;
  const t = thingByKey[key] || {};
  const tier = Number(t.tier) || null;
  const locked = !!state.player?.locks?.[key];

  // Theme the entire inspector window by tier.
  // This keeps it readable while making the popup feel like part of the item's rarity.
  {
    const panel = els.itemInspector;
    panel.classList.remove("tier-1","tier-2","tier-3","tier-4","tier-5","tier-6");
    if (tier) panel.classList.add(`tier-${tier}`);
  }

  const ctx = inspectorContext;
  const isCraft = typeof ctx === "string" && ctx.startsWith("craft:");
  const craftBpKey = isCraft ? ctx.split(":")[1] : null;
  const craftBp = (isCraft && craftBpKey) ? blueprintCatalog.find(b => b?.key === craftBpKey) : null;

  // Tier badge
  if (els.inspectTierBadge){
    if (tier){
      els.inspectTierBadge.style.display = "inline-flex";
      els.inspectTierBadge.textContent = tierLabel(tier);
      els.inspectTierBadge.classList.remove("tier-1","tier-2","tier-3","tier-4","tier-5","tier-6");
      els.inspectTierBadge.classList.add(`tier-${tier}`);
    } else {
      els.inspectTierBadge.style.display = "none";
      els.inspectTierBadge.textContent = "";
      els.inspectTierBadge.classList.remove("tier-1","tier-2","tier-3","tier-4","tier-5","tier-6");
    }
  }

  // Title
  if (els.inspectTitle) els.inspectTitle.textContent = labelFor(key);

  // Icon (top-right)
  if (els.inspectIcon) els.inspectIcon.innerHTML = symbolFor(key);

  // Meta (kind)
  const kind = t.kind || (thingByKey[key]?.symbol ? "Element" : "");
  const metaBits = [];
  if (kind) metaBits.push(kind);
  if (isCraft) metaBits.push("Blueprint");
  if (els.inspectMeta) els.inspectMeta.textContent = metaBits.join(" • ");

  // Description
  // Craft pages prefer blueprint text (so the popup explains the recipe, not just the item).
  let desc = (isCraft && craftBp?.description) ? craftBp.description : t.description;
  if (!desc){
    // Generic descriptions for elements/materials
    if (t.symbol && !t.kind){
      desc = `A ${tier ? tierLabel(tier) : "?"} element used in refining and crafting.`;
    } else {
      desc = "No description yet.";
    }
  }
  if (els.inspectDesc) els.inspectDesc.textContent = desc;


// Found / Components (hierarchy: label on top, details underneath)
if (els.inspectFound){
  const setKV = (label, value, opts = {}) => {
    const isHTML = !!opts.html;
    const sub = opts.sub ? `<div class="inspSub">${escapeHtml(opts.sub)}</div>` : "";
    const safeV = isHTML ? String(value || "") : escapeHtml(value || "");
    els.inspectFound.innerHTML = `<div class="inspLabel">${escapeHtml(label)}</div><div class="inspValue">${safeV}${sub}</div>`;
  };

  if (isCraft && craftBp){
    const reqText = Object.entries(craftBp.requires || {})
      .map(([k,v]) => `${labelFor(k)} ×${v}`)
      .join(", ");
    const toolText = craftBp.requiresTool ? `Tool: ${labelFor(craftBp.requiresTool)}` : "";
    const timeText = craftBp.durationMs ? `Time: ${formatTimeMs(craftBp.durationMs)}` : "";
    const subBits = [toolText, timeText].filter(Boolean).join(" • ");
    setKV("Requires", reqText || "—", { sub: subBits || "" });
  } else if (ctx === "cabinet"){
    const cost = distilleryUpgradeCostFor(key);
    const costText = cost ? Object.entries(cost).map(([k,v]) => `${v} ${labelFor(k)}`).join(", ") : "—";
    setKV("Upgrade", costText);
  } else if (ctx === "distiller"){
    const y = t.distillYield;
    const max = maxDistillableForScrap(key);
    if (y && typeof y === "object"){
      const prod = Object.entries(y)
        .map(([k,v]) => `${labelFor(k)} ×${Math.max(0, Math.floor(Number(v) || 0))}`)
        .join(" • ");
      const hint = max <= 0 ? "Blocked: a required container is full." : "";
      const sub = `Max distillable now: ${max}.${hint ? " " + hint : ""}`.trim();
      setKV("Produces", prod || "—", { sub });
    } else {
      setKV("Produces", "—");
    }
  } else {
    // If this is a refined output, show its recipe components instead of Found.
    const refine = refineRecipes.find(r => r?.key === key || (r?.produces && Object.prototype.hasOwnProperty.call(r.produces, key)));
    if (refine?.requires && Object.keys(refine.requires).length){
      const comps = Object.entries(refine.requires)
        .map(([ck, qty]) => {
          const ct = thingByKey[ck] || {};
          const ctier = Number(ct.tier) || null;
          const color = (ctier && ctier !== 6) ? TIER_COLOR_TL[ctier] : null;
          const sym = symbolFor(ck);
          const name = labelFor(ck);
          const txt = `${sym} ${name} ×${qty}`;
          return color
            ? `<span class="comp" style="color:${color};font-weight:800">${escapeHtml(txt)}</span>`
            : `<span class="comp">${escapeHtml(txt)}</span>`;
        })
        .join(" · ");
      setKV("Components", comps || "—", { html: true });
    } else {
      let found = t.found;
      if (!found){
        if (t.symbol && tier){
          found = `Scavenged from discarded objects.`;
        } else {
          found = "Found in the world.";
        }
      }
      setKV("Found", found);
    }
  }
}

  // Lock / Delete visibility
  // - Store buy: hide (no locks/deletes on shop items)
  // - Craft: hide (craft is blueprint-driven; locking the item doesn't make sense here)
  const showIcons = (ctx !== "store-buy" && !isCraft && ctx !== "cabinet" && ctx !== "distiller");

  if (els.inspectLockBtn){
    els.inspectLockBtn.style.display = showIcons ? "grid" : "none";
    els.inspectLockBtn.textContent = locked ? "🔒" : "🔓";
    els.inspectLockBtn.classList.toggle("unlocked", !locked);
    els.inspectLockBtn.title = locked ? "Locked (click to unlock)" : "Unlocked (click to lock)";
  }

  if (els.inspectDeleteBtn){
    els.inspectDeleteBtn.style.display = showIcons ? "grid" : "none";
    els.inspectDeleteBtn.disabled = locked;
    els.inspectDeleteBtn.title = locked ? "Locked items cannot be deleted." : "Delete item";
    els.inspectDeleteBtn.style.opacity = locked ? ".35" : "1";
  }

  // Primary + Multiple actions (context-sensitive)
  const canEquip = (t.kind === "Gear" && !!t.slot);
  const canBelt = (t.kind === "Tool");
  const isEquipped = !!equippedSlotFor(key);
  const isBelted = !!toolbeltSlotFor(key);
  const invCount = Math.max(0, Math.floor(Number(state.player?.inventory?.[key]) || 0));
  const buyPrice = Math.max(0, Math.floor(Number(t?.buyPrice) || 0));
  const sellPrice = Math.max(0, Math.floor(Number(t?.sellPrice) || 0));

  if (els.inspectPrimaryBtn){
    // Reset
    els.inspectPrimaryBtn.classList.remove("dangerBtn");
    els.inspectPrimaryBtn.disabled = false;
    els.inspectPrimaryBtn.title = "";

    if (isCraft && craftBp){
      els.inspectPrimaryBtn.style.display = "inline-flex";

      const job = getCraftJob(craftBp.key);
      const alreadyBuilt = (craftBp.itemKey === "backpack_mk1" && state.player.upgrades?.backpack_mk1);
      const toolOk = (!craftBp.requiresTool || hasTool(craftBp.requiresTool));
      const matsOk = hasResources(craftBp.requires, { useCabinetForElements: true });
      const canStart = (!alreadyBuilt && toolOk && matsOk && !job);

      if (alreadyBuilt){
        els.inspectPrimaryBtn.textContent = "Built";
        els.inspectPrimaryBtn.disabled = true;
        els.inspectPrimaryBtn.title = "This upgrade has already been crafted.";
      } else if (job){
        const remaining = Math.max(0, Math.floor((Number(job.endAt) || 0) - Date.now()));
        if (remaining <= 0){
          els.inspectPrimaryBtn.textContent = "Collect";
          els.inspectPrimaryBtn.disabled = false;
          els.inspectPrimaryBtn.title = "Collect your finished craft.";
        } else {
          els.inspectPrimaryBtn.textContent = "Crafting…";
          els.inspectPrimaryBtn.disabled = true;
          els.inspectPrimaryBtn.title = `Finishes in ${formatTimeMs(remaining)}.`;
        }
      } else {
        els.inspectPrimaryBtn.textContent = "Start Craft";
        els.inspectPrimaryBtn.disabled = !canStart;
        if (!toolOk) els.inspectPrimaryBtn.title = `Requires ${labelFor(craftBp.requiresTool)}.`;
        else if (!matsOk) els.inspectPrimaryBtn.title = "Missing required materials.";
        else els.inspectPrimaryBtn.title = "Begin crafting.";
      }
    } else if (ctx === "cabinet"){
      const cap = distilleryCapFor(key);
      const stored = distilleryStoredFor(key);
      const have = invCount;
      const space = Math.max(0, cap - stored);
      const can = Math.min(have, space);
      els.inspectPrimaryBtn.style.display = "inline-flex";
      els.inspectPrimaryBtn.textContent = "Store All";
      els.inspectPrimaryBtn.disabled = (can <= 0);
      els.inspectPrimaryBtn.title = (have <= 0)
        ? "No copies in your backpack."
        : (space <= 0 ? "This container is full." : `Store up to ${can}.`);
    } else if (ctx === "distiller"){
      const max = maxDistillableForScrap(key);
      els.inspectPrimaryBtn.style.display = "inline-flex";
      els.inspectPrimaryBtn.textContent = "Distill";
      els.inspectPrimaryBtn.disabled = (max <= 0);
      els.inspectPrimaryBtn.title = (max <= 0) ? "Blocked: a required Cabinet container is full (or you have none)." : "Distill 1 scrap.";
    } else if (ctx === "store-buy"){
  const credits = Math.max(0, Math.floor(Number(state.player?.credits) || 0));
  const isGear = (t.kind === "Gear");
  const owned = isGear ? (invCount > 0 || !!equippedSlotFor(key)) : false;
  const forSale = (buyPrice > 0);
  const affordable = forSale ? Math.max(0, Math.floor(credits / buyPrice)) : 0;

  els.inspectPrimaryBtn.style.display = "inline-flex";

  if (!forSale){
    els.inspectPrimaryBtn.textContent = "Not for sale";
    els.inspectPrimaryBtn.disabled = true;
    els.inspectPrimaryBtn.title = "Not for sale.";
  } else if (owned){
    els.inspectPrimaryBtn.textContent = "Owned";
    els.inspectPrimaryBtn.disabled = true;
    els.inspectPrimaryBtn.title = "You can only own one of each gear.";
  } else if (affordable < 1){
    els.inspectPrimaryBtn.textContent = "Buy";
    els.inspectPrimaryBtn.disabled = true;
    els.inspectPrimaryBtn.title = `Not enough MU (${buyPrice} MU).`;
  } else {
    els.inspectPrimaryBtn.textContent = "Buy";
    els.inspectPrimaryBtn.disabled = false;
    els.inspectPrimaryBtn.title = `Buy for ${buyPrice} MU`;
  }
} else if (ctx === "store-sell"){
      els.inspectPrimaryBtn.style.display = "inline-flex";
      els.inspectPrimaryBtn.textContent = "Sell";
      els.inspectPrimaryBtn.title = locked ? "Locked items cannot be sold." : `Sell for ${sellPrice} MU`;
      if (locked || invCount <= 0) els.inspectPrimaryBtn.disabled = true;
    } else {
      // inventory
      els.inspectPrimaryBtn.style.display = (canEquip || canBelt) ? "inline-flex" : "none";
      els.inspectPrimaryBtn.textContent = canBelt
        ? (isBelted ? "Unbelt" : "Belt")
        : (isEquipped ? "Unequip" : "Equip");

      // Disable Belt if the player doesn't currently have a copy in the backpack.
      // (Unbelt stays enabled; it may still fail if the backpack is full, which is handled by the action.)
      if (canBelt && !isBelted && invCount <= 0){
        els.inspectPrimaryBtn.disabled = true;
        els.inspectPrimaryBtn.title = "You don't have this tool in your backpack.";
      } else {
        els.inspectPrimaryBtn.disabled = false;
        els.inspectPrimaryBtn.title = canBelt
          ? (isBelted ? "Move back to backpack" : "Move to toolbelt")
          : (isEquipped ? "Move back to backpack" : "Equip to its slot");
      }
    }
  }

  if (els.inspectMultiBtn){
    if (isCraft){
      els.inspectMultiBtn.style.display = "none";
      els.inspectMultiBtn.disabled = false;
    } else if (ctx === "cabinet"){
      const cost = distilleryUpgradeCostFor(key);
      const ok = cost
        ? Object.entries(cost).every(([k,v]) => distilleryStoredFor(k) >= (Math.max(0, Math.floor(Number(v) || 0))))
        : false;

      els.inspectMultiBtn.style.display = "inline-flex";
      els.inspectMultiBtn.textContent = "Upgrade";
      els.inspectMultiBtn.disabled = !ok;

      const gain = distilleryNextUpgradeGainFor(key);
      const gainText = gain ? `+${gain} cap` : "Increase cap";

      if (!cost){
        els.inspectMultiBtn.title = "No upgrade path.";
      } else if (ok){
        els.inspectMultiBtn.title = `Upgrade container (${gainText}). Cost (from cabinet): ${Object.entries(cost).map(([k,v]) => `${labelFor(k)} ×${v}`).join(", ")}`;
      } else {
        els.inspectMultiBtn.title = `Not enough stored materials. Need: ${Object.entries(cost).map(([k,v]) => `${labelFor(k)} ×${v}`).join(", ")}`;
      }
    } else if (ctx === "distiller"){
      const max = maxDistillableForScrap(key);
      els.inspectMultiBtn.style.display = "inline-flex";
      els.inspectMultiBtn.textContent = "Distill All";
      els.inspectMultiBtn.disabled = (max <= 1);
      els.inspectMultiBtn.title = (max <= 1)
        ? "Nothing extra to distill."
        : `Distill up to ${max} (limited by Cabinet space).`;
    } else if (ctx === "store-buy"){
  const credits = Math.max(0, Math.floor(Number(state.player?.credits) || 0));
  const isGear = (t.kind === "Gear");
  const forSale = (buyPrice > 0);
  const affordable = forSale ? Math.max(0, Math.floor(credits / buyPrice)) : 0;

  if (isGear || !forSale){
    els.inspectMultiBtn.style.display = "none";
    els.inspectMultiBtn.disabled = false;
  } else {
    els.inspectMultiBtn.style.display = "inline-flex";
    els.inspectMultiBtn.textContent = "Buy Multiple";
    els.inspectMultiBtn.disabled = (affordable < 1);
    els.inspectMultiBtn.title = (affordable < 1) ? "Not enough MU." : "Choose how many to buy";
  }
} else if (ctx === "store-sell"){
      els.inspectMultiBtn.style.display = "inline-flex";
      els.inspectMultiBtn.textContent = "Sell Multiple";
      els.inspectMultiBtn.title = locked ? "Locked items cannot be sold." : "Choose how many to sell";
      els.inspectMultiBtn.disabled = locked || invCount <= 0;
    } else {
      els.inspectMultiBtn.style.display = "none";
      els.inspectMultiBtn.disabled = false;
    }
  }

// Gadget actions (Gadgets only)
if (els.inspectGadgetActions){
  const isGadget = !!t.isGadget;
  const show = isGadget;
  els.inspectGadgetActions.hidden = !show;
  if (show){
    const gs = getGadgetState(key);
    const canCharge = !!gs && gs.owned > 0 && gs.charges < gs.maxCharges;
    const canUpgrade = !!gs && gs.owned >= 2 && gs.rank < (gs.maxRank ?? 3);

    if (els.inspectChargeBtn){
      els.inspectChargeBtn.disabled = !canCharge;
      els.inspectChargeBtn.textContent = "Charge";
      els.inspectChargeBtn.title = !gs ? "" : (gs.charges >= gs.maxCharges ? "Fully charged" : `Add 1 charge (${gs.charges}/${gs.maxCharges})`);
    }
    if (els.inspectUpgradeBtn){
      els.inspectUpgradeBtn.disabled = !canUpgrade;
      els.inspectUpgradeBtn.textContent = "Upgrade";
      if (!gs) els.inspectUpgradeBtn.title = "";
      else if (gs.rank >= (gs.maxRank ?? 3)) els.inspectUpgradeBtn.title = "Max rank";
      else if (gs.owned < 2) els.inspectUpgradeBtn.title = "Need a second copy to upgrade";
      else els.inspectUpgradeBtn.title = `Upgrade to Rank ${gs.rank + 1} (consumes 1 copy)`;
    }
  }
}

// Cabinet actions (elements only)
if (els.inspectCabinetActions){
  const show = (ctx === "cabinet");
  els.inspectCabinetActions.hidden = !show;
  if (show){
    const stored = distilleryStoredFor(key);
    const tubes = Math.max(0, Math.floor(Number(state.player?.inventory?.test_tube) || 0));
    const GRAMS_PER_TUBE = 100;

    const maxByStored = Math.floor(Math.max(0, stored) / GRAMS_PER_TUBE);
    const maxTubes = Math.min(tubes, maxByStored);
    const canBottle = (maxTubes > 0);

    if (els.inspectBottleBtn){
      els.inspectBottleBtn.disabled = !canBottle;
      els.inspectBottleBtn.textContent = "Bottle";
      els.inspectBottleBtn.title = (tubes <= 0)
        ? "You need Test Tubes in your backpack."
        : (stored < GRAMS_PER_TUBE
          ? `Need at least ${GRAMS_PER_TUBE}g stored to fill a tube.`
          : `Bottle ${GRAMS_PER_TUBE}g into a real item (adds to inventory).`);
    }

    if (els.inspectBottleSellBtn){
      els.inspectBottleSellBtn.disabled = !canBottle;
      els.inspectBottleSellBtn.textContent = "Bottle & Sell";
      els.inspectBottleSellBtn.title = (tubes <= 0)
        ? "You need Test Tubes in your backpack."
        : (stored < GRAMS_PER_TUBE
          ? `Need at least ${GRAMS_PER_TUBE}g stored to fill a tube.`
          : "Bottle filled tubes and immediately sell them (uses normal Store sell rules)." );
    }
  }
}

}

const pages = [
  // Story uses a custom icon asset.
  { id: "story", label: "Story", icon: `<img class="navIconImg" src="./assets/icons/story-book.png" alt="" />` },
  { id: "inventory", label: "Inventory", icon: "🎒" },
{ id: "gathering", label: "Gather", icon: "⛏️" },
  { id: "refining", label: "Distillery", icon: "🧪" },
  { id: "craft", label: "Craft", icon: "🛠️" },
  { id: "store", label: "General Store", icon: "🏪" },
  { id: "blueprints", label: "Blueprints", icon: "🧩" },
  { id: "glossary", label: "Reference", icon: "📚" }
];

// Ensure all right-column pages live inside the framed, scrollable viewport.
// (Some older builds accidentally left certain pages outside #pageViewport,
// which makes the viewport look like an empty "field" while the page content
// renders below it.)
function ensurePagesInViewport(){
  const vp = document.getElementById("pageViewport");
  if (!vp) return;
  const pageIds = [
    "pageStory",
    "pageGathering",
    "pageInventory",
    "pageRefining",
    "pageCraft",
    "pageStore",
    "pageBlueprints",
    "pageGlossary",
    "pageAttribute"
  ];
  for (const id of pageIds){
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.parentElement !== vp) vp.appendChild(el);
  }
}

export function initUI(uiHandlers){
  handlers = uiHandlers;
  syncUIRefsToWindow();

  els = {
    playerMenuBtn: document.getElementById("playerMenuBtn"),
    playerMenu: document.getElementById("playerMenu"),
    playerAvatarImg: document.getElementById("playerAvatarImg"),
    avatarGrid: document.getElementById("avatarGrid"),

    playerNameInput: document.getElementById("playerNameInput"),
    playerNameSaveBtn: document.getElementById("playerNameSaveBtn"),


    resetLevelsBtn: document.getElementById("resetLevelsBtn"),
    resetBtn: document.getElementById("resetBtn"),

    playerName: document.getElementById("playerName"),
    playerLevel: document.getElementById("playerLevel"),
    playerStatus: document.getElementById("playerStatus"),
    xpFill: document.getElementById("xpFill"),
    xpText: document.getElementById("xpText"),
    hpFill: document.getElementById("hpFill"),
    hpText: document.getElementById("hpText"),
    oxygenFill: document.getElementById("oxygenFill"),
    oxygenText: document.getElementById("oxygenText"),
    breatheBtn: document.getElementById("breatheBtn"),
        // (Removed) manual Save/Load/Reset buttons — localStorage persists automatically.
    // Save backup (export/import JSON)
    exportJsonBtn: document.getElementById("exportJsonBtn"),
    importJsonBtn: document.getElementById("importJsonBtn"),
    importJsonFile: document.getElementById("importJsonFile"),
    saveTransferStatus: document.getElementById("saveTransferStatus"),

    themeBtn: document.getElementById("themeBtn"),
	    settingsBtn: document.getElementById("settingsBtn"),


    // Left-column panels (Attributes/History)
    statsToggle: document.getElementById("statsToggle"),
    statsBody: document.getElementById("statsBody"),
    statsGrid: document.getElementById("statsGrid"),

    historyToggle: document.getElementById("historyToggle"),
    historyBody: document.getElementById("historyBody"),
    historyList: document.getElementById("historyList"),

    pinnedBadges: document.getElementById("pinnedBadges"),
    quickToggle: document.getElementById("quickToggle"),
    quickBody: document.getElementById("quickBody"),
    quickNodesList: document.getElementById("quickNodesList"),

    // Quick Scavenge (repeatable activities)
    scavengeToggle: document.getElementById("scavengeToggle"),
    scavengeBody: document.getElementById("scavengeBody"),
    invToggle: document.getElementById("invToggle"),
    invBody: document.getElementById("invBody"),
    inventoryMiniGrid: document.getElementById("inventoryMiniGrid"),
    invSlotsLabel: document.getElementById("invSlotsLabel"),
    invSlotsLabel2: document.getElementById("invSlotsLabel2"),

    navRow: document.getElementById("navRow"),

    pageStory: document.getElementById("pageStory"),
    pageGathering: document.getElementById("pageGathering"),
    pageInventory: document.getElementById("pageInventory"),
pageRefining: document.getElementById("pageRefining"),
    pageBlueprints: document.getElementById("pageBlueprints"),
    pageCraft: document.getElementById("pageCraft"),
    pageStore: document.getElementById("pageStore"),
    pageGlossary: document.getElementById("pageGlossary"),

    // Attribute details page (right column)
    pageAttribute: document.getElementById("pageAttribute"),
    attrPageBackBtn: document.getElementById("attrPageBackBtn"),
    attrPageHint: document.getElementById("attrPageHint"),
    attrPageIcon: document.getElementById("attrPageIcon"),
    attrPageTitle: document.getElementById("attrPageTitle"),
    attrPageSub: document.getElementById("attrPageSub"),
    attrPageMeta: document.getElementById("attrPageMeta"),
    attrPageDesc: document.getElementById("attrPageDesc"),
    attrPageSummary: document.getElementById("attrPageSummary"),
    attrPagePath: document.getElementById("attrPagePath"),

    // Mobile panes / Wiki mounts
    paneMenu: document.getElementById("paneMenu"),
    paneGame: document.getElementById("paneGame"),
    paneWiki: document.getElementById("paneWiki"),
    wikiDesktopMount: document.getElementById("wikiDesktopMount"),
    wikiMobileMount: document.getElementById("wikiMobileMount"),
    paneToggleBtn: document.getElementById("paneToggleBtn"),
    paneDots: document.getElementById("paneDots"),


    chapterLabel: document.getElementById("chapterLabel"),
    storyText: document.getElementById("storyText"),
    storySpeaker: document.getElementById("storySpeaker"),
    storySceneImg: document.getElementById("storySceneImg"),
    vnCgImg: document.getElementById("vnCgImg"),
    vnCharLeft: document.getElementById("vnCharLeft"),
    vnCharCenter: document.getElementById("vnCharCenter"),
    vnCharRight: document.getElementById("vnCharRight"),
    battleWrap: document.getElementById("battleWrap"),
    choices: document.getElementById("choices"),
    chaptersList: document.getElementById("chaptersList"),
    repeatableEventsList: document.getElementById("repeatableEventsList"),
    // Story shell (hub vs in-chapter)
    storyHub: document.getElementById("storyHub"),
    storyPlay: document.getElementById("storyPlay"),
    storyBackBtn: document.getElementById("storyBackBtn"),
    storyFocusBtn: document.getElementById("storyFocusBtn"),
    storyContinueCard: document.getElementById("storyContinueCard"),
    storyContinueMeta: document.getElementById("storyContinueMeta"),
    storyContinueBtn: document.getElementById("storyContinueBtn"),


    gatherAllBtn: document.getElementById("gatherAllBtn"),
    collectAllBtn: document.getElementById("collectAllBtn"),
    gatherNodesList: document.getElementById("gatherNodesList"),
gadgetsEmpty: document.getElementById("gadgetsEmpty"),
invSlotsGrid: document.getElementById("invSlotsGrid"),
    invBackpackSort: document.getElementById("invBackpackSort"),
    equipToggle: document.getElementById("equipToggle"),
    toolbeltToggle: document.getElementById("toolbeltToggle"),
    equipBody: document.getElementById("equipBody"),
    toolbeltBody: document.getElementById("toolbeltBody"),
    equipGrid: document.getElementById("equipGrid"),
    toolbeltGrid: document.getElementById("toolbeltGrid"),
    toolbeltCount: document.getElementById("toolbeltCount"),
    toolbeltTotal: document.getElementById("toolbeltTotal"),
    backpackToggle: document.getElementById("backpackToggle"),
    backpackBody: document.getElementById("backpackBody"),
    refineList: document.getElementById("refineList"),
    distilleryCabinetGrid: document.getElementById("distilleryCabinetGrid"),
    cabinetSort: document.getElementById("cabinetSort"),
    cabinetSortChips: document.getElementById("cabinetSortChips"),
    cabinetToggle: document.getElementById("cabinetToggle"),
    cabinetBody: document.getElementById("cabinetBody"),
    distillerToggle: document.getElementById("distillerToggle"),
    distillerBody: document.getElementById("distillerBody"),
    cabinetUnloadBtn: document.getElementById("cabinetUnloadBtn"),
    distillerKnownGrid: document.getElementById("distillerKnownGrid"),
    distillerScrapGrid: document.getElementById("distillerScrapGrid"),
    distillerEmpty: document.getElementById("distillerEmpty"),

    bpSlotsGrid: document.getElementById("bpSlotsGrid"),
    bpCatalogList: document.getElementById("bpCatalogList"),
    bpCatalogSort: document.getElementById("bpCatalogSort"),
    craftGearGrid: document.getElementById("craftGearGrid"),
    craftGadgetsGrid: document.getElementById("craftGadgetsGrid"),
    craftToolsGrid: document.getElementById("craftToolsGrid"),
    craftGearEmpty: document.getElementById("craftGearEmpty"),
    craftGadgetsEmpty: document.getElementById("craftGadgetsEmpty"),
    craftToolsEmpty: document.getElementById("craftToolsEmpty"),
    craftUtilitiesList: document.getElementById("craftUtilitiesList"),
    craftUtilitiesEmpty: document.getElementById("craftUtilitiesEmpty"),

    itemInspector: document.getElementById("itemInspector"),
    inspectIcon: document.getElementById("inspectIcon"),
    inspectTierBadge: document.getElementById("inspectTierBadge"),
    inspectTitle: document.getElementById("inspectTitle"),
    inspectMeta: document.getElementById("inspectMeta"),
    inspectDesc: document.getElementById("inspectDesc"),
    inspectFound: document.getElementById("inspectFound"),
    inspectLockBtn: document.getElementById("inspectLockBtn"),
    inspectPrimaryBtn: document.getElementById("inspectPrimaryBtn"),
    inspectMultiBtn: document.getElementById("inspectMultiBtn"),
    inspectGadgetActions: document.getElementById("inspectGadgetActions"),
    inspectChargeBtn: document.getElementById("inspectChargeBtn"),
    inspectUpgradeBtn: document.getElementById("inspectUpgradeBtn"),
    inspectCabinetActions: document.getElementById("inspectCabinetActions"),
    inspectBottleBtn: document.getElementById("inspectBottleBtn"),
    inspectBottleSellBtn: document.getElementById("inspectBottleSellBtn"),
    inspectDeleteBtn: document.getElementById("inspectDeleteBtn"),

    attrInspector: document.getElementById("attrInspector"),
    attrTitle: document.getElementById("attrTitle"),
    attrScroll: document.getElementById("attrScroll"),
    attrScrollInner: document.getElementById("attrScrollInner"),
    attrMeta: document.getElementById("attrMeta"),
    attrDesc: document.getElementById("attrDesc"),
    attrSummary: document.getElementById("attrSummary"),
    attrPath: document.getElementById("attrPath"),
    attrCloseBtn: document.getElementById("attrCloseBtn"),


    storeCredits: document.getElementById("storeCredits"),
    storeUndoBtn: document.getElementById("storeUndoBtn"),
    storeBuyGrid: document.getElementById("storeBuyGrid"),
    storeBuySort: document.getElementById("storeBuySort"),
    storeBuySortChips: document.getElementById("storeBuySortChips"),
    storeSellGrid: document.getElementById("storeSellGrid"),
    storeHint: document.getElementById("storeHint"),

    // A1 storekeeper card (Store page)
    storeA1Card: document.getElementById("storeA1Card"),
    storeA1Line: document.getElementById("storeA1Line"),
    storeA1Subline: document.getElementById("storeA1Subline"),
    storeA1TalkBtn: document.getElementById("storeA1TalkBtn"),
    storeA1AskBtn: document.getElementById("storeA1AskBtn"),
    storeA1RumorsBtn: document.getElementById("storeA1RumorsBtn"),
    storeA1UpgradesBtn: document.getElementById("storeA1UpgradesBtn"),

    // A1 upgrades panel
    storeA1UpgradesPanel: document.getElementById("storeA1UpgradesPanel"),
    a1StorageMeta: document.getElementById("a1StorageMeta"),
    a1StorageUpgradeBtn: document.getElementById("a1StorageUpgradeBtn"),
    a1StorageBarFill: document.getElementById("a1StorageBarFill"),
    a1StorageNeeds: document.getElementById("a1StorageNeeds"),
    a1LinkMeta: document.getElementById("a1LinkMeta"),
    a1LinkUpgradeBtn: document.getElementById("a1LinkUpgradeBtn"),
    a1LinkBarFill: document.getElementById("a1LinkBarFill"),
    a1LinkNeeds: document.getElementById("a1LinkNeeds"),
  };

  // Layout hygiene: keep pages inside the right-column viewport.
  try{ ensurePagesInViewport(); }catch(_){/* ignore */}

  // Persist for recovery (see recoverUIRefsFromWindow)
  syncUIRefsToWindow();

  // Tailwind-only skin: add utility classes to static DOM once
  try{ applyTailwindStaticSkin(); }catch(_){/* ignore */}

  // Always start with Player settings closed (settings live in the expandable menu)
  try{ state.ui.playerMenuOpen = false; }catch(_){/* ignore */}

  // wire buttons

  // v59.17: Reliable story click-to-advance (beats/attack loop)
  // Use a document-level handler so clicks always register even if overlay layers change.
  document.addEventListener("click", (e) => {
    const storyWindow = e.target?.closest?.(".storyWindow--scene");
    if (!storyWindow) return;

    // Hub view shows the stage as a visual header. Don't advance beats there.
    if (state?.currentNodeId === "choose_adventure") return;

    // If the battle UI is active, the story window is being used as a battle scene.
    // Don't advance story beats on stage taps.
    if (e.target?.closest?.("#battleWrap")) return;

    // Don't advance story beats while the battle module is active.
    if (e.target?.closest?.("#battleWrap")) return;

    // Ignore clicks on interactive controls
    if (e.target?.closest?.("button, input, textarea, select, a, label")) return;

    handlers?.onStoryAdvance?.();
  });


// Story shell controls (Hub / Continue)
const gotoStoryHub = () => {
  try{
    if (!state.ui) state.ui = {};
    state.ui.activePage = "story";
    state.ui.activeChapterKey = null;
    state.currentNodeId = "choose_adventure";
    state.ui.storyBeatNodeId = "choose_adventure";
    state.ui.storyBeatIndex = 0;
    // Clear battle context so the hub is always safe.
    if (state.battle) state.battle = null;
    saveGame();
    renderAll();
  }catch(_){/* ignore */}
};

els.storyBackBtn?.addEventListener("click", (e) => {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  gotoStoryHub();
});

els.storyFocusBtn?.addEventListener("click", (e) => {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  if (!state.ui) state.ui = {};
  state.ui.storyFocus = !state.ui.storyFocus;
  saveGame();
  renderAll();
});

els.storyContinueBtn?.addEventListener("click", (e) => {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  const key = els.storyContinueBtn?.dataset?.chapterKey;
  if (key && handlers?.onOpenChapter) handlers.onOpenChapter(key);
});

  // Save backup (export/import JSON)
  function setSaveTransferStatus(msg){
    if (els?.saveTransferStatus) els.saveTransferStatus.textContent = msg || "";
  }

  // Reset levels (keeps inventory/story) — default testing reset
  els.resetLevelsBtn?.addEventListener("click", (e) => {
    e?.stopPropagation?.();
    handlers?.onResetLevels?.();
  });

  // Full reset (destructive)
  els.resetBtn?.addEventListener("click", (e) => {
    e?.stopPropagation?.();
    // Back-compat: fall back to onReset if older handler object is used.
    (handlers?.onResetFull || handlers?.onReset)?.();
  });

  function downloadText(filename, text){
    try{
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 250);
    }catch(e){
      console.error(e);
      setSaveTransferStatus("Export failed.");
      alert("Could not export save.");
    }
  }

  els.exportJsonBtn?.addEventListener("click", () => {
    const s = handlers?.getSaveTransferText?.();
    const txt = (typeof s === "string") ? s : "";
    if (!txt){
      setSaveTransferStatus("Nothing to export yet.");
      return;
    }
    const ts = new Date();
    const pad = (n) => String(n).padStart(2,"0");
    const name = `fun-with-matter-save-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`;
    downloadText(name, txt);
    setSaveTransferStatus("Exported save JSON.");
  });

  els.importJsonBtn?.addEventListener("click", () => {
    els.importJsonFile?.click?.();
  });

  els.importJsonFile?.addEventListener("change", async () => {
    const f = els.importJsonFile?.files?.[0];
    if (!f) return;

    const ok = confirm("Importing will overwrite your current progress. Continue?");
    if (!ok){
      // Allow picking the same file again later.
      try{ els.importJsonFile.value = ""; }catch(_){}
      return;
    }

    try{
      const txt = (await f.text()).trim();
      if (!txt){
        setSaveTransferStatus("That file was empty.");
        return;
      }
      const res = handlers?.applySaveTransferText?.(txt);
      if (!res?.ok){
        setSaveTransferStatus(res?.reason || "Import failed.");
        alert(res?.reason || "Import failed.");
        return;
      }
      setSaveTransferStatus("Imported save JSON.");
      if (res?.reload){
        location.reload();
        return;
      }
      handlers?.onLoad?.();
    }catch(e){
      console.error(e);
      setSaveTransferStatus("Could not read that file.");
      alert("Could not read that file.");
    }finally{
      try{ els.importJsonFile.value = ""; }catch(_){}
    }
  });
  // (Removed) paste-import textarea flow. Import now uses file picker only.
  els.storeUndoBtn?.addEventListener("click", () => handlers?.onUndoLastSale?.());
  // Item Inspector (hover)
  els.itemInspector?.addEventListener("mouseenter", () => {
    clearTimeout(hideInspectorTimer);
  });
  els.itemInspector?.addEventListener("mouseleave", () => {
    scheduleCloseInspector();
  });

  // Item inspector: dismiss when clicking outside (and allow clicking the same icon to toggle).
  document.addEventListener("pointerdown", (e) => {
    if (!inspectorKey || !els?.itemInspector) return;
    if (!els.itemInspector.classList.contains("open")) return;
    const t = e.target;
    // Clicks inside the inspector should not close it.
    if (els.itemInspector.contains(t)) return;
    // Clicking the anchor icon is handled by openInspector's toggle logic.
    if (inspectorAnchorEl && inspectorAnchorEl.contains(t)) return;
    closeInspector();
  });

// Attribute inspector: dismiss when clicking outside (helps with readability/flow).
document.addEventListener("pointerdown", (e) => {
  if (!attrInspectorKey || !els?.attrInspector) return;
  if (!els.attrInspector.classList.contains("open")) return;
  const t = e.target;
  if (els.attrInspector.contains(t)) return;
  if (attrInspectorAnchorEl && attrInspectorAnchorEl.contains(t)) return;
  closeAttrInspector();
});


  // Attribute Inspector (click-open only)
  els.attrCloseBtn?.addEventListener("click", () => closeAttrInspector());

  // Attribute inspector: allow setting training target from inside the panel.
  els.attrInspector?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".trainPickBtn");
    if (!btn) return;
    const k = btn.dataset?.train;
    if (!k) return;
    setCombatTrainingTarget(k);
    renderStats();
    renderAttrInspector();
    e.stopPropagation();
  });

  // Attribute details page (right column)
  els.attrPageBackBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeAttributePage();
  });

  // Allow setting training target from inside the attribute details page.
  els.pageAttribute?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".trainPickBtn");
    if (!btn) return;
    const k = btn.dataset?.train;
    if (!k) return;
    setCombatTrainingTarget(k);
    renderStats();
    renderAttributePage();
    e.stopPropagation();
  });
  // Close the attribute inspector when clicking outside it (and outside the Strength row).
  document.addEventListener("mousedown", (e) => {
    if (!attrInspectorKey || !els?.attrInspector) return;
    if (!els.attrInspector.classList.contains("open")) return;
    const t = e.target;
    // Allow clicks inside the inspector.
    if (els.attrInspector.contains(t)) return;
    // Allow clicks on the anchor row to toggle.
    if (attrInspectorAnchorEl && attrInspectorAnchorEl.contains(t)) return;
    closeAttrInspector();
    renderStats();
  });

  // Wheel-driven scrolling for the Attribute Inspector (no native scrollbar)
  // Only captures the wheel when the inspector is open and hovered, so it doesn't steal page scroll.
  window.addEventListener("wheel", (e) => {
    if (!attrInspectorKey || !els?.attrInspector || !els?.attrScroll) return;
    if (!els.attrInspector.classList.contains("open")) return;
    // Only react when the wheel event happens over the inspector or the stats panel.
    // This avoids "dead zones" where hovering gaps can accidentally close the inspector.
    const inInspector = els.attrInspector.contains(e.target);
    const inStats = !!els.statsGrid && els.statsGrid.contains(e.target);
    if (!inInspector && !inStats) return;

    // Update bounds in case layout changed
    updateAttrScrollBounds();
    if (attrScrollMax <= 0) return;

    // User interaction: keep the inspector open while scrolling (prevents hover timers from closing it).
    attrInspectorPinned = true;
    clearTimeout(hideAttrInspectorTimer);

    e.preventDefault();
    const dy = Number(e.deltaY) || 0;
    // Slightly dampen for trackpads while still feeling responsive on wheels.
    attrScrollY = Math.max(0, Math.min(attrScrollY + dy * 0.9, attrScrollMax));
    applyAttrScroll();
  }, { passive: false });

  els.inspectLockBtn?.addEventListener("click", () => {
    if (!inspectorKey) return;
    handlers?.onToggleLock?.(inspectorKey);
    renderInspector();
  });
  els.inspectPrimaryBtn?.addEventListener("click", () => {
    if (!inspectorKey) return;
    const key = inspectorKey;
    const t = thingByKey[key] || {};
    const ctx = inspectorContext;

    // Craft: blueprint-driven actions (start / collect)
    if (typeof ctx === "string" && ctx.startsWith("craft:")){
      const bpKey = ctx.split(":")[1];
      if (!bpKey) return;
      const job = getCraftJob(bpKey);
      if (job && Date.now() >= (Number(job.endAt) || 0)){
        handlers?.onCollectCraft?.(bpKey);
      } else {
        handlers?.onStartCraft?.(bpKey);
      }
      closeInspector();
      return;
    }

    if (ctx === "cabinet"){
      handlers?.onCabinetStore?.(key);
      closeInspector();
      return;
    }

    if (ctx === "distiller"){
      handlers?.onDistillScrap?.(key, 1);
      closeInspector();
      return;
    }

    
if (ctx === "store-buy"){
  const price = Math.max(0, Math.floor(Number(t?.buyPrice) || 0));
  const credits = Math.max(0, Math.floor(Number(state.player?.credits) || 0));
  const isGear = (t.kind === "Gear");
  const owned = isGear ? (Math.max(0, Math.floor(Number(state.player?.inventory?.[key]) || 0)) > 0 || !!equippedSlotFor(key)) : false;

  if (price <= 0){
    openActionModal({
      title: "Buy Item",
      tier: Number(t?.tier || 0) || 0,
      bodyHtml: `<div class="actionText"><div class="actionLine">${escapeHtml(labelFor(key))}</div><div class="actionError">Not for sale.</div></div>`,
      actions: [{ kind: "cancel", label: "Close", autoFocus: true, onClick: () => closeActionModal() }],
    });
    return;
  }

  if (owned){
    openActionModal({
      title: "Buy Item",
      tier: Number(t?.tier || 0) || 0,
      bodyHtml: `<div class="actionText"><div class="actionLine">${escapeHtml(labelFor(key))}</div><div class="actionError">You can only own one of each gear.</div></div>`,
      actions: [{ kind: "cancel", label: "Close", autoFocus: true, onClick: () => closeActionModal() }],
    });
    return;
  }

  if (credits < price){
    openActionModal({
      title: "Buy Item",
      tier: Number(t?.tier || 0) || 0,
      bodyHtml: `<div class="actionText"><div class="actionLine">Buy 1 × <span class="actionItemName">${escapeHtml(labelFor(key))}</span>?</div><div class="actionError">Not enough MU.</div><div class="actionMeta">Cost: ${price} MU • You have ${credits}</div></div>`,
      actions: [{ kind: "cancel", label: "Close", autoFocus: true, onClick: () => closeActionModal() }],
    });
    return;
  }

  const itemName = labelFor(key);
  const tier = Number(t?.tier || 0) || 0;
  const sym = symbolFor(key);

  openActionModal({
    title: "Buy Item",
    tier,
    bodyHtml: `
      <div class="actionRow">
        <div class="actionTileWrap">
          <div class="fwm-tile tier-${tier || 6}">
            <div class="slotCount">1</div>
            <div class="slotSymbol">${escapeHtml(sym)}</div>
          </div>
        </div>
        <div class="actionText">
          <div class="actionLine">Buy 1 × <span class="actionItemName">${escapeHtml(itemName)}</span>?</div>
          <div class="actionMeta">It will cost</div>
          <div class="actionTotal">${price} MU</div>
        </div>
      </div>
    `,
    actions: [
      { kind: "cancel", label: "Cancel", autoFocus: true, onClick: () => closeActionModal() },
      { kind: "confirm", label: `Buy for ${price} MU`, onClick: () => {
          closeActionModal();
          handlers?.onBuy?.(key, 1);
          closeInspector();
          renderAll();
        }
      },
    ],
  });
  return;
}
    if (ctx === "store-sell"){
      const price = Math.max(0, Math.floor(Number(t?.sellPrice) || 0));
      if (state.player?.locks?.[key]){
        alert(`${labelFor(key)} is locked.`);
        return;
      }

      // Replace browser confirm with an in-game floating window.
      const itemName = labelFor(key);
      const tier = Number(t?.tier || 0) || 0;
      const sym = symbolFor(key);
      openActionModal({
        title: "Sell Item",
        tier,
        bodyHtml: `
          <div class="actionRow">
            <div class="actionTileWrap">
              <div class="fwm-tile tier-${tier || 6}">
                <div class="slotCount">1</div>
                <div class="slotSymbol">${escapeHtml(sym)}</div>
              </div>
            </div>
            <div class="actionText">
              <div class="actionLine">Sell 1 × <span class="actionItemName">${escapeHtml(itemName)}</span>?</div>
              <div class="actionMeta">You will receive</div>
              <div class="actionTotal">${price} MU</div>
            </div>
          </div>
        `,
        actions: [
          { kind: "cancel", label: "Cancel", autoFocus: true, onClick: () => closeActionModal() },
          { kind: "confirm", label: `Sell for ${price} MU`, onClick: () => {
              closeActionModal();
              handlers?.onSell?.(key, 1);
              closeInspector();
              renderAll();
            }
          },
        ],
      });
      return;
    }

    // Inventory: equip/unequip (gear) or belt/unbelt (tools)
    if ((t.kind || "") === "Gear"){
      handlers?.onEquipToggle?.(key);
    } else if ((t.kind || "") === "Tool"){
      handlers?.onToolbeltToggle?.(key);
    }
    closeInspector();
  });

  els.inspectMultiBtn?.addEventListener("click", () => {
    if (!inspectorKey) return;
    const key = inspectorKey;
    const t = thingByKey[key] || {};
    const ctx = inspectorContext;

    if (ctx === "cabinet"){
      handlers?.onCabinetUpgrade?.(key);
      closeInspector();
      return;
    }

    if (ctx === "distiller"){
      const max = maxDistillableForScrap(key);
      if (max <= 1) return;
      handlers?.onDistillScrap?.(key, max);
      closeInspector();
      return;
    }

    
if (ctx === "store-buy"){
  const price = Math.max(0, Math.floor(Number(t?.buyPrice) || 0));
  const credits = Math.max(0, Math.floor(Number(state.player?.credits) || 0));
  const tier = Number(t?.tier || 0) || 0;
  const isGear = (t.kind === "Gear");

  if (price <= 0){
    openActionModal({
      title: "Buying",
      tier,
      bodyHtml: `<div class="actionText"><div class="actionLine">${escapeHtml(labelFor(key))}</div><div class="actionError">Not for sale.</div></div>`,
      actions: [{ kind: "cancel", label: "Close", autoFocus: true, onClick: () => closeActionModal() }],
    });
    return;
  }

  if (isGear){
    openActionModal({
      title: "Buying",
      tier,
      bodyHtml: `<div class="actionText"><div class="actionLine">${escapeHtml(labelFor(key))}</div><div class="actionError">Gear can only be bought one at a time.</div></div>`,
      actions: [{ kind: "cancel", label: "Close", autoFocus: true, onClick: () => closeActionModal() }],
    });
    return;
  }

  const maxAffordable = Math.max(0, Math.floor(credits / price));
  let qty = 1;

  const itemName = labelFor(key);
  const sym = symbolFor(key);

  openActionModal({
    title: "Buying",
    tier,
    bodyHtml: `
      <div class="actionRow">
        <div class="actionTileWrap">
          <div class="fwm-tile tier-${tier || 6}">
            <div class="slotCount" id="buyQtyCount">${qty}</div>
            <div class="slotSymbol">${escapeHtml(sym)}</div>
          </div>
        </div>
        <div class="actionText">
          <div class="actionLine"><span class="actionItemName">${escapeHtml(itemName)}</span></div>
          <div class="actionMeta">${price} MU each • You have ${credits} MU</div>
        </div>
      </div>
      <div class="actionQtyBlock">
        <div class="actionLabel">Quantity</div>
        <div class="actionQtyRow">
          <div class="energyBar tier-${tier || 6}" id="buyEnergyBar">
            <div class="batterySegments" id="buyQtySegments" aria-hidden="true"></div>
            <div class="energyThumb" id="buyQtyThumb" aria-hidden="true"></div>
            <input id="buyQtyRange" class="energyRange" type="range" min="1" max="${Math.max(1, maxAffordable)}" step="1" value="${qty}" aria-label="Quantity slider">
          </div>
          <input id="buyQtyNum" type="number" min="1" max="${Math.max(1, maxAffordable)}" step="1" value="${qty}">
        </div>
        <div id="buyQtyError" class="actionError" hidden></div>
        <div id="buyTotalLine" class="actionTotal">Cost: ${price * qty} MU</div>
      </div>
    `,
    actions: [
      { kind: "cancel", label: "Cancel", autoFocus: true, onClick: () => closeActionModal() },
      { kind: "confirm", label: `Buy ${qty} for ${price * qty} MU`, onClick: () => {
          const refs = getActionModalRefs();
          const modal = refs?.modalEl;
          const nEl = modal?.querySelector?.("#buyQtyNum");
          const errEl = modal?.querySelector?.("#buyQtyError");
          const raw = Math.floor(Number(nEl?.value) || 0);

          if (!Number.isFinite(raw) || raw < 1){
            if (errEl){
              errEl.hidden = false;
              errEl.textContent = "Enter a quantity of 1 or more.";
            }
            return;
          }
          if (raw > maxAffordable){
            if (errEl){
              errEl.hidden = false;
              errEl.textContent = `You can only afford ${maxAffordable}.`;
            }
            return;
          }

          const n = Math.max(1, Math.min(maxAffordable, raw));
          if (n < 1){
            if (errEl){
              errEl.hidden = false;
              errEl.textContent = "Not enough MU.";
            }
            return;
          }

          closeActionModal();
          handlers?.onBuy?.(key, n);
          closeInspector();
          renderAll();
        }
      },
    ],
  });

  // Wire slider + number input after modal renders
  setTimeout(() => {
    const refs = getActionModalRefs();
    const modal = refs?.modalEl;
    if (!modal) return;
    const range = modal.querySelector("#buyQtyRange");
    const num = modal.querySelector("#buyQtyNum");
    const totalEl = modal.querySelector("#buyTotalLine");
    const countEl = modal.querySelector("#buyQtyCount");
    const errEl = modal.querySelector("#buyQtyError");
    const energyBar = modal.querySelector("#buyEnergyBar");
    const segWrap = modal.querySelector("#buyQtySegments");
    const confirmBtn = refs?.actionsEl?.querySelector?.('button[data-kind="confirm"]');

    const max = Math.max(1, Number(maxAffordable || 0));
    // If the player can't afford any, disable confirm and show a message.
    const showErr = (msg="") => {
      if (!errEl) return;
      errEl.textContent = String(msg || "");
      errEl.hidden = !msg;
    };
    const setConfirmEnabled = (on) => {
      if (!confirmBtn) return;
      confirmBtn.disabled = !on;
      confirmBtn.classList.toggle("isDisabled", !on);
    };

    if ((maxAffordable || 0) < 1){
      showErr("Not enough MU.");
      setConfirmEnabled(false);
    }

    // Battery segments:
    // - Up to 20: one segment per item (so the bar feels "exact" and never shows unused cells).
    // - Above 20: fixed 20-segment rail that fills proportionally (keeps the HUD readable).
    const segCount = (maxAffordable && maxAffordable > 0)
      ? (maxAffordable <= 20 ? maxAffordable : 20)
      : 1;
    if (segWrap){
      segWrap.style.setProperty("--segs", String(segCount));
      segWrap.innerHTML = Array.from({ length: segCount }).map(() => '<span class="seg"></span>').join("");
    }

    const setEnergy = (n) => {
      const m = Math.max(1, Number(maxAffordable || 1));
      const q = Math.max(1, Math.min(m, Math.floor(Number(n) || 1)));
      const filled = (m <= segCount)
        ? q
        : Math.max(1, Math.round((q / m) * segCount));

      if (segWrap){
        const segs = segWrap.querySelectorAll?.(".seg") || [];
        segs.forEach((el, idx) => el.classList.toggle("on", idx < filled));
      }
      if (energyBar){
        // Snap the thumb to the TRUE center of a segment (accounts for inset + gaps + subpixel layout).
        // This avoids drift near the ends that can happen when using percentage math.
        const segs = segWrap?.querySelectorAll?.('.seg') || [];
        const idx = Math.max(0, Math.min(segs.length - 1, filled - 1));
        const segEl = segs[idx];
        if (segEl && typeof segEl.getBoundingClientRect === 'function'){
          const barRect = energyBar.getBoundingClientRect();
          const segRect = segEl.getBoundingClientRect();
          const centerPx = (segRect.left - barRect.left) + (segRect.width / 2);
          energyBar.style.setProperty('--thumbX', `${centerPx}px`);
        } else {
          const p = (segCount <= 1) ? 50 : ((filled - 0.5) / segCount) * 100;
          energyBar.style.setProperty("--p", `${p}`);
          energyBar.style.removeProperty('--thumbX');
        }
      }
    };

    const clamp = (n) => Math.max(1, Math.min(maxAffordable || 1, Math.floor(Number(n) || 1)));

    const updateFromValid = (n) => {
      qty = clamp(n);
      if (range) range.value = String(qty);
      if (num) num.value = String(qty);
      if (countEl) countEl.textContent = String(qty);
      if (totalEl) totalEl.textContent = `Cost: ${price * qty} MU`;
      if (confirmBtn) confirmBtn.textContent = `Buy ${qty} for ${price * qty} MU`;
      setEnergy(qty);
      showErr("");
      setConfirmEnabled(true);
    };

    const validateNum = () => {
      const raw = Math.floor(Number(num?.value) || 0);
      if (!Number.isFinite(raw) || raw < 1){
        showErr("Enter a quantity of 1 or more.");
        setConfirmEnabled(false);
        return;
      }
      if (raw > (maxAffordable || 0)){
        showErr(`You can only afford ${maxAffordable}.`);
        setConfirmEnabled(false);
        return;
      }
      updateFromValid(raw);
    };

    range?.addEventListener("input", () => updateFromValid(range.value), { passive: true });
    num?.addEventListener("input", () => validateNum(), { passive: true });

    // Initialize
    if ((maxAffordable || 0) >= 1) updateFromValid(qty);
    else setEnergy(1);
  }, 0);

  return;
}

    if (ctx === "store-sell"){
      if (state.player?.locks?.[key]){
        alert(`${labelFor(key)} is locked.`);
        return;
      }
      const max = Math.max(0, Math.floor(Number(state.player?.inventory?.[key]) || 0));
      const price = Math.max(0, Math.floor(Number(t?.sellPrice) || 0));

      // In-game slider confirm (no browser prompt/confirm)
      const itemName = labelFor(key);
      const tier = Number(t?.tier || 0) || 0;
      // Default to 1 for safety; clamp based on inventory count.
      let qty = 1;

      const sym = symbolFor(key);
      openActionModal({
        title: "Selling",
        tier,
        bodyHtml: `
          <div class="actionRow">
            <div class="actionTileWrap">
              <div class="fwm-tile tier-${tier || 6}">
                <div class="slotCount" id="sellQtyCount">${qty}</div>
                <div class="slotSymbol">${escapeHtml(sym)}</div>
              </div>
            </div>
            <div class="actionText">
              <div class="actionLine"><span class="actionItemName">${escapeHtml(itemName)}</span></div>
              <div class="actionMeta">${price} MU each • You have ${max}</div>
            </div>
          </div>
          <div class="actionQtyBlock">
            <div class="actionLabel">Quantity</div>
            <div class="actionQtyRow">
              <div class="energyBar tier-${tier || 6}" id="sellEnergyBar">
                <div class="batterySegments" id="sellQtySegments" aria-hidden="true"></div>
                <div class="energyThumb" id="sellQtyThumb" aria-hidden="true"></div>
                <input id="sellQtyRange" class="energyRange" type="range" min="1" max="${max || 1}" step="1" value="${qty}" aria-label="Quantity slider">
              </div>
              <input id="sellQtyNum" type="number" min="1" max="${max || 1}" step="1" value="${qty}">
            </div>
            <div id="sellQtyError" class="actionError" hidden></div>
            <div id="sellTotalLine" class="actionTotal">You will receive: ${price * qty} MU</div>
          </div>
        `,
        actions: [
          { kind: "cancel", label: "Cancel", autoFocus: true, onClick: () => closeActionModal() },
          { kind: "confirm", label: `Sell ${qty} for ${price * qty} MU`, onClick: () => {
              const refs = getActionModalRefs();
              const modal = refs?.modalEl;
              const nEl = modal?.querySelector?.("#sellQtyNum");
              const errEl = modal?.querySelector?.("#sellQtyError");
              const raw = Math.floor(Number(nEl?.value) || 0);

              // Validate: if user typed more than they have, do NOT sell anything.
              if (!Number.isFinite(raw) || raw < 1){
                if (errEl){
                  errEl.hidden = false;
                  errEl.textContent = "Enter a quantity of 1 or more.";
                }
                return;
              }
              if (raw > (max || 1)){
                if (errEl){
                  errEl.hidden = false;
                  errEl.textContent = `You only have ${max || 0}.`;
                }
                return;
              }

              const n = Math.max(1, Math.min(max || 1, raw));
              closeActionModal();
              handlers?.onSell?.(key, n);
              closeInspector();
              renderAll();
            }
          },
        ],
      });

      // Wire slider + number input after modal renders
      setTimeout(() => {
        const refs = getActionModalRefs();
        const modal = refs?.modalEl;
        if (!modal) return;
        const range = modal.querySelector("#sellQtyRange");
        const num = modal.querySelector("#sellQtyNum");
        const totalEl = modal.querySelector("#sellTotalLine");
        const countEl = modal.querySelector("#sellQtyCount");
        const errEl = modal.querySelector("#sellQtyError");
        const energyBar = modal.querySelector("#sellEnergyBar");
        const segWrap = modal.querySelector("#sellQtySegments");
        const confirmBtn = refs?.actionsEl?.querySelector?.('button[data-kind="confirm"]');

        // Battery segments:
        // - Up to 20: one segment per item (never shows "unused" cells).
        // - Above 20: fixed 20-segment rail that fills proportionally.
        const segCount = (max && max > 0)
          ? (max <= 20 ? max : 20)
          : 1;
        if (segWrap){
          segWrap.style.setProperty("--segs", String(segCount));
          segWrap.innerHTML = Array.from({ length: segCount }).map(() => '<span class="seg"></span>').join("");
        }

        const setEnergy = (n) => {
          const m = Math.max(1, Number(max || 1));
          const q = Math.max(1, Math.min(m, Math.floor(Number(n) || 1)));
          // Fill amount: exact segments when m <= segCount; proportional otherwise.
          const filled = (m <= segCount)
            ? q
            : Math.max(1, Math.round((q / m) * segCount));

          if (segWrap){
            const segs = segWrap.querySelectorAll?.(".seg") || [];
            segs.forEach((el, idx) => el.classList.toggle("on", idx < filled));
          }

          if (energyBar){
            // Snap the thumb to the TRUE center of a segment (accounts for inset + gaps + subpixel layout).
            // This avoids drift near the ends that can happen when using percentage math.
            const segs = segWrap?.querySelectorAll?.('.seg') || [];
            const idx = Math.max(0, Math.min(segs.length - 1, filled - 1));
            const segEl = segs[idx];
            if (segEl && typeof segEl.getBoundingClientRect === 'function'){
              const barRect = energyBar.getBoundingClientRect();
              const segRect = segEl.getBoundingClientRect();
              const centerPx = (segRect.left - barRect.left) + (segRect.width / 2);
              energyBar.style.setProperty('--thumbX', `${centerPx}px`);
            } else {
              const p = (segCount <= 1) ? 50 : ((filled - 0.5) / segCount) * 100;
              energyBar.style.setProperty("--p", `${p}`);
              energyBar.style.removeProperty('--thumbX');
            }
          }
        };

        const clamp = (n) => Math.max(1, Math.min(max || 1, Math.floor(Number(n) || 1)));
        const showErr = (msg="") => {
          if (!errEl) return;
          errEl.textContent = String(msg || "");
          errEl.hidden = !msg;
        };
        const setConfirmEnabled = (on) => {
          if (!confirmBtn) return;
          confirmBtn.disabled = !on;
          confirmBtn.classList.toggle("isDisabled", !on);
        };

        const updateFromValid = (n) => {
          qty = clamp(n);
          if (range) range.value = String(qty);
          if (num) num.value = String(qty);
          if (countEl) countEl.textContent = String(qty);
          if (totalEl) totalEl.textContent = `You will receive: ${price * qty} MU`;
          if (confirmBtn) confirmBtn.textContent = `Sell ${qty} for ${price * qty} MU`;
          setEnergy(qty);
          showErr("");
          setConfirmEnabled(true);
        };

        const validateNum = () => {
          const raw = Math.floor(Number(num?.value) || 0);
          if (!Number.isFinite(raw) || raw < 1){
            showErr("Enter a quantity of 1 or more.");
            setConfirmEnabled(false);
            return;
          }
          if (raw > (max || 1)){
            showErr(`You only have ${max || 0}.`);
            setConfirmEnabled(false);
            return;
          }
          updateFromValid(raw);
        };

        range?.addEventListener("input", () => updateFromValid(range.value), { passive: true });
        num?.addEventListener("input", () => validateNum(), { passive: true });
        updateFromValid(qty);
      }, 0);

      return;
    }
  });

  els.inspectChargeBtn?.addEventListener("click", () => {
    if (!inspectorKey) return;
    handlers?.onGadgetCharge?.(inspectorKey);
    renderInspector();
    renderStats();
  });
  els.inspectUpgradeBtn?.addEventListener("click", () => {
    if (!inspectorKey) return;
    handlers?.onGadgetUpgrade?.(inspectorKey);
    renderInspector();
    renderStats();
  });

  // Distillery Cabinet: bottle (create item) + bottle & sell (auto-sell)
  const promptTubeQty = (ek) => {
    const tubes = Math.max(0, Math.floor(Number(state.player?.inventory?.test_tube) || 0));
    const stored = distilleryStoredFor(ek);
    const GRAMS_PER_TUBE = 100;
    const maxByStored = Math.floor(Math.max(0, stored) / GRAMS_PER_TUBE);
    const maxTubes = Math.min(tubes, maxByStored);

    if (tubes <= 0){
      alert("You have no Test Tubes in your backpack.");
      return null;
    }
    if (stored < GRAMS_PER_TUBE){
      alert(`Need at least ${GRAMS_PER_TUBE}g stored to fill a tube.`);
      return null;
    }
    if (maxTubes <= 0){
      alert("Nothing to bottle.");
      return null;
    }

    const raw = prompt(`How many tubes to fill? (1–${maxTubes})`, "1");
    if (raw == null) return null;
    const qty = Math.max(1, Math.min(maxTubes, Math.floor(Number(raw) || 0)));
    if (!qty) return null;
    return qty;
  };

  els.inspectBottleBtn?.addEventListener("click", () => {
    if (!inspectorKey) return;
    if (inspectorContext !== "cabinet") return;
    const ek = inspectorKey;
    const qty = promptTubeQty(ek);
    if (qty == null) return;
    const res = handlers?.onCabinetBottle?.(ek, qty);
    if (!res?.ok && res?.reason) alert(res.reason);
    closeInspector();
  });

  els.inspectBottleSellBtn?.addEventListener("click", () => {
    if (!inspectorKey) return;
    if (inspectorContext !== "cabinet") return;
    const ek = inspectorKey;
    const qty = promptTubeQty(ek);
    if (qty == null) return;
    const res = handlers?.onCabinetBottleSell?.(ek, qty);
    if (!res?.ok && res?.reason) alert(res.reason);
    closeInspector();
  });

  els.inspectDeleteBtn?.addEventListener("click", () => {
    if (!inspectorKey) return;
    handlers?.onDelete?.(inspectorKey);
    closeInspector();
  });

  // Hide inspector when the layout moves.
  window.addEventListener("scroll", () => {
    closeInspector();
    closeAttrInspector();
  }, true);
  window.addEventListener("resize", () => {
    if (inspectorKey) positionInspector();
    if (attrInspectorKey) positionAttrInspector();
  });


  // Gadgets section actions (Attributes panel)
  els.statsGrid?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.(".gadgetActionBtn");
    if (!btn) return;
    e.stopPropagation();
    const gk = btn.dataset?.key;
    const action = btn.dataset?.action;
    if (!gk || !action) return;
    if (action === "charge") handlers?.onGadgetCharge?.(gk);
    if (action === "upgrade") handlers?.onGadgetUpgrade?.(gk);
    renderStats();
    renderInspector();
  });

  // Attribute cards (open inspector) + training target crosshair
  els.statsGrid?.addEventListener("click", (e) => {
    // Crosshair toggle
    const cross = e.target?.closest?.(".trainTarget");
    if (cross){
      const k = cross.dataset?.train;
      if (k) setCombatTrainingTarget(k);
      renderStats();
      // If the attribute inspector is open for a combat stat, refresh it.
      if (attrInspectorKey) renderAttrInspector();
      e.stopPropagation();
      return;
    }

    // Combat stat cards
    const combat = e.target?.closest?.(".combatAttrItem");
    if (combat){
      const k = combat.dataset?.combat;
      if (k) openAttributePage(k);
      return;
    }

    // Skill cards (gathering/refining/crafting)
    const skill = e.target?.closest?.(".attrItem.expandable[data-attr]");
    if (skill){
      const k = skill.dataset?.attr;
      if (k) openAttributePage(k);
      return;
    }
  });

  // Player menu toggle
  els.playerMenuBtn?.addEventListener("click", () => {
    state.ui.playerMenuOpen = !state.ui.playerMenuOpen;
    handlers?.onPlayerMenuToggle?.(state.ui.playerMenuOpen);
    // Keep input synced when opening
    if (state.ui.playerMenuOpen && els.playerNameInput){
      els.playerNameInput.value = state.player.name ?? "";
    }
    renderPlayerMenu();
  });


	  // Settings button (opens the same Player menu)
	  els.settingsBtn?.addEventListener("click", () => {
	    state.ui.playerMenuOpen = !state.ui.playerMenuOpen;
	    handlers?.onPlayerMenuToggle?.(state.ui.playerMenuOpen);
	    if (state.ui.playerMenuOpen && els.playerNameInput){
	      els.playerNameInput.value = state.player.name ?? "";
	    }
	    renderPlayerMenu();
	  });

  // Breathe (oxygen regen buff)
  els.breatheBtn?.addEventListener("click", () => {
    const res = handlers?.onToggleBreathe?.();
    if (!res?.ok && res?.reason) alert(res.reason);
  });

  els.cabinetUnloadBtn?.addEventListener("click", () => {
    const res = handlers?.onCabinetUnload?.();
    if (!res?.ok && res?.reason) alert(res.reason);
  });

  // Distillery panel collapsibles
  els.distillerToggle?.addEventListener("click", () => {
    state.ui.distillerOpen = !(state.ui.distillerOpen ?? true);
    saveGame();
    renderDistilleryPanels();
  });
  els.cabinetToggle?.addEventListener("click", () => {
    state.ui.cabinetOpen = !(state.ui.cabinetOpen ?? true);
    saveGame();
    renderDistilleryPanels();
  });

  // Cabinet sort
  els.cabinetSort?.addEventListener("change", () => {
    state.ui.cabinetSort = els.cabinetSort.value;
    saveGame();
    renderDistilleryCabinet();
  });


  const commitPlayerName = () => {
    if (!els.playerNameInput) return;
    const res = setPlayerName(els.playerNameInput.value);
    if (!res.ok){
      alert(res.reason || "Invalid name.");
      els.playerNameInput.value = state.player.name ?? "";
      return;
    }
    saveGame();
    renderAll();
  };

  els.playerNameSaveBtn?.addEventListener("click", commitPlayerName);
  els.playerNameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commitPlayerName();
  });

  // Collapsible left panels (default open)
  els.statsToggle?.addEventListener("click", () => {
    const cur = (state.ui.statsPanelOpen ?? true);
    state.ui.statsPanelOpen = !cur;
    saveGame();
    renderLeftPanels();
  });
  els.historyToggle?.addEventListener("click", () => {
    const cur = (state.ui.historyPanelOpen ?? true);
    state.ui.historyPanelOpen = !cur;
    saveGame();
    renderLeftPanels();
  });
  els.quickToggle?.addEventListener("click", () => {
    const cur = (state.ui.quickPanelOpen ?? true);
    state.ui.quickPanelOpen = !cur;
    saveGame();
    renderLeftPanels();
  });
  els.scavengeToggle?.addEventListener("click", () => {
    const cur = (state.ui.scavengePanelOpen ?? true);
    state.ui.scavengePanelOpen = !cur;
    saveGame();
    renderLeftPanels();
  });
  els.invToggle?.addEventListener("click", () => {
    const cur = (state.ui.invPanelOpen ?? true);
    state.ui.invPanelOpen = !cur;
    saveGame();
    renderLeftPanels();
  });

  // Inventory page collapsibles (default open)
  els.equipToggle?.addEventListener("click", () => {
    const cur = (state.ui.invEquipOpen ?? true);
    state.ui.invEquipOpen = !cur;
    saveGame();
    renderInventoryPanels();
  });
els.toolbeltToggle?.addEventListener("click", () => {
  state.ui.invToolbeltOpen = !(state.ui.invToolbeltOpen ?? true);
  renderInventoryPanels();
});

  els.backpackToggle?.addEventListener("click", () => {
    const cur = (state.ui.invBackpackOpen ?? true);
    state.ui.invBackpackOpen = !cur;
    saveGame();
    renderInventoryPanels();
  });

// Sort dropdowns
els.invBackpackSort?.addEventListener("change", () => {
  state.ui.invBackpackSort = els.invBackpackSort.value;
  saveGame();
  renderAll();
});
els.storeBuySort?.addEventListener("change", () => {
  state.ui.storeBuySort = els.storeBuySort.value;
  saveGame();
  renderAll();
});
els.bpCatalogSort?.addEventListener("change", () => {
  state.ui.bpCatalogSort = els.bpCatalogSort.value;
  saveGame();
  renderAll();
});

// Mount game-styled sort chips (Store Buy + Distillery Cabinet)
try{
  mountSortChips(els.storeBuySort, els.storeBuySortChips);
  mountSortChips(els.cabinetSort, els.cabinetSortChips);
}catch(_){/* ignore */}

// A1 storekeeper (Store-only)
els.storeA1TalkBtn?.addEventListener("click", (e) => {
  try{ e.stopPropagation(); }catch(_){/* ignore */}
  a1StoreTalk();
});

els.storeA1UpgradesBtn?.addEventListener("click", (e) => {
  try{ e.stopPropagation(); }catch(_){/* ignore */}
  const panel = els.storeA1UpgradesPanel;
  if (!panel) return;
  const isOpen = panel.style.display !== "none";
  panel.style.display = isOpen ? "none" : "block";
  // Re-render the Store section so progress bars + buttons update instantly.
  try{ renderStore(); }catch(_){/* ignore */}
});

els.a1StorageUpgradeBtn?.addEventListener("click", (e) => {
  try{ e.stopPropagation(); }catch(_){/* ignore */}
  handlers?.onA1UpgradeStorage?.();
});
els.a1LinkUpgradeBtn?.addEventListener("click", (e) => {
  try{ e.stopPropagation(); }catch(_){/* ignore */}
  handlers?.onA1UpgradeLink?.();
});


  // "Gather All Unlocked" is enabled now that inventory overflow is handled.
  if (els.gatherAllBtn){
    els.gatherAllBtn.disabled = false;
    els.gatherAllBtn.title = "";
    els.gatherAllBtn.addEventListener("click", () => handlers?.onGatherAll?.());
  }
  els.collectAllBtn?.addEventListener("click", () => handlers?.onCollectAll?.());

  // NOTE: Don't add a second click handler here.
  // A previous version accidentally attached two handlers to the same button,
  // which toggled the menu open and then immediately closed it.

  // Nav
  els.navRow.innerHTML = "";
  pages.forEach(p => {
    const btn = document.createElement("button");
        btn.className = "navBtn";
    btn.dataset.page = p.id;
    btn.dataset.label = p.label;
    btn.setAttribute("aria-label", p.label);
    btn.setAttribute("title", p.label);
    btn.innerHTML = `<span class="icon">${p.icon}</span>`;
    btn.addEventListener("click", () => {
      handlers?.onNavigate?.(p.id);
    });
    els.navRow.appendChild(btn);
  });

  // Mini inventory: behaves like inventory slots (hover/click opens the inspector).
  // No click-to-navigate; the user requested the mini grid to be interactive instead.
  // Init mobile panes + wiki
  try{ renderMobilePanes(); }catch(_){/* ignore */}
  try{ syncWikiMount(); }catch(_){/* ignore */}
}

function renderPlayerMenu(){
  if (!els.playerMenu) return;
  const open = !!state.ui.playerMenuOpen;

  if (els.refund120Btn){
    const done = !!(state.flags && state.flags.refund120Done);
    els.refund120Btn.style.display = done ? "none" : "";
  }
  // Tailwind-only: hide/show settings area
  setShown(els.playerMenu, open, "block");
  els.playerMenu.setAttribute("aria-hidden", open ? "false" : "true");
  if (els.playerMenuBtn) els.playerMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");

  if (open && els.playerNameInput){
    // Don't clobber mid-typing if it's already focused
    if (document.activeElement !== els.playerNameInput){
      els.playerNameInput.value = state.player.name ?? "";
    }
  }

  // Avatar image in header
  if (els.playerAvatarImg){
    const a = avatarById(state.player.avatarId);
    els.playerAvatarImg.src = a.src;
    els.playerAvatarImg.alt = `${a.label} avatar`;
    if (a.focus) els.playerAvatarImg.style.objectPosition = a.focus;
  }

  // Build / refresh avatar grid
  if (els.avatarGrid){
    els.avatarGrid.innerHTML = "";
    try{ twOnce(els.avatarGrid, "grid gap-2"); }catch(_){/* ignore */}
    avatars.forEach(a => {
      const btn = document.createElement("button");
      btn.type = "button";
      const active = (state.player.avatarId === a.id);
      btn.className = "avatarOption";
      twAdd(btn, "w-full flex items-center gap-3 rounded-2xl border p-2 text-left shadow-sm hover:bg-slate-50 active:translate-y-px dark:hover:bg-slate-800 ");
      twAdd(btn, active ? "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900");
      // Tailwind styling (no custom CSS)
      twOnce(btn, "w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800");
      if (state.player.avatarId === a.id){
        twAdd(btn, "ring-2 ring-sky-200 dark:ring-sky-900/40");
      }
      btn.innerHTML = `
        <div class="avatarThumb h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"><img class="avatarImg h-full w-full object-cover" src="${a.src}" alt="${a.label}" style="object-position:${a.focus ?? "50% 50%"}" /></div>
        <div>
          <div class="avatarLabel">${a.label}</div>
          <div class="muted small">Select</div>
        </div>
      `;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers?.onSetAvatar?.(a.id);
      });
      els.avatarGrid.appendChild(btn);
    });
  }
}

function setActivePage(pageId){
  state.ui.activePage = pageId;
  const map = {
    story: els.pageStory,
    gathering: els.pageGathering,
    inventory: els.pageInventory,
    refining: els.pageRefining,
    blueprints: els.pageBlueprints,
    craft: els.pageCraft,
    store: els.pageStore,
    glossary: els.pageGlossary,
    attribute: els.pageAttribute
  };
  for (const [id, el] of Object.entries(map)){
    if (!el) continue;
    const isActive = (id === pageId);
    el.classList.toggle("active", isActive);
    // Tailwind-only visibility
    setShown(el, isActive, "block");
  }
  // nav active state
  [...els.navRow.querySelectorAll(".navBtn")].forEach(b => {
    const isActive = (b.dataset.page === pageId);
    b.classList.toggle("active", isActive);
    // Tailwind active tint
    b.classList.toggle("bg-slate-100", isActive);
    b.classList.toggle("dark:bg-slate-800", isActive);
  });

  // A1 storekeeper: pick a greeting each time the Store page is entered.
  if (pageId === "store"){
    try{ a1StoreOnEnter(); }catch(_){/* ignore */}
  }
}


function updateNavAlerts(){
  if (!els?.navRow) return;

  const anyReadyGather = nodes.some(n => {
    const st = handlers?.getNodeState?.(n.id);
    return !!st?.isReady;
  });

  const anyReadyRefine = Object.values(state.jobs?.refine ?? {}).some(j => (j?.endAt ?? 0) <= Date.now());
  const anyReadyCraft  = Object.values(state.jobs?.craft ?? {}).some(j => (j?.endAt ?? 0) <= Date.now());

  [...els.navRow.querySelectorAll(".navBtn")].forEach(btn => {
    const id = btn.dataset.page;
    const alert =
      (id === "gathering" && anyReadyGather) ||
      (id === "refining" && anyReadyRefine) ||
      (id === "craft" && anyReadyCraft);
    btn.classList.toggle("hasAlert", alert);
  });
}

function renderPinnedBadges(){
  if (!els.pinnedBadges) return;
  const slots = state.player.quickSlots ?? [];
  els.pinnedBadges.textContent = slots.map(k => thingByKey[k]?.symbol ?? k.toUpperCase()).join(" ");
}

function nodeCard(node, st, { showSpeeds=false, showPin=false } = {}){
  const card = document.createElement("div");
  card.className = "nodeCard";

  // Element-tinted cards (Gather + Quick Gather):
  // Use the same tier palette as item icons / inspectors.
  const elemTier = Number(thingByKey[node.resourceKey]?.tier) || Number(node.tier) || null;
  if (elemTier){
    card.classList.add("nodeCard--element", `tier-${elemTier}`);
  }

  const left = document.createElement("div");
  left.className = "nodeLeft";

  const subtitle = document.createElement("div");
  subtitle.className = "muted small nodeSubtitle";
  subtitle.dataset.jy = "subtitle";
  if (st.intervalId) subtitle.textContent = `Gathering… ${st.gathered}/${st.target}`;
  else if (st.isReady) subtitle.textContent = `Ready: ${st.gathered}`;
  else {
    // Idle: show the element's glossary tier (Stable/Reactive/...) as a colored pill.
    // This matches the tier pill styling used in the Inventory inspector.
    // elemTier computed above
    subtitle.textContent = "Idle";
    if (elemTier){
	    const badge = document.createElement("span");
	    // Smaller badge for list subtitles (Gather + Quick Gather)
	    badge.className = `tierBadge tierBadge--sm tier-${elemTier}`;
      badge.textContent = tierLabel(elemTier);
      subtitle.appendChild(badge);
    }
  }

  left.innerHTML = `<div><span class="label">${node.label}</span> <span class="badge">${thingByKey[node.resourceKey]?.symbol ?? ""}</span></div>`;
  left.appendChild(subtitle);

  const btns = document.createElement("div");
  btns.className = "nodeBtns";

  const gatherBtn = document.createElement("button");
  gatherBtn.textContent = "Gather";
  gatherBtn.disabled = !!st.intervalId || st.isReady;
  gatherBtn.addEventListener("click", () => handlers?.onGather?.(node.id));

  const collectBtn = document.createElement("button");
  collectBtn.textContent = "Collect";
  collectBtn.disabled = !st.isReady;
  collectBtn.classList.toggle("readyCollect", !!st.isReady);
  collectBtn.addEventListener("click", () => handlers?.onCollect?.(node.id));

  btns.appendChild(gatherBtn);
  btns.appendChild(collectBtn);

  if (showPin){
    const pinBtn = document.createElement("button");
    const pinned = (state.player.quickSlots ?? []).includes(node.resourceKey);
    pinBtn.type = "button";
    pinBtn.className = "pinBtn" + (pinned ? " pinned" : "");
    pinBtn.setAttribute("aria-pressed", pinned ? "true" : "false");
    pinBtn.title = pinned ? "Unpin from Quick Gather" : "Pin to Quick Gather";
    pinBtn.innerHTML = `<span class="pinIcon">📌</span>`;
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers?.onToggleQuick?.(node.resourceKey);
    });
    pinBtn.disabled = !pinned && (state.player.quickSlots ?? []).length >= 3;
    btns.appendChild(pinBtn);
  }

  card.appendChild(left);
  card.appendChild(btns);
  return card;
}

function renderQuickGather(){
  els.quickNodesList.innerHTML = "";
  const pinned = state.player.quickSlots ?? [];
  const pinnedNodes = nodesL1.filter(n => pinned.includes(n.resourceKey));

  if (pinnedNodes.length === 0){
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No pinned elements yet. Pin up to 3 from Gather.";
    els.quickNodesList.appendChild(empty);
    return;
  }

  pinnedNodes.forEach(n => {
    const st = handlers?.getNodeState?.(n.id);
    els.quickNodesList.appendChild(nodeCard(n, st));
  });
}

function renderMiniInventory(){
  return renderMiniInventoryImpl(getInventoryDeps());
}

function renderStory(){
  let node = story[state.currentNodeId];
  // Dev-only: allow previewing a wiki-written draft even if the node doesn't exist in canon.
  if (!node && isDevMode()){
    node = getDevStoryNode(state.currentNodeId);
  }
  if (!node){
    els.chapterLabel.textContent = "—";
    els.storyText.textContent = "Missing story node: " + state.currentNodeId;
    els.choices.innerHTML = "";
    if (els.storySceneImg){
      els.storySceneImg.removeAttribute("src");
      els.storySceneImg.classList.remove("breathe");
    }
    lastStoryTextRendered = null;
    return;
  }

  const inBattle = !!(state?.battle?.active);
  const inHub = (state.currentNodeId === "choose_adventure") && !inBattle;

  // The Story stage should always be visible at the top (even in the Hub).
  // Use the story-playing layout whenever the Story page is the active page.
  try{
    const isStoryActive = (state?.ui?.activePage === "story");
    document.body.classList.toggle("story-playing", isStoryActive);
    document.body.classList.toggle("story-focus", isStoryActive && !!state?.ui?.storyFocus);
  }catch(_){/* ignore */}

  // Story shell: stage is always visible; Hub content shows below it when inHub.
  // Hide the dialogue box while inHub (stage acts as a visual header).
  try{
    if (els?.storyHub) setShown(els.storyHub, inHub, "block");
    if (els?.storyPlay) setShown(els.storyPlay, true, "block");
    const dialog = document.querySelector('#pageStory .storyDialog');
    if (dialog) setShown(dialog, !inHub, "block");
    if (els?.storyBackBtn) els.storyBackBtn.hidden = inHub;
    if (els?.storyFocusBtn){
      const focusOn = !!state?.ui?.storyFocus;
      els.storyFocusBtn.textContent = focusOn ? "Exit Focus" : "Focus";
    }
  }catch(_){/* ignore */}


  els.chapterLabel.textContent = node.chapter ?? "—";

  // If a battle is active, the story window is temporarily a battle scene.
  if (inBattle){
    // Clear out story overlay content (hidden anyway) so nothing stale flashes.
    if (els.storyText) els.storyText.textContent = "";
    if (els.choices) els.choices.innerHTML = "";
    renderBattle();
    return;
  } else {
    // Ensure battle UI is not visible while reading story.
    if (els.battleWrap) {
      els.battleWrap.hidden = true;
      els.battleWrap.innerHTML = "";
    }
  }

  // -----------------------------
  // Story beats (click-to-advance)
  // -----------------------------
  const normalizeBeats = (raw) => {
    if (!Array.isArray(raw)) return null;
    const beats = raw.map(b => {
      if (typeof b === "string") return { speaker: null, text: b };
      if (b && typeof b === "object") return { speaker: b.speaker ?? null, text: String(b.text ?? "") };
      return { speaker: null, text: String(b ?? "") };
    }).filter(b => (b.text ?? "") !== "");
    return beats.length ? beats : null;
  };

  const getNodeBeats = () => {
    // Prefer explicit beats (doesn't change existing nodes)
    if (node.beats !== undefined){
      const raw = (typeof node.beats === "function") ? node.beats(state) : node.beats;
      return normalizeBeats(raw);
    }
    // Allow node.text to be an array (or a function returning an array) for convenience
    if (Array.isArray(node.text)) return normalizeBeats(node.text);
    if (typeof node.text === "function"){
      const res = node.text(state);
      if (Array.isArray(res)) return normalizeBeats(res);
    }
    return null;
  };

  const beats = getNodeBeats();
  // Reset beat cursor when entering a new node
  if (!state.ui) state.ui = {};
  if (state.ui.storyBeatNodeId !== state.currentNodeId){
    state.ui.storyBeatNodeId = state.currentNodeId;
    state.ui.storyBeatIndex = 0;
  }
  const beatIndex = Math.max(0, Math.floor(state.ui.storyBeatIndex ?? 0));
  const clampedBeatIndex = beats ? Math.min(beatIndex, beats.length - 1) : 0;
  if (beats) state.ui.storyBeatIndex = clampedBeatIndex;

  let storyText = "";
  let speakerName = null;
  if (beats){
    const b = beats[clampedBeatIndex];
    speakerName = b.speaker ?? null;
    storyText = b.text;
  } else {
    speakerName = node.speaker ?? null;
    storyText = (typeof node.text === "function") ? node.text(state) : (node.text ?? "");
  }

  // Fade between beats/text updates
  if (els.storyText){
    if (storyText !== lastStoryTextRendered){
      els.storyText.classList.add("is-fading");
      window.setTimeout(() => {
        els.storyText.textContent = storyText;
        els.storyText.classList.remove("is-fading");
        lastStoryTextRendered = storyText;
      }, 70);
    } else {
      els.storyText.textContent = storyText;
    }
  }

  if (els.storySpeaker){
    const name = speakerName ? String(speakerName) : "";
    if (name !== lastStorySpeakerRendered){
      els.storySpeaker.classList.add("is-fading");
      window.setTimeout(() => {
        els.storySpeaker.textContent = name;
        els.storySpeaker.classList.toggle("is-empty", !name);
        els.storySpeaker.classList.remove("is-fading");
        lastStorySpeakerRendered = name;
      }, 70);
    } else {
      els.storySpeaker.textContent = name;
      els.storySpeaker.classList.toggle("is-empty", !name);
    }
  }


  // ------------------------------------------
  // Visual Novel layers (BG / CG / Characters)
  // ------------------------------------------
  const bg = node.bg ?? node.scene ?? node.image ?? null;
  const cg = node.cg ?? null;

  // Normalize sprite paths so older content (vn/story subfolders) keeps working after refactors.
  const __fwmDetectBase__ = () => {
    const viteBase = (import.meta?.env?.BASE_URL);
    if (viteBase && viteBase !== "/") return viteBase;
    try{
      const p = String(window.location?.pathname || "/");
      const parts = p.split("/").filter(Boolean);
      if (parts.length >= 1) return `/${parts[0]}/`;
    }catch(_){/* ignore */}
    return "/";
  };
  const __FWM_BASE_URL__ = __fwmDetectBase__();
  const __fwmWithBase__ = (p) => {
    const s = String(p || "");
    if (!s) return s;
    if (/^(?:[a-z]+:)?\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) return s;
    let out = s.replace(/^\.\//, "");
    if (out.startsWith("/")) out = out.slice(1);
    return __FWM_BASE_URL__ + out;
  };
  const normalizeSpritePath = (p) => {
    const s = (p ?? "") ? String(p) : "";
    let out = s
      .replace("./assets/sprites/vn/", "./assets/sprites/")
      .replace("./assets/sprites/story/", "./assets/sprites/")
      .replace("/assets/sprites/vn/", "assets/sprites/")
      .replace("/assets/sprites/story/", "assets/sprites/");
    // Legacy Jackson filenames that may no longer exist
    out = out.replace(/assets\/sprites\/chars\/jackson\/(stern|neutral)\.png/ig, "assets/sprites/chars/jackson/jackson-resolve.png");
    return __fwmWithBase__(out);
  };

  // Background (reuses legacy #storySceneImg id)
  if (els.storySceneImg){
    const bgSrc = bg ? normalizeSpritePath(String(bg)) : "";
    if (bgSrc !== (lastStoryBgRendered ?? "")){
      els.storySceneImg.classList.add("vn-fade");
      window.setTimeout(() => {
        if (bgSrc) els.storySceneImg.src = bgSrc;
        else els.storySceneImg.removeAttribute("src");
        // Remove fade class on next tick so CSS transition can play
        window.requestAnimationFrame(() => els.storySceneImg.classList.remove("vn-fade"));
        lastStoryBgRendered = bgSrc;
      }, 20);
    } else {
      if (bgSrc) els.storySceneImg.src = bgSrc;
      else els.storySceneImg.removeAttribute("src");
    }
    els.storySceneImg.classList.toggle("breathe", (node.sceneAnim === "breathe"));
  }

  // Full-screen CG (optional)
  if (els.vnCgImg){
    const cgSrc = cg ? normalizeSpritePath(String(cg)) : "";
    if (cgSrc !== (lastStoryCgRendered ?? "")){
      els.vnCgImg.classList.add("vn-fade");
      window.setTimeout(() => {
        if (cgSrc) els.vnCgImg.src = cgSrc;
        else els.vnCgImg.removeAttribute("src");
        els.vnCgImg.classList.toggle("is-empty", !cgSrc);
        window.requestAnimationFrame(() => els.vnCgImg.classList.remove("vn-fade"));
        lastStoryCgRendered = cgSrc;
      }, 20);
    } else {
      if (cgSrc) els.vnCgImg.src = cgSrc;
      else els.vnCgImg.removeAttribute("src");
      els.vnCgImg.classList.toggle("is-empty", !cgSrc);
    }
  }

  // Character sprites (optional)
  const chars = Array.isArray(node.chars) ? node.chars : [];
  const pick = (pos) => chars.find(c => (c?.pos ?? "").toLowerCase() === pos);
  const leftC = pick("left");
  const centerC = pick("center");
  const rightC = pick("right");

  const speakerKey = (speakerName ?? "").toString().trim().toLowerCase();

  const applyChar = (imgEl, cfg, pos) => {
    if (!imgEl) return;
    let src = cfg?.src ? normalizeSpritePath(String(cfg.src)) : "";
    const id = (cfg?.id ?? cfg?.name ?? "").toString();
    const idKey = id.trim().toLowerCase();
    // Dialogue-triggered sprite overrides
    if (idKey === "jackson" && /stay behind me/i.test(String(storyText ?? ""))){
      src = "./assets/sprites/chars/jackson/jackson-resolve.png";
    }
    if (src){
      if (imgEl.getAttribute("src") !== src) imgEl.classList.add("vn-fade");
      imgEl.src = src;
    // Optional per-character scale / vertical offset
    const sc = (cfg && (typeof cfg.scale === "number")) ? cfg.scale : 1;
    const y = (cfg && (typeof cfg.y === "number")) ? cfg.y : 0;
    imgEl.style.setProperty("--vn-scale", String(sc));
    imgEl.style.setProperty("--vn-y", `${y}px`);
      imgEl.removeAttribute("aria-hidden");
      imgEl.classList.remove("is-empty");
      window.requestAnimationFrame(() => imgEl.classList.remove("vn-fade"));
    } else {
      imgEl.removeAttribute("src");
      imgEl.style.setProperty("--vn-scale", "1");
      imgEl.style.setProperty("--vn-y", "0px");
      imgEl.classList.add("is-empty");
      imgEl.setAttribute("aria-hidden","true");
    }
    imgEl.dataset.charId = id || pos;
    // Focus/dim based on speaker (best-effort match)
    const isSpeaking = !!(speakerKey && (speakerKey === idKey));
    imgEl.classList.toggle("is-speaking", isSpeaking);
    // If we have a speaker, dim non-speakers
    imgEl.classList.toggle("is-dim", !!(speakerKey && src && !isSpeaking));
  };

  applyChar(els.vnCharLeft, leftC, "left");
  applyChar(els.vnCharCenter, centerC, "center");
  applyChar(els.vnCharRight, rightC, "right");

  // Track changes (useful for debugging / future transitions)
  try{
    lastStoryCharsRendered = JSON.stringify({
      bg: bg ?? null,
      cg: cg ?? null,
      left: leftC?.src ?? null,
      center: centerC?.src ?? null,
      right: rightC?.src ?? null,
      speaker: speakerKey || null
    });
  }catch(_){ /* ignore */ }


  // Only show choices once the final beat is visible (or if the node has no beats)
  const canShowChoices = !beats || (clampedBeatIndex >= (beats.length - 1));
  const storyChoices = canShowChoices
    ? ((typeof node.choices === "function") ? node.choices(state) : (node.choices ?? []))
    : [];

  els.choices.innerHTML = "";
  storyChoices.forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "choiceBtn";
    // Optional image/icon inside the choice button (VN-style)
    if (choice.image){
      const icon = document.createElement("img");
      icon.className = "choiceIcon";
      icon.alt = "";
      icon.src = choice.image;
      btn.appendChild(icon);
    }
    const label = document.createElement("span");
    label.className = "choiceLabel";
    label.textContent = choice.text ?? "Continue";
    btn.appendChild(label);

    if (choice.requires){
      btn.disabled = !hasResources(choice.requires, { useCabinetForElements: true });
      const req = document.createElement("div");
      req.className = "choiceReq";
      req.textContent = "Requires: " + Object.entries(choice.requires).map(([k,v]) => `${labelFor(k)} ${v}`).join(", ");
      btn.appendChild(req);
    }

    btn.addEventListener("click", () => handlers?.onChoice?.(choice));
    els.choices.appendChild(btn);
  });

  // Chapters + Hub UI
  const chapterStatusFor = (ch) => {
    if (ch?.repeatable) return { label: "Repeatable", cls: "status--repeatable" };

    const activeKey = state?.ui?.activeChapterKey;
    const saved = state?.storyProgress?.chapters?.[ch?.key]?.status || "not_started";
    // If the player is currently in this chapter and it's not finished, treat as In Progress.
    const status = (activeKey === ch?.key && saved !== "finished") ? "in_progress" : saved;

    if (status === "finished") return { label: "Finished", cls: "status--finished" };
    if (status === "in_progress") return { label: "In Progress", cls: "status--inprogress" };
    return { label: "Not Started", cls: "status--notstarted" };
  };

  const computeContinueKey = () => {
    const activeKey = state?.ui?.activeChapterKey || null;
    if (activeKey){
      const st = state?.storyProgress?.chapters?.[activeKey]?.status || "not_started";
      if (st !== "finished") return activeKey;
    }
    // First unfinished non-repeatable chapter
    for (const ch of (chapters || [])){
      if (!ch || ch.repeatable) continue;
      const st = state?.storyProgress?.chapters?.[ch.key]?.status || "not_started";
      if (st !== "finished") return ch.key;
    }
    return (chapters && chapters[0]) ? chapters[0].key : null;
  };

  // Hub continue card (best-effort)
  if (inHub){
    const ck = computeContinueKey();
    const ch = ck ? chapters.find(c => c.key === ck) : null;
    try{
      if (els.storyContinueMeta){
        if (ch) els.storyContinueMeta.textContent = `${ch.title} • ${chapterStatusFor(ch).label}`;
        else els.storyContinueMeta.textContent = "Pick a chapter to begin.";
      }
      if (els.storyContinueBtn){
        els.storyContinueBtn.disabled = !ch;
        els.storyContinueBtn.dataset.chapterKey = ch?.key || "";
      }
    }catch(_){/* ignore */}
  }

  // Render chapter cards
  if (els?.chaptersList){
    els.chaptersList.innerHTML = "";
    (chapters || []).forEach(ch => {
      const st = chapterStatusFor(ch);

      const card = document.createElement("div");
      card.className = `chapterCard ${st.cls}`;

      const meta = document.createElement("div");
      meta.className = "chapterMeta";
      meta.innerHTML = `
        <span class="pill chapterType">${String(ch.type || "chapter").toUpperCase()}</span>
        <span class="pill statusPill ${st.cls}">${st.label.toUpperCase()}</span>
      `;

      const title = document.createElement("div");
      title.className = "chapterTitle";
      title.textContent = ch.title || ch.key || "Chapter";

      const desc = document.createElement("div");
      desc.className = "chapterDesc muted small";
      desc.textContent = ch.reward || "";

      const btnRow = document.createElement("div");
      btnRow.className = "chapterBtns";

      const open = document.createElement("button");
      open.className = "chapterOpen";
      open.type = "button";
      open.textContent = (st.cls === "status--inprogress") ? "RESUME" : "OPEN";
      open.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (handlers?.onOpenChapter) handlers.onOpenChapter(ch.key);
        else handlers?.onGotoNode?.(ch.startNodeId);
      });

      btnRow.appendChild(open);
      card.appendChild(meta);
      card.appendChild(title);
      if (ch.reward) card.appendChild(desc);
      card.appendChild(btnRow);

      els.chaptersList.appendChild(card);
    });
  }
}

function formatMMSS(ms){
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2,'0')}`;
}

function renderRepeatableEvents(){
  if (!els?.repeatableEventsList) return;
  const wrap = els.repeatableEventsList;
  wrap.innerHTML = "";

  const j = state.jobs?.junkyard;
  const t = Date.now();
  const endAt = Math.max(0, Math.floor(Number(j?.endAt) || 0));
  const isActive = !!j?.active && endAt > t;
  const isFinishing = !!j?.active && endAt > 0 && endAt <= t;
  const remaining = Math.max(0, endAt - t);

  const card = document.createElement("div");
  card.className = "nodeCard nodeCard--junkyard";
  card.dataset.jy = "card";
  card.classList.toggle("jy--active", isActive);
  card.classList.toggle("jy--finishing", isFinishing);
  card.classList.toggle("jy--ready", !isActive && !isFinishing);

  // Make the whole card the button (mouse + keyboard).
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.setAttribute("aria-label", "Scavenge in the Junkyard");

  const left = document.createElement("div");
  left.className = "nodeLeft";

  const title = document.createElement("div");
  title.className = "jyTitle";
  title.textContent = "The Junkyard";

  const meta = document.createElement("div");
  meta.className = "jyMeta";

  const dot = document.createElement("div");
  dot.className = "jyDot";
  dot.dataset.jy = "dot";
  dot.hidden = (isActive || isFinishing);

  const subtitle = document.createElement("div");
  subtitle.className = "muted small nodeSubtitle";
  subtitle.dataset.jy = "subtitle";

  // Countdown format: m.ss (e.g., 0.20)
  const formatMdotSS = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}.${String(r).padStart(2,'0')}`;
  };

  if (isActive){
    subtitle.textContent = `${formatMdotSS(remaining)}`;
  } else if (isFinishing){
    subtitle.textContent = "0.00";
  } else {
    subtitle.textContent = "";
  }

  meta.appendChild(dot);
  meta.appendChild(subtitle);

  const topRow = document.createElement("div");
  topRow.className = "jyTopRow";
  topRow.appendChild(title);
  topRow.appendChild(meta);

  left.innerHTML = "";
  left.appendChild(topRow);

  // Click behaviour:
  // - Idle/ready: start scavenging
  // - Active/finishing: shake feedback only
  const triggerShake = () => {
    card.classList.remove("jy--shake");
    // Force reflow so restarting the animation works.
    void card.offsetWidth;
    card.classList.add("jy--shake");
    window.setTimeout(() => card.classList.remove("jy--shake"), 260);
  };

  const onActivate = () => {
    const jj = state.jobs?.junkyard;
    const tt = Date.now();
    const ee = Math.max(0, Math.floor(Number(jj?.endAt) || 0));
    const activeNow = !!jj?.active && ee > tt;
    const finishingNow = !!jj?.active && ee > 0 && ee <= tt;

    if (activeNow || finishingNow){
      triggerShake();
      return;
    }

    const res = handlers?.onJunkyardScavenge?.();
    // If it failed, briefly surface the reason in the player status line.
    if (res && res.ok === false && res.reason){
      try{
        if (state?.player) state.player.status = String(res.reason);
      }catch(_){/* ignore */}
      renderAll();
    }
  };

  card.addEventListener("click", (e) => {
    // Prevent accidental text selection/drags.
    e.preventDefault();
    onActivate();
  });

  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " "){
      e.preventDefault();
      onActivate();
    }
  });

  card.appendChild(left);
  wrap.appendChild(card);
}

function renderGathering(){
  els.gatherNodesList.innerHTML = "";
  nodesL1.forEach(n => {
    const st = handlers?.getNodeState?.(n.id);
    els.gatherNodesList.appendChild(nodeCard(n, st, { showPin:true }));
  });
}

function renderInventoryPage(){
  return renderInventoryPageImpl(getInventoryDeps());
}


// -----------------------------
// General Store
// -----------------------------
function renderA1UpgradePanel(){
  return renderA1UpgradePanelImpl(getStoreDeps());
}

// A1: Transfer elements from the Distillery Cabinet into A1's upgrade bank.
// Uses the same in-game slider UI as Buy/Sell Multiple.
function openA1TransferModal(args){
  return openA1TransferModalImpl(getStoreDeps(), args);
}

function renderStore(){
  return renderStoreImpl(getStoreDeps());
}

function jobButtons(job, onStart, onCollect){
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "8px";
  wrap.style.alignItems = "center";

  if (!job){
    const start = document.createElement("button");
    start.textContent = "Start";
    start.addEventListener("click", onStart);
    wrap.appendChild(start);
    return wrap;
  }

  const msLeft = job.endAt - Date.now();
  const time = document.createElement("div");
  time.className = "muted small";
  time.textContent = msLeft > 0 ? `Working… ${formatTimeMs(msLeft)}` : "Done";

  const collect = document.createElement("button");
  collect.textContent = "Collect";
  collect.disabled = msLeft > 0;
  if (msLeft <= 0) collect.classList.add("readyCollect");
  collect.addEventListener("click", onCollect);

  wrap.appendChild(time);
  wrap.appendChild(collect);
  return wrap;
}

function renderRefining(){
  // Distillery page (formerly also contained a Refinery section).
  renderDistilleryPanels();
  renderDistiller();
  renderDistilleryCabinet();
  // Refinery UI removed: utilities (e.g., Test Tubes) live on the Craft page.
}

function renderDistilleryCabinet(){
  if (!els.distilleryCabinetGrid) return;
  els.distilleryCabinetGrid.innerHTML = "";

  const allowSet = new Set(ALLOWED_ELEMENTS_L1 || []);
  const all = (gatherables || []).slice();

  const sortMode = (state.ui.cabinetSort ?? "order");
  if (els.cabinetSort) els.cabinetSort.value = sortMode;
  try{ syncSortChips(els.cabinetSort); }catch(_){/* ignore */}

  const tierFor = (k, fallbackTier) => {
    const t = Number(thingByKey[k]?.tier) || Number(fallbackTier) || 6;
    return t;
  };
  const zFor = (sym) => {
    const z = PERIODIC_Z_BY_SYMBOL[String(sym || "")];
    return Number.isFinite(z) ? z : 9999;
  };

  all.sort((a,b) => {
    const ak = a.key, bk = b.key;
    const al = String(a.label || ak), bl = String(b.label || bk);
    const at = tierFor(ak, a.tier), bt = tierFor(bk, b.tier);

    if (sortMode === "name"){
      return al.localeCompare(bl);
    }
    if (sortMode === "tier"){
      // Stable → Singular (6 → 1)
      if (at !== bt) return bt - at;
      return al.localeCompare(bl);
    }
    if (sortMode === "rarity"){
      // Singular → Stable (1 → 6)
      if (at !== bt) return at - bt;
      return al.localeCompare(bl);
    }

    // order (periodic table)
    const az = zFor(a.symbol);
    const bz = zFor(b.symbol);
    if (az !== bz) return az - bz;
    return al.localeCompare(bl);
  });

  for (const el of all){
    const key = el.key;
    const tier = Number(thingByKey[key]?.tier) || Number(el.tier) || null;
    const cap = distilleryCapFor(key);
    const stored = distilleryStoredFor(key);

    const slot = document.createElement("div");
    slot.className = "slot";
    if (tier) slot.classList.add(`tier-${tier}`);

    const unlocked = allowSet.has(key);
    if (!unlocked){
      // Keep tier colors visible (no grayscale), but still read as locked.
      slot.classList.add("cabinetLocked");
      slot.title = "Locked element (not yet unlocked for gathering).";
    }

    slot.innerHTML = `
      <div class="slotTop">
        <div class="slotSymbol">${symbolFor(key)}</div>
        <div class="slotCount">${stored}/${cap}</div>
      </div>
    `;

    slot.addEventListener("click", () => {
      openInspector(key, slot, "cabinet");
    });

    els.distilleryCabinetGrid.appendChild(slot);
  }
}

function maxDistillableForScrap(scrapKey){
  const t = thingByKey[scrapKey] || {};
  const y = t.distillYield;
  if (!y || typeof y !== "object") return 0;
  const have = Math.max(0, Math.floor(Number(state.player?.inventory?.[scrapKey]) || 0));
  if (have <= 0) return 0;

  let max = have;
  for (const [ek0, a0] of Object.entries(y)){
    const ek = String(ek0);
    const per = Math.max(0, Math.floor(Number(a0) || 0));
    if (!per) continue;
    const cap = distilleryCapFor(ek);
    const stored = distilleryStoredFor(ek);
    const space = Math.max(0, cap - stored);
    max = Math.min(max, Math.floor(space / per));
  }
  if (!Number.isFinite(max)) max = 0;
  return Math.max(0, Math.floor(max));
}

function renderDistiller(){
  if (!els.distillerScrapGrid || !els.distillerKnownGrid) return;

  els.distillerScrapGrid.innerHTML = "";
  els.distillerKnownGrid.innerHTML = "";

  const known = Array.from(knownDistilledScraps?.() || []).filter(Boolean);
  known.sort((a,b) => String(labelFor(a)).localeCompare(String(labelFor(b))));

  // Known/remembered scraps (mini icons)
  for (const k of known){
    const t = thingByKey[k] || {};
    const tier = Number(t.tier) || null;
    const invCount = Math.max(0, Math.floor(Number(state.player?.inventory?.[k]) || 0));

    const slot = document.createElement("div");
    slot.className = "miniSlot";
    if (tier) slot.classList.add(`tier-${tier}`);
    if (invCount <= 0){
      // Avoid filtering/opacity on the whole tile (it can create halo/border artifacts
      // in light mode because it affects shadows and gradient edges). Instead, we
      // mute only the inner content via CSS.
      slot.classList.add("muted");
      slot.title = "Remembered. (None in inventory)";
    }
    slot.innerHTML = `
      <div class="miniContent">
        <div class="miniSymbol">${symbolFor(k)}</div>
      </div>
      <div class="miniCount">${invCount}</div>
      <div class="miniTier">${tier ? tierLabel(tier) : ""}</div>
    `;
    slot.addEventListener("click", () => openInspector(k, slot, "distiller"));
    els.distillerKnownGrid.appendChild(slot);
  }

  // Available scraps to distill (from inventory)
  const inv = state.player?.inventory || {};
  const available = Object.keys(inv)
    .filter(k => (Number(inv[k]) || 0) > 0)
    .filter(k => !!thingByKey[k]?.distillYield);
  available.sort((a,b) => String(labelFor(a)).localeCompare(String(labelFor(b))));

  if (els.distillerEmpty){
    els.distillerEmpty.style.display = (available.length === 0) ? "block" : "none";
  }

  for (const k of available){
    const t = thingByKey[k] || {};
    const tier = Number(t.tier) || null;
    const invCount = Math.max(0, Math.floor(Number(inv[k]) || 0));
    const max = maxDistillableForScrap(k);

    const slot = document.createElement("div");
    slot.className = "slot";
    if (tier) slot.classList.add(`tier-${tier}`);
    if (max <= 0){
      slot.style.opacity = "0.55";
      slot.title = "Cabinet full for at least one output element.";
    }
    slot.innerHTML = `
      <div class="slotTop">
        <div class="slotSymbol">${symbolFor(k)}</div>
        <div class="slotCount">${invCount}</div>
      </div>
      <div class="slotTier">${tier ? tierLabel(tier) : ""}</div>
    `;
    slot.addEventListener("click", () => openInspector(k, slot, "distiller"));
    els.distillerScrapGrid.appendChild(slot);
  }
}

function renderBlueprints(){
  // blueprint storage grid (16)
  els.bpSlotsGrid.innerHTML = "";
  const owned = state.player.blueprintsOwned ?? [];
  const cap = 16;
  for (let i=0;i<cap;i++){
    const slot = document.createElement("div");
    slot.className = "slot";
    if (owned[i]){
      const bp = blueprintCatalog.find(b => b.key === owned[i]);
      const tier = Number(thingByKey[bp?.itemKey]?.tier) || null;
      if (tier) slot.classList.add(`tier-${tier}`);
      slot.innerHTML = `
        <div class="slotTop">
          <div class="icon">🧩</div>
          <div class="count">1</div>
        </div>
        <div class="slotName">${bp?.label ?? owned[i]}</div>
      `;
    } else {
      slot.classList.add("is-empty");
      slot.innerHTML = "";
    }
    els.bpSlotsGrid.appendChild(slot);
  }
// Blueprint Library (all blueprints in code)
if (els.bpCatalogList){
  els.bpCatalogList.innerHTML = "";
  const ownedSet = new Set(state.player.blueprintsOwned ?? []);
  const bpSort = (state.ui.bpCatalogSort ?? "type");
  if (els.bpCatalogSort) els.bpCatalogSort.value = bpSort;

  const sortedBps = blueprintCatalog.slice().sort((a,b) => {
    const ta = thingByKey[a.itemKey] || {};
    const tb = thingByKey[b.itemKey] || {};
    if (bpSort === "tier"){
      const da = Number(ta.tier ?? 99);
      const db = Number(tb.tier ?? 99);
      if (da !== db) return da - db;
      return String(ta.label ?? a.itemKey).localeCompare(String(tb.label ?? b.itemKey));
    }
    if (bpSort === "name"){
      return String(ta.label ?? a.itemKey).localeCompare(String(tb.label ?? b.itemKey));
    }
    // type
    const ka = String(ta.kind ?? "");
    const kb = String(tb.kind ?? "");
    const oa = kindOrder(ka);
    const ob = kindOrder(kb);
    if (oa !== ob) return oa - ob;
    const na = String(ta.label ?? a.itemKey);
    const nb = String(tb.label ?? b.itemKey);
    if (na !== nb) return na.localeCompare(nb);
    return String(a.key).localeCompare(String(b.key));
  });

  sortedBps.forEach(bp => {
    const row = document.createElement("div");
    row.className = "itemRow";

    const left = document.createElement("div");
    left.style.flex = "1";
    const owned = ownedSet.has(bp.key);

    left.innerHTML = `
      <div class="itemLeft">
        <div class="icon">${symbolFor(bp.itemKey)}</div>
        <div>
          <div><span class="label">${thingByKey[bp.itemKey]?.label ?? bp.itemKey}</span> <span class="pill">${owned ? "OWNED" : "LOCKED"}</span></div>
          <div class="muted small">${bp.description}</div>
          <div class="muted small">Requires: ${Object.entries(bp.requires).map(([k,v]) => `${labelFor(k)} ${v}`).join(", ")}${bp.requiresTool ? ` • Tool: ${labelFor(bp.requiresTool)}` : ""}</div>
          <div class="muted small">Time: ${formatTimeMs(bp.durationMs)}</div>
        </div>
      </div>
    `;

    row.appendChild(left);
    els.bpCatalogList.appendChild(row);
  });
}

}


function renderCraft(){
  // Craft page: sectioned grids (Gear / Gadgets / Tools), styled like Store "Buy"
  if (!els.craftGearGrid || !els.craftGadgetsGrid || !els.craftToolsGrid) return;

  const owned = Array.isArray(state.player.blueprintsOwned) ? state.player.blueprintsOwned : [];

  const buckets = { gear: [], gadgets: [], tools: [] };
  for (const bpKey of owned){
    const bp = blueprintCatalog.find(b => b?.key === bpKey);
    if (!bp) continue;
    const t = thingByKey[bp.itemKey] || {};

    if (t.isGadget) buckets.gadgets.push(bp);
    else if ((t.kind || "") === "Tool") buckets.tools.push(bp);
    else buckets.gear.push(bp);
  }

  const sortBps = (arr) => arr.slice().sort((a,b) => {
    const ta = thingByKey[a.itemKey] || {};
    const tb = thingByKey[b.itemKey] || {};
    const at = Number(ta.tier) || 0;
    const bt = Number(tb.tier) || 0;
    if (at !== bt) return bt - at; // higher tier first
    return labelFor(a.itemKey).localeCompare(labelFor(b.itemKey));
  });

  buckets.gear = sortBps(buckets.gear);
  buckets.gadgets = sortBps(buckets.gadgets);
  buckets.tools = sortBps(buckets.tools);

  const renderBucket = (gridEl, emptyEl, list) => {
    gridEl.innerHTML = "";
    if (emptyEl) emptyEl.style.display = list.length ? "none" : "block";
    for (const bp of list){
      const key = bp.itemKey;
      const t = thingByKey[key] || {};
      const tier = Number(t.tier) || null;
      const job = getCraftJob(bp.key);

      const slot = document.createElement("div");
      slot.className = "slot storeSlot";
      if (tier) applyTierClass(slot, tier);

      // Status label (re-uses the Store's slotPrice styling)
      let status = "CRAFT";
      const alreadyBuilt = (bp.itemKey === "backpack_mk1" && state.player.upgrades?.backpack_mk1);
      const canStart = !alreadyBuilt && hasResources(bp.requires, { useCabinetForElements: true }) && (!bp.requiresTool || hasTool(bp.requiresTool));
      if (alreadyBuilt) status = "BUILT";
      else if (job){
        const remaining = Math.max(0, Math.floor((Number(job.endAt) || 0) - Date.now()));
        status = remaining <= 0 ? "COLLECT" : formatTimeMs(remaining);
      } else if (!canStart){
        status = "MISSING";
      }

      const isMissing = (status === "MISSING");
      if (isMissing){
        // Don't show the 'MISSING' label; instead visually lock the slot.
        status = "";
        slot.classList.add("isLocked");
      }

      slot.innerHTML = `
        ${status ? `<div class="slotPrice">${status}</div>` : ``}
        <div class="slotSymbol">${symbolFor(key)}</div>
      `;

      // Hover/tap inspector (craft context includes blueprint key)
      slot.addEventListener("mouseenter", () => openInspector(key, slot, `craft:${bp.key}`));
      slot.addEventListener("mouseleave", () => scheduleCloseInspector());
      slot.addEventListener("click", (e) => {
        e.stopPropagation();
        openInspector(key, slot, `craft:${bp.key}`);
      });

      gridEl.appendChild(slot);
    }
  };

  renderBucket(els.craftGearGrid, els.craftGearEmpty, buckets.gear);
  renderBucket(els.craftGadgetsGrid, els.craftGadgetsEmpty, buckets.gadgets);
  renderBucket(els.craftToolsGrid, els.craftToolsEmpty, buckets.tools);

  renderCraftUtilities();
}

function renderCraftUtilities(){
  if (!els.craftUtilitiesList) return;
  els.craftUtilitiesList.innerHTML = "";

  const r = refineRecipes.find(x => x && x.key === "test_tube");
  if (!r){
    if (els.craftUtilitiesEmpty) els.craftUtilitiesEmpty.style.display = "block";
    return;
  }
  if (els.craftUtilitiesEmpty) els.craftUtilitiesEmpty.style.display = "none";

  const row = document.createElement("div");
  row.className = "itemRow";

  const left = document.createElement("div");
  left.style.flex = "1";
  left.innerHTML = `
    <div class="itemLeft">
      <div class="icon">${symbolFor(r.key)}</div>
      <div>
        <div><span class="label">${r.label}</span> <span class="pill">Craft</span></div>
        <div class="muted small">${r.description}</div>
        <div class="muted small">Requires: ${Object.entries(r.requires).map(([k,v]) => `${labelFor(k)} ${v}`).join(", ")}</div>
        <div class="muted small">Produces: ${Object.entries(r.produces).map(([k,v]) => `${labelFor(k)} ${v}`).join(", ")} • Time: ${formatTimeMs(r.durationMs)}</div>
      </div>
    </div>
  `;

  const right = document.createElement("div");
  const job = getRefineJob(r.key);

  const btns = jobButtons(
    job,
    () => handlers?.onStartRefine?.(r.key),
    () => handlers?.onCollectRefine?.(r.key)
  );

  if (!job){
    const startBtn = btns.querySelector("button");
    if (startBtn) startBtn.disabled = !hasResources(r.requires, { useCabinetForElements: true }) || (r.requiresTool && !hasTool(r.requiresTool));
  }

  right.appendChild(btns);
  row.appendChild(left);
  row.appendChild(right);
  els.craftUtilitiesList.appendChild(row);
}

function renderStats(){
  return renderStatsImpl(getInventoryDeps());
}

function renderHistory(){
  return renderHistoryImpl(getInventoryDeps());
}


export function renderTickUI(){
  recoverUIRefsFromWindow();
  if (!els) return false;
  let did = false;

  // Breathe countdown: update button text/state without re-rendering the whole UI.
  if (els.breatheBtn){
    const b = state?.player?.breathe || {};
    const active = !!b.active && (Number(b.endAt) || 0) > Date.now();
    const msLeft = Math.max(0, (Number(b.endAt) || 0) - Date.now());

    const wantActive = !!active;
    if (els.breatheBtn.classList.contains("active") !== wantActive){
      els.breatheBtn.classList.toggle("active", wantActive);
      did = true;
    }

    const wantText = active ? (() => {
      const sec = Math.ceil(msLeft / 1000);
      const m = Math.floor(sec / 60);
      const s = String(sec % 60).padStart(2, "0");
      return `Breathing ${m}:${s}`;
    })() : "Breathe";

    if (els.breatheBtn.textContent !== wantText){
      els.breatheBtn.textContent = wantText;
      did = true;
    }
  }

  
// Junkyard countdown on the Quick Scavenge panel (left column).
// This panel is visible across pages, so keep it fresh regardless of the active page.
if (els.repeatableEventsList){
  const j = state.jobs?.junkyard;
  const t = Date.now();
  const endAt = Math.max(0, Math.floor(Number(j?.endAt) || 0));
  const isActive = !!j?.active && endAt > t;
  const isFinishing = !!j?.active && endAt > 0 && endAt <= t;
  const remaining = Math.max(0, endAt - t);

  const card = els.repeatableEventsList.querySelector('[data-jy="card"]');
  const sub = els.repeatableEventsList.querySelector('[data-jy="subtitle"]');
  const dot = els.repeatableEventsList.querySelector('[data-jy="dot"]');

  const formatMdotSS = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}.${String(r).padStart(2,'0')}`;
  };

  const subtitleText = isActive ? `${formatMdotSS(remaining)}` : (isFinishing ? "0.00" : "");

  if (sub && sub.textContent !== subtitleText){
    sub.textContent = subtitleText;
    did = true;
  }

  if (dot){
    const wantHidden = (isActive || isFinishing);
    if (!!dot.hidden !== !!wantHidden){
      dot.hidden = !!wantHidden;
      did = true;
    }
  }

  if (card){
    const wantActive = !!isActive;
    const wantFinishing = !!isFinishing;
    const wantReady = !wantActive && !wantFinishing;

    if (card.classList.contains("jy--active") !== wantActive){ card.classList.toggle("jy--active", wantActive); did = true; }
    if (card.classList.contains("jy--finishing") !== wantFinishing){ card.classList.toggle("jy--finishing", wantFinishing); did = true; }
    if (card.classList.contains("jy--ready") !== wantReady){ card.classList.toggle("jy--ready", wantReady); did = true; }
  }
}

// Store refresh countdown (keeps A1 card feeling alive without full re-render)
  if ((state?.ui?.activePage || "") === "store" && els.storeA1Subline){
    try{
      const st = getA1StoreUpgradeStatus();
      const left = Math.max(0, (Number(st.nextRefreshAt) || 0) - Date.now());
      const want = `Slots: ${st.capacity}/${st.maxCapacity} • Next refresh in ${fmtMsCompact(left)}`;
      if (els.storeA1Subline.textContent !== want){
        els.storeA1Subline.style.display = "block";
        els.storeA1Subline.textContent = want;
        did = true;
      }
    }catch(_){/* ignore */}
  }

  return did;
}

export function renderAll(){
  recoverUIRefsFromWindow();
  if (!els) return;
  // top left
  els.playerName.textContent = state.player.name;
  els.playerStatus.textContent = state.player.status;

  if (els.playerLevel){
    const lvl = Math.max(1, Math.floor(Number(state.player.level ?? 1)));
		    // Level badge keeps the pill styling, but displays the number only.
		    els.playerLevel.textContent = String(lvl);
  }
  // XP bar (progress within current level)
  if (els.xpText || els.xpFill){
    const lvl = Math.max(1, Math.min(LEVEL_CAP, state.player.level ?? 1));
    const xpTotal = Math.max(0, state.player.xp ?? 0);
    const curReq = LEVEL_XP_REQUIREMENTS[lvl] ?? 0;
    const nextLvl = Math.min(LEVEL_CAP, lvl + 1);
    const nextReq = LEVEL_XP_REQUIREMENTS[nextLvl] ?? curReq;

    if (lvl >= LEVEL_CAP || nextReq <= curReq){
      if (els.xpText) els.xpText.textContent = "MAX";
      if (els.xpFill) els.xpFill.style.width = "100%";
    } else {
      const gained = Math.max(0, xpTotal - curReq);
      const span = Math.max(1, nextReq - curReq);
      const pct = Math.max(0, Math.min(1, gained / span));
      if (els.xpText) els.xpText.textContent = `${gained}/${span}`;
      if (els.xpFill) els.xpFill.style.width = `${pct * 100}%`;
    }
  }

  if (els.hpText) els.hpText.textContent = `${state.player.hp ?? 100}/${state.player.maxHp ?? 100}`;
  if (els.hpFill){
    const max = Math.max(1, state.player.maxHp ?? 100);
    const hp = Math.max(0, Math.min(max, state.player.hp ?? max));
    const pct = Math.round((hp / max) * 100);
    els.hpFill.style.width = `${pct}%`;

    // HP bar color meaning:
    // 50–100% green, 20–49% yellow, 0–19% red
    els.hpFill.classList.remove("hpGood","hpWarn","hpDanger");
    // HP thresholds (canon): 0–19% low, 20–49% mid, 50–100% high
    if (pct <= 19) els.hpFill.classList.add("hpDanger");
    else if (pct <= 49) els.hpFill.classList.add("hpWarn");
    else els.hpFill.classList.add("hpGood");
  }

  // Oxygen bar (tied directly to the Distillery Cabinet oxygen container)
  if (els.oxygenText || els.oxygenFill || els.breatheBtn){
    const stored = distilleryStoredFor("o");
    const cap = Math.max(1, distilleryCapFor("o"));
    if (els.oxygenText) els.oxygenText.textContent = `${stored}/${cap}`;
    if (els.oxygenFill){
      const pct = Math.round((Math.max(0, Math.min(cap, stored)) / cap) * 100);
      els.oxygenFill.style.width = `${pct}%`;
    }

    // Breathe button text/state
    const b = state?.player?.breathe || {};
    const active = !!b.active && (Number(b.endAt) || 0) > Date.now();
    const msLeft = Math.max(0, (Number(b.endAt) || 0) - Date.now());
    if (els.breatheBtn){
      els.breatheBtn.classList.toggle("active", active);
      if (active){
        const sec = Math.ceil(msLeft / 1000);
        const m = Math.floor(sec / 60);
        const s = String(sec % 60).padStart(2, "0");
        els.breatheBtn.textContent = `Breathing ${m}:${s}`;
      } else {
        els.breatheBtn.textContent = "Breathe";
      }
    }
  }

  // keep avatar header + menu state in sync
  renderPlayerMenu();

  // Left-column collapsible panels
  renderLeftPanels();

  // Stats content
  renderStats();

  // History content
  renderHistory();

  // Inventory-page collapsibles
  renderInventoryPanels();

  if (els.saveStatus && state.lastSavedAt){
    const d = new Date(state.lastSavedAt);
    els.saveStatus.textContent = `Saved: ${d.toLocaleTimeString()}`;
  }
// active page
  setActivePage(state.ui.activePage);

  renderPinnedBadges();
  renderQuickGather();
  // Quick Scavenge (left column): repeatable activities (Junkyard)
  try{ renderRepeatableEvents(); }catch(_){/* ignore */}
  renderMiniInventory();
  updateNavAlerts();

  switch(state.ui.activePage){
    case "story": renderStory(); break;
    // Gathering UI is rendered every frame (Quick Scavenge panel in left column)
    // so the dedicated page doesn't need special rendering here.
    case "gathering": renderGathering(); break;
    case "inventory": renderInventoryPage(); break;
    case "refining": renderRefining(); break;
    case "blueprints": renderBlueprints(); break;
    case "craft": renderCraft(); break;
    case "store": renderStore(); break;
    case "attribute": renderAttributePage(); break;
    case "glossary": /* Wiki page */ break;
  }

  // Mobile panes + Wiki
  renderMobilePanes();
  syncWikiMount();

  // Global overlays
  renderLootModal();
  renderFaintModal();

  // Tailwind-only: style dynamic DOM (slots, rows)
  try{ applyTailwindDynamicSkin(); }catch(_){/* ignore */}
}


// -----------------------------
// Mobile panes (Menu / Game)
// -----------------------------

const MOBILE_BREAKPOINT = 980;
const PANE_ORDER = ["menu","game"];

function isMobileLayout(){
  try{
    return window.matchMedia && window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
  }catch(_){
    return false;
  }
}

function getActivePane(){
  if (!state.ui) state.ui = {};
  const cur = state.ui.mobilePane || "menu";
  if (!PANE_ORDER.includes(cur)) state.ui.mobilePane = "menu";
  return state.ui.mobilePane || "menu";
}

function setActivePane(id){
  if (!state.ui) state.ui = {};
  if (!PANE_ORDER.includes(id)) id = "menu";
  state.ui.mobilePane = id;
  saveGame();
  renderAll();
}

function cyclePane(dir){
  const cur = getActivePane();
  let idx = PANE_ORDER.indexOf(cur);
  idx = (idx + dir + PANE_ORDER.length) % PANE_ORDER.length;
  setActivePane(PANE_ORDER[idx]);
}

let _touchStartX = 0;
let _touchStartY = 0;
let _touching = false;

function initMobilePaneGestures(){
  if (!els?.paneGame) return;

  // Backup toggle button
  if (els.paneToggleBtn && !els.paneToggleBtn.dataset.bound){
    els.paneToggleBtn.dataset.bound = "1";
    els.paneToggleBtn.addEventListener("click", () => cyclePane(+1));
  }

  // Swipe gesture (horizontal)
  const target = document.body;
  if (!target || target.dataset.paneSwipeBound) return;
  target.dataset.paneSwipeBound = "1";

  target.addEventListener("touchstart", (e) => {
    if (!isMobileLayout()) return;
    const t = e.touches && e.touches[0];
    if (!t) return;

    // Avoid starting swipe on form controls.
    const el = e.target;
    if (el && el.closest && el.closest("input, textarea, select, button")) return;

    _touching = true;
    _touchStartX = t.clientX;
    _touchStartY = t.clientY;
  }, { passive:true });

  target.addEventListener("touchend", (e) => {
    if (!isMobileLayout()) return;
    if (!_touching) return;
    _touching = false;

    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - _touchStartX;
    const dy = t.clientY - _touchStartY;

    // Make it easy (not frantic), but avoid vertical scroll triggers.
    const THRESH = 55;
    const DOMINANCE = 1.8;

    if (Math.abs(dx) < THRESH) return;
    if (Math.abs(dx) < Math.abs(dy) * DOMINANCE) return;

    if (dx < 0) cyclePane(+1);
    else cyclePane(-1);
  }, { passive:true });

  // Resize -> re-apply pane classes
  if (!window.__FWM_PANE_RESIZE){
    window.__FWM_PANE_RESIZE = true;
    window.addEventListener("resize", () => renderMobilePanes());
  }
}

function renderMobilePanes(){
  if (!els?.paneMenu || !els?.paneGame) return;

  const mobile = isMobileLayout();
  try{ document.body.classList.toggle("mobilePanes", mobile); }catch(_){/* ignore */}

  // Apply desktop 'Focus Wiki' layout only while viewing the glossary page.
  try{
    const w = getWikiState();
    const onGlossary = (state?.ui?.activePage || "") === "glossary";
    document.body.classList.toggle("focusWiki", !mobile && onGlossary && !!w.focus);
  }catch(_){/* ignore */}

  const active = getActivePane();

  // Ensure gesture handlers exist
  initMobilePaneGestures();

  if (!mobile){
    els.paneMenu.classList.remove("isActive");
    els.paneGame.classList.remove("isActive");
    return;
  }

  const map = {
    menu: els.paneMenu,
    game: els.paneGame
  };
  for (const [id, el] of Object.entries(map)){
    if (!el) continue;
    el.classList.toggle("isActive", id === active);
  }

  // Dots
  if (els.paneDots){
    els.paneDots.innerHTML = "";
    PANE_ORDER.forEach(id => {
      const d = document.createElement("div");
      d.className = "paneDot" + (id === active ? " active" : "");
      d.title = id.toUpperCase();
      d.addEventListener("click", () => setActivePane(id));
      els.paneDots.appendChild(d);
    });
  }
}


// -----------------------------
// Wiki
// -----------------------------

let wikiRefs = null;
let wikiCurrentMd = "";
let wikiCurrentId = "";

// Render hygiene: avoid rebuilding the wiki DOM unless something actually changed.
let _wikiDirty = true;
let _wikiEverRendered = false;

// When the wiki FS is still loading, we need to re-render once it becomes ready.
// Previously a 1s global render loop masked this; now we do a targeted watcher to avoid 'Loading reference…' getting stuck.
let _wikiFsWatchTimer = null;
function ensureWikiFSWatch(){
  if (_wikiFsWatchTimer) return;
  _wikiFsWatchTimer = setInterval(() => {
    try{
      const fs = getWikiFSState();
      if (!fs) return;
      if (fs.status === 'ready' || fs.status === 'error'){
        clearInterval(_wikiFsWatchTimer);
        _wikiFsWatchTimer = null;
        markWikiDirty();
        // Only render if the wiki is actually hosted/visible.
        try{
          const mobile = isMobileLayout();
          const activePage = (state?.ui?.activePage || '');
          const onGlossary = activePage === 'glossary';
          const wantDesktopHost = !mobile && onGlossary;
          const wantMobileHost = mobile && ((state?.ui?.mobilePane || 'game') === 'wiki');
          if (wantDesktopHost || wantMobileHost){
            maybeRenderWiki(true);
          }
        }catch(_){
          try{ maybeRenderWiki(true); }catch(_){/* ignore */}
        }
      }
    }catch(_){/* ignore */}
  }, 60);
}


function markWikiDirty(){ _wikiDirty = true; }

function maybeRenderWiki(force=false){
  if (force || _wikiDirty || !_wikiEverRendered){
    renderWiki();
    _wikiEverRendered = true;
    _wikiDirty = false;
  }
}

// Dev-only: local draft wiki pages stored in localStorage.
// These never touch repo files and are intended for writing/testing while solo-devving.
const DEV_WIKI_PREFIX = "fwm_dev_wiki_page:";
const DEV_WIKI_SCENE_REG = "fwm_dev_draft_scenes"; // JSON array of ids

function devWikiKey(id){ return DEV_WIKI_PREFIX + String(id||""); }

function loadDevWikiRaw(id){
  try{
    if (!isDevMode()) return null;
    const raw = localStorage.getItem(devWikiKey(id));
    if (!raw) return null;
    return raw;
  }catch(_){ return null; }
}

function saveDevWikiRaw(id, raw){
  try{
    if (!isDevMode()) return { ok:false, reason: 'dev_off' };
    localStorage.setItem(devWikiKey(id), String(raw||""));
    return { ok:true };
  }catch(err){
    return { ok:false, reason: err?.message || String(err) };
  }
}

function removeDevWikiRaw(id){
  try{ localStorage.removeItem(devWikiKey(id)); return { ok:true }; }catch(err){ return { ok:false, reason: err?.message || String(err) }; }
}

function listDevWikiIds(prefix){
  try{
    if (!isDevMode()) return [];
    const out = [];
    for (let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if (!k || !k.startsWith(DEV_WIKI_PREFIX)) continue;
      const id = k.slice(DEV_WIKI_PREFIX.length);
      if (prefix && !String(id).startsWith(prefix)) continue;
      out.push(id);
    }
    out.sort();
    return out;
  }catch(_){ return []; }
}

function loadDevSceneRegistry(){
  try{
    const raw = localStorage.getItem(DEV_WIKI_SCENE_REG);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  }catch(_){ return []; }
}

function saveDevSceneRegistry(arr){
  try{ localStorage.setItem(DEV_WIKI_SCENE_REG, JSON.stringify(arr||[])); }catch(_){/* ignore */}
}

function parseFrontmatterLocal(md){
  const text = String(md || "");
  if (!text.startsWith("---")) return { meta: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end == -1) return { meta: {}, body: text };
  const fmRaw = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\r?\n/, "");
  const meta = {};
  const lines = fmRaw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++){
    const line = lines[i];
    const m = line.match(/^\s*([A-Za-z0-9_\-]+)\s*:\s*(.*)\s*$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2] ?? "";

    if (!v){
      const arr = [];
      let j = i + 1;
      while (j < lines.length){
        const l2 = lines[j];
        const li = l2.match(/^\s*-\s+(.+)\s*$/);
        if (!li) break;
        arr.push(li[1]);
        j++;
      }
      if (arr.length){
        meta[k] = arr;
        i = j - 1;
        continue;
      }
    }

    if (v.startsWith("[") && v.endsWith("]")){
      v = v.slice(1, -1).split(",").map(s => s.trim()).filter(Boolean);
      meta[k] = v;
      continue;
    }

    if (v === "true" || v === "false"){
      meta[k] = (v === "true");
      continue;
    }

    meta[k] = v;
  }
  return { meta, body };
}

function devWikiLoadPage(id){
  const rid = resolveWikiId(id);
  const raw = loadDevWikiRaw(rid);
  if (!raw) return null;
  const { meta, body } = parseFrontmatterLocal(raw);
  let title = (typeof meta.title === "string") ? meta.title.trim() : "";
  if (!title){
    const m = body.match(/^\s*#\s+(.+)\s*$/m);
    if (m) title = String(m[1] || "").trim();
  }
  if (!title) title = rid;
  return { id: rid, title, meta, md: body, raw };
}

function slugifyId(s){
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "scene";
}

function createDraftScene(){
  if (!isDevMode()){
    alert("Dev mode is off. Enable with ?dev=1 or Ctrl+Shift+D.");
    return;
  }
  const title = prompt("Draft scene title?", "");
  if (!title) return;
  const slug = slugifyId(title);
  const suggested = "draft_scene_" + slug;
  let id = prompt("Draft scene id (used for links + publish_scene nodeId)", suggested) || suggested;
  id = String(id || "").trim();
  if (!id) return;
  if (!/^[-a-zA-Z0-9_]+$/.test(id)){
    alert("Id can only use letters, numbers, underscore, and dash.");
    return;
  }
  if (!id.startsWith("draft_scene_")) id = "draft_scene_" + id;

  // Seed content (writer-first, minimal ceremony)
  const seed = [
    "---",
    "devOnly: true",
    "canon: false",
    "status: Drafting",
    "authority: Author",
    "---",
    "",
    `# ${title}`,
    "",
    "::chapter=",
    "::bg=",
    "",
    "(Write freely. Lines like 'Name: ...' become dialogue. Everything else is narration.)",
    "",
    "Jackson: ",
    "",
    "---",
    "",
    `{{publish_scene:${id}}}`,
    `{{clear_scene:${id}}}`,
  ].join("\n");

  const res = saveDevWikiRaw(id, seed);
  if (!res?.ok){
    alert(`Could not create draft: ${res?.reason || "unknown"}`);
    return;
  }

  const reg = loadDevSceneRegistry();
  if (!reg.includes(id)){
    reg.push(id);
    saveDevSceneRegistry(reg);
  }

  openWikiPage(id);
}

function createDraftPage(kind){
  if (!isDevMode()){
    alert("Dev mode is off. Enable with ?dev=1 or Ctrl+Shift+D.");
    return;
  }
  const defs = {
    context:   { prefix: "draft_ctx_",  label: "context page" },
    character: { prefix: "draft_char_", label: "character page" },
    world:     { prefix: "draft_world_",label: "worldbuilding page" },
  };
  const k = String(kind || "").trim().toLowerCase();
  const def = defs[k] || defs.context;

  const title = prompt(`Draft ${def.label} title?`, "");
  if (!title) return;
  const slug = slugifyId(title);
  const suggested = def.prefix + slug;
  let id = prompt("Draft id (used for links)", suggested) || suggested;
  id = String(id || "").trim();
  if (!id) return;
  if (!/^[-a-zA-Z0-9_]+$/.test(id)){
    alert("Id can only use letters, numbers, underscore, and dash.");
    return;
  }
  if (!id.startsWith(def.prefix)) id = def.prefix + id;

  const seed = [
    "---",
    "devOnly: true",
    "canon: false",
    "status: Drafting",
    "authority: Author",
    "---",
    "",
    `# ${title}`,
    "",
    "(Write freely. Saved locally in this browser while Dev Mode is on.)",
    "",
  ].join("\n");

  const res = saveDevWikiRaw(id, seed);
  if (!res?.ok){
    alert(`Could not create draft: ${res?.reason || "unknown"}`);
    return;
  }
  openWikiPage(id);
}

// Keep the dev editor stable across renderAll ticks.
// If we rebuild the editor DOM every tick, the textarea scroll position snaps back to top.
let _devWikiEditorMountedId = "";

function renderDevWikiEditor(id, opts){
  const options = opts || {};
  const refs = ensureWiki();
  const rid = resolveWikiId(id);

  // If we're already showing the editor for this same page, don't rebuild it.
  // This preserves textarea scroll position + selection + in-progress typing.
  try{
    if (!options.force && _devWikiEditorMountedId === rid){
      const existing = refs?.body?.querySelector?.(".wikiDevEditor");
      const ta = refs?.body?.querySelector?.(".wikiDevTextarea");
      if (existing && ta) return;
    }
  }catch(_){/* ignore */}

  const pack = devWikiLoadPage(rid);
  if (!pack){
    refs.body.innerHTML = "<p class=\"muted\">Missing dev draft.</p>";
    _devWikiEditorMountedId = "";
    return;
  }
  const raw = String(pack.raw || "");

  refs.body.innerHTML = `
    <div class="wikiDevEditor">
      <div class="wikiDevEditorTop">
        <div class="wikiDevEditorTitle">Editing: ${escapeHtml(pack.title)}</div>
        <div class="wikiDevEditorBtns">
          <button class="wikiSaveDevPageBtn" data-id="${escapeHtml(rid)}" type="button">Save</button>
          <button class="wikiCancelDevPageBtn" data-id="${escapeHtml(rid)}" type="button">Cancel</button>
        </div>
      </div>
      <textarea class="wikiDevTextarea" spellcheck="false">${escapeHtml(raw)}</textarea>
      <div class="wikiDevEditorFoot muted small">Saved locally in this browser (dev-only). Your repo files are untouched.</div>
    </div>
  `;

  _devWikiEditorMountedId = rid;
}
const WIKI_HOME_FALLBACK = "start_reference";

function getWikiState(){
  if (!state.ui) state.ui = {};
  if (!state.ui.wiki) state.ui.wiki = {};
  const w = state.ui.wiki;

  if (!w.pageId) w.pageId = WIKI_HOME_FALLBACK;
  if (typeof w.q !== "string") w.q = "";
  if (typeof w.cat !== "string") w.cat = "All";
  if (typeof w.focus !== "boolean") w.focus = false;
  if (typeof w.editingId !== "string") w.editingId = "";

  if (!w.openNodes || typeof w.openNodes !== "object") w.openNodes = {};
  if (!Array.isArray(w.hist)) w.hist = [w.pageId];
  if (typeof w.histIndex !== "number") w.histIndex = w.hist.length - 1;

  // Clamp
  if (w.histIndex < 0) w.histIndex = 0;
  if (w.histIndex > w.hist.length - 1) w.histIndex = w.hist.length - 1;
  w.pageId = w.hist[w.histIndex] || w.pageId || WIKI_HOME_FALLBACK;

  // If we have FS wiki loaded, ensure default expansions.
  try{
    const fs = getWikiFSState();
    if (fs?.status === "ready" && fs.nav?.length){
      // Expand first-level lists by default.
      fs.nav.forEach(top => {
        const key = String(top.id || top.title || "");
        if (!key) return;
        if (typeof w.openNodes[key] !== "boolean") w.openNodes[key] = true;
      });
    }
  }catch(_){/* ignore */}

  return w;
}

function wikiTitleFor(id){
  const rid = resolveWikiId(id);
  const dev = devWikiLoadPage(rid);
  if (dev?.title) return dev.title;
  const fs = getWikiFSState();
  if (fs?.status === "ready"){
    const meta = wikiFSGetPageMeta(rid);
    if (meta?.title) return meta.title;
  }
  return rid;
}

function wikiPageById(id){
  const rid = resolveWikiId(id);
  const dev = devWikiLoadPage(rid);
  if (dev){
    return { id: dev.id, title: dev.title, category: "Drafts", file: null, kind: "dev" };
  }
  const fs = getWikiFSState();
  if (fs?.status === "ready"){
    const meta = wikiFSGetPageMeta(rid);
    if (meta) return { id: meta.id, title: meta.title, category: meta.section, file: meta.file, kind: "md" };
  }
  return null;
}

function ensureWiki(){
  if (wikiRefs?.root) return wikiRefs;

  const rootEl = document.createElement("div");
  rootEl.id = "wikiApp";
  rootEl.className = "wikiApp";

  // Header (spans full width)
  const header = document.createElement("div");
  header.className = "wikiHeader";

  const headerTop = document.createElement("div");
  headerTop.className = "wikiHeaderTop";

  const back = document.createElement("button");
  back.className = "wikiBack";
  back.type = "button";
  back.textContent = "←";

  const title = document.createElement("div");
  title.className = "wikiTitle";
  title.textContent = "Reference";

  const focusBtn = document.createElement("button");
  focusBtn.className = "wikiFocusBtn";
  focusBtn.type = "button";
  focusBtn.textContent = "Expand";

  const sidebarToggle = document.createElement("button");
  sidebarToggle.className = "wikiSidebarToggle";
  sidebarToggle.type = "button";
  sidebarToggle.textContent = "List";

  const spacer = document.createElement("div");
  spacer.className = "wikiHeaderSpacer";

  const search = document.createElement("input");
  search.className = "wikiSearch";
  search.type = "search";
  search.placeholder = "Search reference…";
  search.autocomplete = "off";

  headerTop.appendChild(back);
  headerTop.appendChild(title);
  headerTop.appendChild(sidebarToggle);
  headerTop.appendChild(focusBtn);
  headerTop.appendChild(spacer);
  headerTop.appendChild(search);

  const cats = document.createElement("div");
  cats.className = "wikiCatRow";

  header.appendChild(headerTop);
  header.appendChild(cats);

  // Main area (sidebar + content)
  const main = document.createElement("div");
  main.className = "wikiMain";

  const sidebar = document.createElement("div");
  sidebar.className = "wikiSidebar";

  const list = document.createElement("div");
  list.className = "wikiList";
  sidebar.appendChild(list);

  const content = document.createElement("div");
  content.className = "wikiContent";

  const body = document.createElement("div");
  body.className = "wikiBody";
  content.appendChild(body);

  main.appendChild(sidebar);
  main.appendChild(content);

  rootEl.appendChild(header);
  rootEl.appendChild(main);

  wikiRefs = {
    root: rootEl,
    header,
    main,
    sidebar,
    search,
    cats,
    list,
    content,
    back,
    title,
    body,
    focusBtn,
    sidebarToggle
  };

  // Category chips
  function rebuildCats(){
    const w = getWikiState();
    cats.innerHTML = "";

    ensureWikiFSLoaded();
    let sections = wikiFSGetSections();
    // Hide dev-only categories unless dev mode is enabled.
    if (!isDevMode()) sections = (sections || []).filter(s => String(s) !== "Drafts");
    const all = ["All", ...sections];
    all.forEach(c => {
      const chip = document.createElement("div");
      chip.className = "wikiChip" + (w.cat === c ? " active" : "");
      chip.textContent = c;
      chip.addEventListener("click", () => {
        const ww = getWikiState();
        ww.cat = c;
        saveGame();
        renderWiki();
      });
      cats.appendChild(chip);
    });
  }

  // Search
  search.addEventListener("input", () => {
    const w = getWikiState();
    w.q = search.value || "";
    saveGame();
    renderWiki();
  });

  // Back
  back.addEventListener("click", () => {
    const w = getWikiState();
    if (w.histIndex <= 0) return;
    w.histIndex -= 1;
    w.pageId = w.hist[w.histIndex] || w.pageId;
    saveGame();
    renderWiki();
  });

  // Focus wiki (desktop only)
  focusBtn.addEventListener("click", () => {
    const w = getWikiState();
    w.focus = !w.focus;
    saveGame();
    // syncWikiMount applies the body class; renderWiki updates labels
    try{ syncWikiMount(); }catch(_){/* ignore */}
    renderWiki();
  });

  // Sidebar toggle (mobile landscape)
  sidebarToggle.addEventListener("click", () => {
    const w = getWikiState();
    w.sidebarOpen = !w.sidebarOpen;
    saveGame();
    renderWiki();
  });

  // Links inside body
  body.addEventListener("click", (e) => {
    const pub = e.target?.closest?.(".wikiPublishBtn");
    if (pub){
      e.preventDefault();
      e.stopPropagation();
      if (!isDevMode()){
        alert("Dev mode is off. Enable with ?dev=1 or Ctrl+Shift+D.");
        return;
      }
      const nodeId = String(pub.dataset.scene || "").trim();
      if (!nodeId){
        alert("Missing node id.");
        return;
      }
      const md = String(wikiCurrentMd || "");
      const res = saveDevStoryOverride(nodeId, md);
      if (!res?.ok){
        alert(`Could not publish draft: ${res?.reason || "unknown"}`);
        return;
      }
      // Jump straight into Story preview.
      try{
        state.currentNodeId = nodeId;
        if (!state.ui) state.ui = {};
        state.ui.activePage = "story";
        // Reset beats when swapping nodes
        state.ui.storyBeatNodeId = nodeId;
        state.ui.storyBeatIndex = 0;
        saveGame();
        renderAll();
      }catch(_){ /* ignore */ }
      return;
    }

    const clr = e.target?.closest?.(".wikiClearSceneBtn");
    if (clr){
      e.preventDefault();
      e.stopPropagation();
      if (!isDevMode()){
        alert("Dev mode is off. Enable with ?dev=1 or Ctrl+Shift+D.");
        return;
      }
      const nodeId = String(clr.dataset.scene || "").trim();
      if (!nodeId) return;
      const res = clearDevStoryOverride(nodeId);
      if (!res?.ok){
        alert(`Could not clear draft: ${res?.reason || "unknown"}`);
      } else {
        alert(`Cleared dev draft: ${nodeId}`);
      }
      return;
    }

    const createBtn = e.target?.closest?.(".wikiNewDraftSceneBtn");
    if (createBtn){
      e.preventDefault();
      e.stopPropagation();
      createDraftScene();
      return;
    }

    const newPageBtn = e.target?.closest?.(".wikiNewDraftPageBtn");
    if (newPageBtn){
      e.preventDefault();
      e.stopPropagation();
      const kind = String(newPageBtn.dataset.kind || "context");
      createDraftPage(kind);
      return;
    }

    const makeLocalBtn = e.target?.closest?.(".wikiMakeLocalOverrideBtn");
    if (makeLocalBtn){
      e.preventDefault();
      e.stopPropagation();
      if (!isDevMode()){
        alert("Dev mode is off. Enable with ?dev=1 or Ctrl+Shift+D.");
        return;
      }
      const id = String(makeLocalBtn.dataset.id || "").trim();
      if (!id) return;
      // Ensure we have the raw source, then fork it into a local override and open the editor.
      wikiFSLoadPage(id).then(pack => {
        const raw = String((pack && (pack.raw || pack.md)) || "");
        const res = saveDevWikiRaw(id, raw);
        if (!res?.ok){
          alert(`Could not create local override: ${res?.reason || "unknown"}`);
          return;
        }
        const w = getWikiState();
        w.editingId = resolveWikiId(id);
        saveGame();
        renderWiki();
      }).catch(err => {
        alert(`Could not load page source: ${err?.message || String(err)}`);
      });
      return;
    }

    const resetLocalBtn = e.target?.closest?.(".wikiResetLocalOverrideBtn");
    if (resetLocalBtn){
      e.preventDefault();
      e.stopPropagation();
      const id = String(resetLocalBtn.dataset.id || "").trim();
      if (!id) return;
      if (!confirm("Remove local override and return to the canonical wiki page?")) return;
      removeDevWikiRaw(id);
      renderWiki();
      return;
    }

    const editBtn = e.target?.closest?.(".wikiEditDevPageBtn");
    if (editBtn){
      e.preventDefault();
      e.stopPropagation();
      const id = String(editBtn.dataset.id || "").trim();
      if (id){
        const w = getWikiState();
        w.editingId = resolveWikiId(id);
        saveGame();
        renderWiki();
      }
      return;
    }

    const delBtn = e.target?.closest?.(".wikiDeleteDevPageBtn");
    if (delBtn){
      e.preventDefault();
      e.stopPropagation();
      const id = String(delBtn.dataset.id || "").trim();
      if (!id) return;
      if (!confirm(`Delete this local draft? (${id})`)) return;
      removeDevWikiRaw(id);
      // Remove from scene registry if present
      try{
        const reg = loadDevSceneRegistry().filter(x => x !== id);
        saveDevSceneRegistry(reg);
      }catch(_){/* ignore */}
      // After delete: if it was a scene draft, go back to the scenes list.
      // Otherwise, stay on this page (it will fall back to the canonical wiki page if it exists).
      try{
        const w = getWikiState();
        if (id.startsWith("draft_scene_")){
          w.pageId = "drafts_scene_list";
        }else{
          w.pageId = id;
        }
        w.hist = [w.pageId];
        w.histIndex = 0;
        saveGame();
      }catch(_){/* ignore */}
      renderWiki();
      return;
    }

    const saveBtn = e.target?.closest?.(".wikiSaveDevPageBtn");
    if (saveBtn){
      e.preventDefault();
      e.stopPropagation();
      const id = String(saveBtn.dataset.id || "").trim();
      const r = ensureWiki();
      const ta = r?.body?.querySelector?.(".wikiDevTextarea");
      const raw = ta ? String(ta.value || "") : "";
      if (id){
        const res = saveDevWikiRaw(id, raw);
        if (!res?.ok) alert(`Could not save: ${res?.reason || "unknown"}`);
        // Ensure it stays discoverable if it's a draft scene id
        try{
          if (id.startsWith("draft_scene_")){
            const reg = loadDevSceneRegistry();
            if (!reg.includes(id)){ reg.push(id); saveDevSceneRegistry(reg); }
          }
        }catch(_){/* ignore */}
      }
      try{ const w = getWikiState(); w.editingId = ""; saveGame(); }catch(_){/* ignore */}
      renderWiki();
      return;
    }

    const cancelBtn = e.target?.closest?.(".wikiCancelDevPageBtn");
    if (cancelBtn){
      e.preventDefault();
      e.stopPropagation();
      try{ const w = getWikiState(); w.editingId = ""; saveGame(); }catch(_){/* ignore */}
      renderWiki();
      return;
    }


    const link = e.target?.closest?.(".wikiLink");
    if (!link) return;
    const id = link.dataset.wiki;
    if (!id) return;
    openWikiPage(id);
  });

  // List clicks
  list.addEventListener("click", (e) => {
    const caret = e.target?.closest?.(".wikiCaret");
    if (caret){
      const w = getWikiState();
      const id = caret.dataset.id;
      if (!id) return;
      w.openNodes[id] = !w.openNodes[id];
      saveGame();
      renderWiki();
      return;
    }
    const row = e.target?.closest?.(".wikiItem");
    if (!row) return;
    const id = row.dataset.id;
    if (!id) return;
    openWikiPage(id);
  });

  rebuildCats();
  return wikiRefs;
}

function openWikiPage(id){
  const rid = resolveWikiId(id);
  const p = wikiPageById(rid);
  if (!p) return;
  const w = getWikiState();

  // Leaving editor when navigating
  w.editingId = "";

  // Trim forward history and push
  w.hist = w.hist.slice(0, w.histIndex + 1);
  w.hist.push(p.id);
  w.histIndex = w.hist.length - 1;
  w.pageId = p.id;

  saveGame();
  renderWiki();
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function wikiMarkdownToHTML(text){
  const cleaned = String(text || "").replace(/<!--[\s\S]*?-->/g, "");
  const lines = cleaned.split(/\r?\n/);
  let out = "";
  let inUl = false;
  let inQuote = false;
  let inCode = false;
  let codeBuf = [];
  let inTable = false;
  let tableHead = null;
  let tableRows = [];

  function closeUl(){
    if (inUl){ out += "</ul>"; inUl = false; }
  }

  function closeQuote(){
    if (inQuote){ out += "</blockquote>"; inQuote = false; }
  }

  function closeCode(){
    if (inCode){
      out += `<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`;
      inCode = false;
      codeBuf = [];
    }
  }

  
  function closeTable(){
    if (!inTable) return;
    // Build HTML table
    out += "<table class=\"wikiTable\">";
    if (tableHead && tableHead.length){
      out += "<thead><tr>";
      tableHead.forEach(c => { out += `<th>${inline(c)}</th>`; });
      out += "</tr></thead>";
    }
    out += "<tbody>";
    tableRows.forEach(r => {
      out += "<tr>";
      r.forEach(c => { out += `<td>${inline(c)}</td>`; });
      out += "</tr>";
    });
    out += "</tbody></table>";
    inTable = false;
    tableHead = null;
    tableRows = [];
  }
function inline(s){
    let h = escapeHtml(s);

    // internal links: [[id|Label]] or [[id]]
    h = h.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, id, label) => {
      const rid = resolveWikiId(id);
      return `<span class="wikiLink" data-wiki="${escapeHtml(rid)}">${escapeHtml(label)}</span>`;
    });
    h = h.replace(/\[\[([^\]]+)\]\]/g, (_, id) => {
      const rid = resolveWikiId(id);
      const label = wikiTitleFor(rid) || rid;
      return `<span class="wikiLink" data-wiki="${escapeHtml(rid)}">${escapeHtml(label)}</span>`;
    });

    // Tier badge macro: {{tier:6}} -> a colored pill (Stable/Reactive/etc).
    // Useful for compact lists (e.g., Items pages) without needing large tables.
    h = h.replace(/\{\{tier:(\d)\}\}/g, (_, t) => {
      const tier = Number(t);
      const label = (typeof tierLabel === "function") ? tierLabel(tier) : `Tier ${tier}`;
      return `<span class="tierBadge tier-${tier}">${escapeHtml(label)}</span>`;
    });

    // Auto-list macro: {{autolist:scraps}} or {{autolist:junkyard_scraps}}
    // Generates a compact list of wiki links with tier pills (kept in sync with in-game item data).
    h = h.replace(/\{\{autolist:([a-z0-9_]+)\}\}/gi, (_, listKey) => {
      const lk = String(listKey || "").toLowerCase();
      if (lk !== "scraps" && lk !== "junkyard_scraps") return "";
      try{
        // NOTE: `nodes` are element nodes, not item definitions. Use thingByKey (all item defs)
        // so the list always matches what is actually in the game.
        const all = Object.values(thingByKey || {});
        const items = all.filter(it => {
          const k = String(it?.key || "");
          if (!k.startsWith("scrap_")) return false;
          if (lk === "junkyard_scraps"){
            const f = String(it?.found || "").toLowerCase();
            return f.includes("junkyard");
          }
          return true;
        }).slice().sort((a,b) => String(a?.label||"").localeCompare(String(b?.label||"")));

        const lis = items.map(it => {
          const id = `item_${String(it?.key||"")}`;
          const label = String(it?.label || id);
          const tier = Number(it?.tier) || 0;
          const badge = tier ? `<span class="tierBadge tier-${tier}">${escapeHtml(typeof tierLabel === "function" ? tierLabel(tier) : `Tier ${tier}`)}</span>` : "";
          return `<li><span class="wikiLink" data-wiki="${escapeHtml(id)}">${escapeHtml(label)}</span> ${badge}</li>`;
        }).join("");
        return `<ul class="wikiAutoList">${lis}</ul>`;
      }catch(_){
        return "";
      }
    });

    // Dev-only: publish the *current wiki page markdown* as a draft Story node override.
    // Usage: {{publish_scene:my_node_id}}
    // In dev mode, clicking saves to localStorage (fwm_dev_scene:my_node_id) and jumps to it.
    h = h.replace(/\{\{publish_scene:([a-zA-Z0-9_\-]+)\}\}/g, (_, nodeId) => {
      const id = String(nodeId || "").trim();
      if (!id) return "";
      return `<button class="wikiPublishBtn" data-scene="${escapeHtml(id)}" type="button">Publish to Story (dev)</button>`;
    });
    // Dev-only: clear a published draft override
    // Usage: {{clear_scene:my_node_id}}
    h = h.replace(/\{\{clear_scene:([a-zA-Z0-9_\-]+)\}\}/g, (_, nodeId) => {
      const id = String(nodeId || "").trim();
      if (!id) return "";
      return `<button class="wikiClearSceneBtn" data-scene="${escapeHtml(id)}" type="button">Clear draft (dev)</button>`;
    });



    // Dev-only: draft helpers
    // - {{draft_scene_create}} adds a button to create a new local draft scene page.
    // - {{draft_scene_list}} auto-lists all local draft scenes (plus any registered file-based scenes under Drafts > Scenes).
    h = h.replace(/\{\{draft_scene_create\}\}/g, () => {
      if (!isDevMode()) return "";
      return `<button class="wikiNewDraftSceneBtn" type="button">New draft scene</button>`;
    });

    h = h.replace(/\{\{draft_scene_list\}\}/g, () => {
      if (!isDevMode()) return "";
      try{
        const reg = loadDevSceneRegistry();
        const discovered = listDevWikiIds("draft_scene_");
        const allIds = Array.from(new Set([...(reg||[]), ...(discovered||[])]));
        allIds.sort((a,b) => String(a).localeCompare(String(b)));

        // Also include any file-based draft scene pages registered in wiki/index.json under Drafts > Scenes.
        let fileIds = [];
        try{
          const pages = wikiFSListPages();
          fileIds = (pages||[]).filter(p => (p.parents||[]).includes("drafts_scenes") && p.id !== "drafts_scene_template" && p.id !== "drafts_scene_list").map(p => p.id);
        }catch(_){ fileIds = []; }

        const ids = Array.from(new Set([...(fileIds||[]), ...allIds]));
        ids.sort((a,b) => String(wikiTitleFor(a)).localeCompare(String(wikiTitleFor(b))));

        if (!ids.length){
          return `<div class="muted small">No draft scenes yet. Click <span class="label">New draft scene</span> to create one.</div>`;
        }

        const lis = ids.map(id => {
          const label = wikiTitleFor(id) || id;
          const isLocal = !!devWikiLoadPage(id);
          const tag = isLocal ? `<span class="wikiTinyTag">local</span>` : ``;
          return `<li><span class="wikiLink" data-wiki="${escapeHtml(id)}">${escapeHtml(label)}</span> ${tag}</li>`;
        }).join("");
        return `<ul class="wikiAutoList">${lis}</ul>`;
      }catch(_){
        return "";
      }
    });



    // Dev-only: general draft pages (context/character/world)
    // Usage:
    //  - {{draft_page_create:context}}
    //  - {{draft_page_list:context}}
    h = h.replace(/\{\{draft_page_create:([a-zA-Z0-9_-]+)\}\}/g, (_, kind) => {
      if (!isDevMode()) return "";
      const k = String(kind || "context").toLowerCase();
      const labels = { context:"New context page", character:"New character page", world:"New worldbuilding page" };
      const label = labels[k] || labels.context;
      return `<button class="wikiNewDraftPageBtn" data-kind="${escapeHtml(k)}" type="button">${escapeHtml(label)}</button>`;
    });

    h = h.replace(/\{\{draft_page_list:([a-zA-Z0-9_-]+)\}\}/g, (_, kind) => {
      if (!isDevMode()) return "";
      const k = String(kind || "context").toLowerCase();
      const prefixes = { context:"draft_ctx_", character:"draft_char_", world:"draft_world_" };
      const prefix = prefixes[k] || prefixes.context;
      try{
        const ids = listDevWikiIds(prefix);
        if (!ids.length) return `<div class="muted small">No drafts yet. Use the button above to create one.</div>`;
        const lis = ids.map(id => {
          const label = wikiTitleFor(id) || id;
          return `<li><span class="wikiLink" data-wiki="${escapeHtml(id)}">${escapeHtml(label)}</span> <span class="wikiTinyTag">local</span></li>`;
        }).join("");
        return `<ul class="wikiAutoList">${lis}</ul>`;
      }catch(_){
        return "";
      }
    });

    // bold **x**
    h = h.replace(/\*\*([^*]+)\*\*/g, '<span class="label">$1</span>');

    // inline code `x`
    h = h.replace(/`([^`]+)`/g, "<code>$1</code>");

    return h;
  }

  for (let li = 0; li < lines.length; li++){
    const raw = lines[li];
    const line = raw.trimEnd();

    // fenced code
    if (/^\s*```/.test(line)){
      if (inCode){
        closeCode();
      }else{
        closeTable();
        closeUl();
        closeQuote();
        inCode = true;
        codeBuf = [];
      }
      continue;
    }
    if (inCode){
      codeBuf.push(raw.replace(/\r$/, ""));
      continue;
    }

    // blockquote
    if (/^\s*>\s?/.test(line)){
      closeTable();
      closeUl();
      if (!inQuote){ out += "<blockquote>"; inQuote = true; }
      out += `<p>${inline(line.replace(/^\s*>\s?/, ""))}</p>`;
      continue;
    }else{
      closeQuote();
    }

    // headings
    if (/^\s*#\s+/.test(line)){
      closeTable();
      closeUl();
      out += `<h1>${inline(line.replace(/^\s*#\s+/, ""))}</h1>`;
      continue;
    }

    if (/^\s*###\s+/.test(line)){
      closeTable();
      closeUl();
      out += `<h3>${inline(line.replace(/^\s*###\s+/,""))}</h3>`;
      continue;
    }
    if (/^\s*##\s+/.test(line)){
      closeTable();
      closeUl();
      out += `<h2>${inline(line.replace(/^\s*##\s+/,""))}</h2>`;
      continue;
    }
    
    // tables
    const isTableSeparator = (s) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(s || "");
    const splitTableRow = (s) => {
      let t = String(s || "").trim();
      if (t.startsWith("|")) t = t.slice(1);
      if (t.endsWith("|")) t = t.slice(0, -1);
      return t.split("|").map(x => x.trim());
    };

    // Start a table if we see a header row + separator row.
    if (!inTable && line.includes("|") && isTableSeparator(lines[li + 1] || "")){
      closeUl();
      closeQuote();
      tableHead = splitTableRow(line);
      inTable = true;
      li++; // skip separator row
      continue;
    }

    // If we're in a table, consume rows until a non-row line.
    if (inTable){
      if (line.includes("|")){
        tableRows.push(splitTableRow(line));
        continue;
      } else {
        closeTable();
        // fall through to handle this line as normal markdown
      }
    }
if (/^\s*-\s+/.test(line)){
      closeTable();
      if (!inUl){ out += "<ul>"; inUl = true; }
      out += `<li>${inline(line.replace(/^\s*-\s+/,""))}</li>`;
      continue;
    }

    if (line.trim() === ""){
      closeTable();
      closeUl();
      continue;
    }

    closeTable();
    closeUl();
    out += `<p>${inline(line)}</p>`;
  }

  closeTable();
  closeUl();
  closeQuote();
  closeCode();
  return out;
}

function renderWikiList(){
  const refs = ensureWiki();
  const w = getWikiState();

  const currentId = resolveWikiId(w.pageId || WIKI_HOME_FALLBACK);

  if (refs.search && refs.search.value !== w.q) refs.search.value = w.q;

  const q = (w.q || "").trim().toLowerCase();
  const cat = w.cat || "All";

  ensureWikiFSLoaded();
  const fs = getWikiFSState();
  if (fs?.status !== 'ready') ensureWikiFSWatch();

  function rowFor(id, title, depth = 0, hasChildren = false){
    const row = document.createElement("div");
    row.className = "wikiItem wikiTreeItem" + (resolveWikiId(id) === currentId ? " active" : "");
    row.dataset.id = id;
    row.style.paddingLeft = `${12 + depth * 14}px`;

    if (hasChildren){
      const caret = document.createElement("span");
      caret.className = "wikiCaret" + (w.openNodes[id] ? " open" : "");
      caret.dataset.id = id;
      caret.textContent = w.openNodes[id] ? "▾" : "▸";
      row.appendChild(caret);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "wikiCaretSpacer";
      spacer.textContent = "";
      row.appendChild(spacer);
    }

    const t = document.createElement("div");
    t.className = "wikiItemTitle";
    t.textContent = title;
    row.appendChild(t);
    return row;
  }

  function addSectionHeader(label){
    const h = document.createElement("div");
    h.className = "wikiSectionHeader";
    h.textContent = label;
    refs.list.appendChild(h);
  }

  function renderTree(nodes, depth){
    (nodes || []).forEach(n => {
      if (n && n.hidden) return;
      if (n && n.devOnly && !isDevMode()) return;
      const id = String(n.id || "");
      const title = String(n.title || id);
      const children = Array.isArray(n.children) ? n.children : [];
      const hasChildren = children.length > 0;
      refs.list.appendChild(rowFor(id, title, depth, hasChildren));
      if (hasChildren && w.openNodes[id]){
        renderTree(children, depth + 1);
      }
    });
  }

  refs.list.innerHTML = "";

  if (fs?.status === "ready"){
    // Search view: flat results.
    if (q){
      let pages = wikiFSListPages();
      if (cat !== "All") pages = pages.filter(p => p.section === cat);
      if (!isDevMode()) pages = pages.filter(p => !p.devOnly);

      pages = pages.filter(p => {
        const cached = fs.pageCache?.get(p.id);
        const tags = Array.isArray(cached?.meta?.tags) ? cached.meta.tags.join(" ") : String(cached?.meta?.tags || "");
        const body = cached?.md || "";
        const hay = `${p.title} ${tags} ${body}`.toLowerCase();
        return hay.includes(q);
      });

      pages.sort((a,b) => String(a.title).localeCompare(String(b.title)));
      pages.forEach(p => refs.list.appendChild(rowFor(p.id, p.title, 0, false)));

      if (!pages.length){
        const empty = document.createElement("div");
        empty.className = "muted small";
        empty.textContent = "No pages match that search.";
        refs.list.appendChild(empty);
      }
    } else {
      // Structured view
      if (cat === "All"){
        (fs.nav || []).forEach(top => {
          if (top && top.devOnly && !isDevMode()) return;
          addSectionHeader(String(top.title || top.id || "Section"));
          renderTree(top.children || [], 0);
        });
      } else {
        const top = (fs.nav || []).find(n => String(n.title || n.id) === cat);
        if (top){
          renderTree(top.children || [], 0);
        }
      }
    }
  } else {
    const msg = document.createElement("div");
    msg.className = "muted small";
    msg.textContent = (fs?.status === "error")
      ? "Wiki failed to load (see console)."
      : "Loading reference…";
    refs.list.appendChild(msg);
  }

  // Update cat chip active states
  if (refs.cats){
    [...refs.cats.querySelectorAll(".wikiChip")].forEach(ch => {
      ch.classList.toggle("active", ch.textContent === cat);
    });
  }
}

let _wikiInflight = new Map();

function renderWikiPage(){
  const refs = ensureWiki();
  const w = getWikiState();

  ensureWikiFSLoaded();
  const fs = getWikiFSState();
  if (fs?.status !== 'ready') ensureWikiFSWatch();

  const rid = resolveWikiId(w.pageId || WIKI_HOME_FALLBACK) || WIKI_HOME_FALLBACK;
  const fsMode = (fs?.status === "ready") && wikiFSHas(rid);
  const p = wikiPageById(rid) || wikiPageById(WIKI_HOME_FALLBACK);

  // Keep state normalized once FS is ready.
  if (w.pageId !== rid){
    w.pageId = rid;
    // Also update history entries.
    try{ w.hist = (w.hist || []).map(x => resolveWikiId(x)); }catch(_){/* ignore */}
  }

  refs.back.disabled = w.histIndex <= 0;
  refs.title.textContent = p?.title || "Reference";

  // DEV EDIT MODE: keep the editor open across re-renders (renderAll ticks)
  try{
    if (!isDevMode()){
      if (w.editingId) w.editingId = "";
      _devWikiEditorMountedId = "";
    }else{
      if (w.editingId && w.editingId !== rid){
        w.editingId = "";
        saveGame();
      }
      if (w.editingId && w.editingId === rid){
        const pack = devWikiLoadPage(rid);
        if (pack){
          renderDevWikiEditor(rid);
          return;
        } else {
          w.editingId = "";
          saveGame();
        }
      }
      if (!w.editingId) _devWikiEditorMountedId = "";
    }
  }catch(_){/* ignore */}


  // Focus button (desktop only)
  if (refs.focusBtn){
    const mobile = isMobileLayout();
    refs.focusBtn.style.display = mobile ? "none" : "";
    // If layout and state ever drift (e.g. hash routing/reloads), prefer the
    // mounted layout class so the label stays correct.
    let focused = !!w.focus;
    try{
      const onGlossary = (state?.ui?.activePage || "") === "glossary";
      if (!mobile && onGlossary){
        const cls = document.body.classList.contains("focusWiki");
        if (cls !== focused){
          focused = cls;
          w.focus = focused;
          saveGame();
        }
      }
    }catch(_){/* ignore */}

    refs.focusBtn.textContent = focused ? "Collapse" : "Expand";
    refs.focusBtn.setAttribute("aria-pressed", focused ? "true" : "false");
    refs.focusBtn.classList.toggle("active", focused);
  }

  if (!p){
    if (fs?.status === "error"){
      refs.body.innerHTML = "<p class=\"muted\">Wiki failed to load. Check the console for details.</p>";
    }else{
      refs.body.innerHTML = "<p class=\"muted\">Loading reference…</p>";
    }
    return;
  }

  // Dev-only local draft pages
  if (p?.kind === "dev"){
    const dev = devWikiLoadPage(rid);
    if (!dev){
      refs.body.innerHTML = "<p class=\"muted\">Missing dev draft.</p>";
      return;
    }

    wikiCurrentId = rid;
    wikiCurrentMd = String(dev.md || "");

    const fm = dev.meta || {};
    const badges = [];
    badges.push({ label: "Dev Draft", cls: "dev" });
    if (fm.canon === true) badges.push({ label: "Canon", cls: "canon" });
    if (typeof fm.authority === "string" && fm.authority.trim()) badges.push({ label: `Authority: ${fm.authority.trim()}`, cls: "authority" });
    if (typeof fm.status === "string" && fm.status.trim()) badges.push({ label: `Status: ${fm.status.trim()}`, cls: "status" });

    let metaHtml = "";
    metaHtml += `<div class=\"wikiDevBar\">`
            + `<button class=\"wikiEditDevPageBtn\" data-id=\"${escapeHtml(rid)}\" type=\"button\">Edit draft</button>`
            + `<button class=\"wikiDeleteDevPageBtn\" data-id=\"${escapeHtml(rid)}\" type=\"button\">Delete</button>`
            + `</div>`;

    if (badges.length){
      metaHtml += `<div class=\"wikiMeta\"><div class=\"wikiBadges\">`;
      badges.forEach(b => {
        metaHtml += `<span class=\"wikiBadge ${escapeHtml(b.cls)}\">${escapeHtml(b.label)}</span>`;
      });
      metaHtml += `</div></div>`;
    }

    refs.title.textContent = dev.title || refs.title.textContent;
    refs.body.innerHTML = metaHtml + wikiMarkdownToHTML(dev.md || "");
    return;
  }

  // FS-backed markdown pages
  if (fsMode){
    const cached = fs.pageCache?.get(rid);
    if (!cached){
      refs.body.innerHTML = "<p class=\"muted\">Loading…</p>";
      if (!_wikiInflight.has(rid)){
        _wikiInflight.set(rid, true);
        wikiFSLoadPage(rid).then(() => {
          _wikiInflight.delete(rid);
          // Re-render only if still on that page
          try{ if (resolveWikiId(getWikiState().pageId) === rid) renderWiki(); }catch(_){ renderWiki(); }
        }).catch(err => {
          _wikiInflight.delete(rid);
          console.warn("Failed to load wiki page", rid, err);
          if (resolveWikiId(getWikiState().pageId) === rid){
            refs.body.innerHTML = `<p class=\"muted\">Failed to load this page.</p><pre><code>${escapeHtml(err?.message || String(err))}</code></pre>`;
          }
        });
      }
      return;
    }

    // Track current markdown for dev publish buttons.
    wikiCurrentId = rid;
    wikiCurrentMd = String(cached.md || "");

    // Render wiki metadata (canon, status, intent) above the page body.
    const fm = cached.meta || {};
    const badges = [];
    if (fm.canon === true) badges.push({ label: "Canon", cls: "canon" });
    if (typeof fm.authority === "string" && fm.authority.trim()) badges.push({ label: `Authority: ${fm.authority.trim()}`, cls: "authority" });
    if (typeof fm.status === "string" && fm.status.trim()) badges.push({ label: `Status: ${fm.status.trim()}`, cls: "status" });
    if (Array.isArray(fm.tone_tags) && fm.tone_tags.length) badges.push({ label: `Tone: ${fm.tone_tags.join(", ")}`, cls: "tone" });

    let devBarHtml = "";
    if (isDevMode()){
      devBarHtml = `<div class="wikiDevBar">`
        + `<button class="wikiMakeLocalOverrideBtn" data-id="${escapeHtml(rid)}" type="button">Edit locally</button>`
        + `<span class="muted small">Local override only (this browser). Repo files stay untouched.</span>`
        + `</div>`;
    }

    let metaHtml = devBarHtml;
    const hasIntent = Array.isArray(fm.design_intent) && fm.design_intent.length;
    const hasConstraints = Array.isArray(fm.constraints) && fm.constraints.length;
    if (badges.length || hasIntent || hasConstraints){
      metaHtml += `<div class="wikiMeta">`;
      if (badges.length){
        metaHtml += `<div class="wikiBadges">`;
        badges.forEach(b => {
          metaHtml += `<span class="wikiBadge ${escapeHtml(b.cls)}">${escapeHtml(b.label)}</span>`;
        });
        metaHtml += `</div>`;
      }
      if (hasIntent){
        metaHtml += `<div class="wikiMetaBlock"><div class="wikiMetaTitle">Design intent</div><ul>`;
        fm.design_intent.forEach(x => { metaHtml += `<li>${escapeHtml(String(x))}</li>`; });
        metaHtml += `</ul></div>`;
      }
      if (hasConstraints){
        metaHtml += `<div class="wikiMetaBlock"><div class="wikiMetaTitle">Constraints</div><ul>`;
        fm.constraints.forEach(x => { metaHtml += `<li>${escapeHtml(String(x))}</li>`; });
        metaHtml += `</ul></div>`;
      }
      metaHtml += `</div>`;
    }

    let html = metaHtml + wikiMarkdownToHTML(cached.md || "");

    // Append auto-generated tables for data-driven pages.
    if (rid === "items_elements"){
      const rows = (gatherables || []).map(g => {
        const tier = findabilityTierFor(g.symbol);
        return { symbol: g.symbol, name: g.label, tierLabel: tierLabel(tier), tier };
      }).sort((a,b) => b.tier - a.tier || a.symbol.localeCompare(b.symbol));

      html += "<hr class=\"wikiHr\"/>";
      html += "<h2>Current data</h2>";
      html += "<p class=\"muted small\">Auto-generated from the game’s element definitions.</p>";
      html += "<table class=\"wikiTable\"><thead><tr><th>Symbol</th><th>Name</th><th>Tier</th></tr></thead><tbody>";
      rows.forEach(r => {
        html += `<tr><td><code>${escapeHtml(r.symbol)}</code></td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.tierLabel)}</td></tr>`;
      });
      html += "</tbody></table>";
    }

    if (rid === "systems_tiers"){
      const byTier = {1:[],2:[],3:[],4:[],5:[],6:[]};
      periodicTable.forEach(e => {
        const t = findabilityTierFor(e.symbol);
        byTier[t].push(e);
      });

      html += "<hr class=\"wikiHr\"/>";
      html += "<h2>Current data</h2>";
      html += "<p class=\"muted small\">Auto-generated from the element tier mapping.</p>";
      [6,5,4,3,2,1].forEach(tier => {
        const title = tierLabel(tier);
        const elems = (byTier[tier] || []).map(e => e.symbol).join(", ");
        html += `<h3>${escapeHtml(title)}</h3>`;
        html += `<p><span class=\"muted small\">Examples:</span> ${escapeHtml(elems || "—")}</p>`;
      });
    }

    if (rid === "systems_minion_loot_pool"){
      const pool = (LOOTPOOLS && LOOTPOOLS["vulkraine_minion"]) ? LOOTPOOLS["vulkraine_minion"] : null;
      if (pool){
        html += "<hr class=\"wikiHr\"/>";
        html += "<h2>Current data</h2>";
        html += "<p class=\"muted small\">Auto-generated from the game’s minion loot pool.</p>";

        html += "<h3>Slot distribution</h3>";
        html += "<table class=\"wikiTable\"><thead><tr><th>Min</th><th>Max</th><th>P(2 slots)</th><th>P(3 slots)</th></tr></thead><tbody>";
        html += `<tr><td>${escapeHtml(pool.slots?.min ?? "—")}</td><td>${escapeHtml(pool.slots?.max ?? "—")}</td><td>${escapeHtml(pool.slots?.p2 ?? "—")}</td><td>${escapeHtml(pool.slots?.p3 ?? "—")}</td></tr>`;
        html += "</tbody></table>";

        html += "<h3>Rare rolls</h3>";
        html += "<table class=\"wikiTable\"><thead><tr><th>Reward</th><th>Type</th><th>Chance</th><th>Notes</th></tr></thead><tbody>";
        (pool.rare || []).forEach(r => {
          const label = labelFor(r.key) || r.key;
          const note = r.bp ? `Blueprint: ${r.bp}` : (r.note || "");
          html += `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(r.type || "")}</td><td>${escapeHtml(r.chance)}</td><td>${escapeHtml(note)}</td></tr>`;
        });
        html += "</tbody></table>";

        html += "<h3>Common slots</h3>";
        html += "<table class=\"wikiTable\"><thead><tr><th>Resource</th><th>Weight</th><th>Qty</th><th>Notes</th></tr></thead><tbody>";
        (pool.common || []).forEach(r => {
          const label = labelFor(r.key) || r.key;
          const qty = Array.isArray(r.qty) ? `${r.qty[0]}–${r.qty[1]}` : (r.qty ?? "");
          html += `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(r.weight)}</td><td>${escapeHtml(qty)}</td><td>${escapeHtml(r.note || "")}</td></tr>`;
        });
        html += "</tbody></table>";
      }
    }

    refs.body.innerHTML = html;
    return;
  }

  // FS is ready but this page isn't found.
  refs.body.innerHTML = "<p class=\"muted\">Missing page.</p>";
}

function renderWiki(){
  const refs = ensureWiki();
  const w = getWikiState();
  const isLandscapeMobile = (() => {
    try{
      return window.matchMedia && window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px) and (orientation: landscape)`).matches;
    }catch(_){
      return false;
    }
  })();

  if (isLandscapeMobile && typeof w.sidebarOpen !== "boolean"){
    w.sidebarOpen = false;
    saveGame();
  }

  if (refs?.root){
    const closed = isLandscapeMobile ? (w.sidebarOpen === false) : false;
    refs.root.classList.toggle("wikiSidebarClosed", closed);
  }

  if (refs?.sidebarToggle){
    const label = (isLandscapeMobile && w.sidebarOpen === false) ? "Show List" : "Hide List";
    refs.sidebarToggle.textContent = label;
  }

  renderWikiList();
  renderWikiPage();
  _wikiEverRendered = true;
  _wikiDirty = false;
}

function syncWikiMount(){
  const refs = ensureWiki();
  if (!refs?.root) return;

  const activePage = (state?.ui?.activePage || "");
  const onGlossary = activePage === "glossary";

  // Determine whether the wiki DOM should be actively hosted in a pane.
  // - Desktop/mobile: only on the Glossary page.
  const wantDesktopHost = onGlossary;
  const wantMobileHost = false;

  // Desktop Focus Wiki: make the wiki occupy both columns (left + right).
  // This is a layout mode (CSS-driven), not a modal overlay.
  try{
    const w = getWikiState();
    document.body.classList.toggle("focusWiki", wantDesktopHost && !!w.focus);
  }catch(_){/* ignore */}

  if (els.wikiDesktopMount && !onGlossary){
    els.wikiDesktopMount.innerHTML = "";
  }

  // Choose host for the real wiki DOM.
  const host = wantMobileHost ? els.wikiMobileMount : (wantDesktopHost ? els.wikiDesktopMount : null);
  if (host && refs.root.parentElement !== host){
    host.innerHTML = "";
    host.appendChild(refs.root);
    // Host changed; render once.
    markWikiDirty();
  }

  // Only render the wiki when it is actually visible as an interactive surface.
  if (wantDesktopHost || wantMobileHost){
    maybeRenderWiki(false);
  }
}
