
import { gatherables, materials, items, thingByKey, ALLOWED_ELEMENTS_L1, isAllowedElementKey, filledTubeKeyForElementKey, FILLED_TUBE_GRAMS, FILLED_TUBE_PREFIX } from "../../data/items/store.js";
import { blueprintByKey, refineByKey, refineRecipes, blueprintCatalog } from "../../data/items/blueprints.js";

// All element keys currently defined in the game data.
// (Not all are unlocked for Gathering yet, but the Distillery Cabinet can still track them.)
const ALL_ELEMENT_KEYS = (gatherables || []).map(g => g.key);


function looksLikeElementKey(key){
  return /^[a-z]{1,2}$/.test(String(key));
}
function filterDisallowedElements(obj){
  const out = {};
  for (const [k,v] of Object.entries(obj ?? {})){
    // Treat any known element key as an element (don't rely on the 1–2 letter regex).
    // This keeps the system compatible with future "alien" element keys.
    if (isKnownElementKey(k) && !isAllowedElementKey(k)) continue;
    out[k] = v;
  }
  return out;
}
function resourcesContainDisallowedElements(obj){
  return Object.keys(obj ?? {}).some(k => isKnownElementKey(k) && !isAllowedElementKey(k));
}

function isKnownElementKey(key){
  return ALL_ELEMENT_KEYS.includes(String(key));
}


function stripToolRequirements(req){
  const out = { ...req };
  for (const k of Object.keys(out)){
    if (String(k).startsWith('tool_')) delete out[k];
  }
  return out;
}
export const SAVE_KEY = "fun_with_matter_save_v13_rs";

// -----------------------------
// LEVELING
// Total XP required to reach each level (total XP thresholds).
// Lv 1 starts at 0 XP. Cap at Lv 99.
// Thresholds: "XP for levels.txt" (project table).
// -----------------------------
export const LEVEL_CAP = 99;
// Design rule: the player starts at HP level 10 (max HP == HP level).
// We treat the XP required for this starting level as a baseline that should
// NOT contribute to the derived overall player level.
export const MIN_STARTING_HP_LEVEL = 10;
export const LEVEL_XP_REQUIREMENTS = {
  1: 0,
  2: 83,
  3: 174,
  4: 276,
  5: 388,
  6: 512,
  7: 650,
  8: 801,
  9: 969,
  10: 1154,
  11: 1358,
  12: 1584,
  13: 1833,
  14: 2107,
  15: 2411,
  16: 2746,
  17: 3115,
  18: 3523,
  19: 3973,
  20: 4470,
  21: 5018,
  22: 5624,
  23: 6291,
  24: 7028,
  25: 7842,
  26: 8740,
  27: 9730,
  28: 10824,
  29: 12031,
  30: 13363,
  31: 14833,
  32: 16456,
  33: 18247,
  34: 20224,
  35: 22406,
  36: 24815,
  37: 27473,
  38: 30408,
  39: 33648,
  40: 37224,
  41: 41171,
  42: 45529,
  43: 50339,
  44: 55649,
  45: 61512,
  46: 67983,
  47: 75127,
  48: 83014,
  49: 91721,
  50: 101333,
  51: 111945,
  52: 123660,
  53: 136594,
  54: 150872,
  55: 166636,
  56: 184040,
  57: 203254,
  58: 224466,
  59: 247886,
  60: 273742,
  61: 302288,
  62: 333804,
  63: 368599,
  64: 407015,
  65: 449428,
  66: 496254,
  67: 547953,
  68: 605032,
  69: 668051,
  70: 737627,
  71: 814445,
  72: 899257,
  73: 992895,
  74: 1096278,
  75: 1210421,
  76: 1336443,
  77: 1475581,
  78: 1629200,
  79: 1798808,
  80: 1986068,
  81: 2192818,
  82: 2421087,
  83: 2673114,
  84: 2951373,
  85: 3258594,
  86: 3597792,
  87: 3972294,
  88: 4385776,
  89: 4842295,
  90: 5346332,
  91: 5902831,
  92: 6517253,
  93: 7195629,
  94: 7944614,
  95: 8771558,
  96: 9684577,
  97: 10692629,
  98: 11805606,
  99: 13034431,
};

// -----------------------------
// DERIVED TIERS (Refine/Craft)
// Materials and crafted items inherit tier from the "best" ingredient used.
// In our tier scheme, Tier 1 is rare/high-quality and Tier 6 is common.
// So the inherited tier is the MIN (best) tier number among ingredients.
// -----------------------------
function isTierNumber(x){
  const n = Number(x);
  return Number.isFinite(n) && n >= 1 && n <= 6;
}

function deriveTierFromRequires(requires, visiting){
  const tiers = [];
  for (const k of Object.keys(requires || {})){
    const t = getTierForKey(k, visiting);
    if (isTierNumber(t)) tiers.push(t);
  }
  // default to Tier 6 (Stable) if unknown
  return tiers.length ? Math.min(...tiers) : 6;
}

function getTierForKey(key, visiting = new Set()){
  const t0 = thingByKey?.[key];
  if (isTierNumber(t0?.tier)) return Number(t0.tier);

  // prevent cycles
  if (visiting.has(key)) return 6;
  visiting.add(key);

  // Refine output tier (recipe key == output key)
  const rr = refineByKey?.(key);
  if (rr){
    const tier = deriveTierFromRequires(rr.requires, visiting);
    if (t0) t0.tier = tier;
    visiting.delete(key);
    return tier;
  }

  // Crafted item tier (blueprint produces itemKey)
  const bp = blueprintCatalog?.find?.(b => b.itemKey === key) || null;
  if (bp){
    const tier = deriveTierFromRequires(bp.requires, visiting);
    if (t0) t0.tier = tier;
    visiting.delete(key);
    return tier;
  }

  visiting.delete(key);
  return isTierNumber(t0?.tier) ? Number(t0.tier) : null;
}

function applyDerivedTiers(){
  // Refine outputs
  for (const r of (refineRecipes || [])){
    const outKeys = Object.keys(r.produces || {});
    for (const ok of outKeys){
      const tier = deriveTierFromRequires(r.requires, new Set([ok]));
      if (thingByKey[ok]) thingByKey[ok].tier = tier;
    }
  }
  // Crafted items
  for (const b of (blueprintCatalog || [])){
    const itemKey = b.itemKey;
    if (!itemKey) continue;
    const tier = deriveTierFromRequires(b.requires, new Set([itemKey]));
    if (thingByKey[itemKey]) thingByKey[itemKey].tier = tier;
  }
}

// Run once at module load so UI can use tiers immediately.
applyDerivedTiers();

export function levelFromXp(totalXp){
  const xp = Math.max(0, Number(totalXp) || 0);
  let lvl = 1;
  for (let i = 2; i <= LEVEL_CAP; i++){
    if (xp >= (LEVEL_XP_REQUIREMENTS[i] ?? Infinity)) lvl = i;
  }
  return lvl;
}

export function addXp(amount){
  const add = Math.max(0, Math.floor(Number(amount) || 0));
  state.player.xp = Math.max(0, (state.player.xp ?? 0) + add);
  const newLvl = levelFromXp(state.player.xp);
  const leveledUp = newLvl > (state.player.level ?? 1);
  state.player.level = newLvl;
  return { gained: add, leveledUp, level: newLvl, xp: state.player.xp };
}

// -----------------------------
// ATTRIBUTES
// Each attribute levels independently, using the same total XP thresholds as player level.
// Attribute "value" == its level.
// -----------------------------
// Attributes currently in use.
// Each attribute levels independently using the same XP thresholds as player level.
// Combat + progression attributes (left column).
// These level independently using the same XP thresholds as the player.
export const ATTRIBUTE_KEYS = [
  "distillery",
];

export function addAttributeXp(attrKey, amount){
  if (!ATTRIBUTE_KEYS.includes(attrKey)) return { ok:false, reason:"Unknown attribute." };
  const add = Math.max(0, Number(amount) || 0);
  if (!state.player.attributes) state.player.attributes = {};
  if (!state.player.attributes[attrKey]) state.player.attributes[attrKey] = { xp: 0, level: 1 };

  const a = state.player.attributes[attrKey];
  const prevLevel = Math.max(1, Math.floor(Number(a.level) || 1));
  a.xp = Math.max(0, (a.xp ?? 0) + add);
  const newLvl = Math.min(LEVEL_CAP, levelFromXp(a.xp));
  const leveledUp = newLvl > prevLevel;
  a.level = newLvl;

  // Overall player level is derived from total XP (skills + active character combat stats).
  // Keep it in sync whenever any attribute XP changes.
  recomputePlayerOverallLevel();

  return { ok:true, gained:add, leveledUp, level:newLvl, prevLevel, xp:a.xp, key: attrKey };
}

// -----------------------------
// Inventory slot cap (derived)
// Base cap is 16.
// Inventory slots can be increased by equipped bags (e.g. Backpack Mk.I) via
// their `effect.inventorySlots` field.
// NOTE: older saves/builds used `state.player.upgrades.backpack_mk1`; we keep
// that as a legacy flag so old saves still benefit.
export function getInventorySlotCap(){
  const base = 16;
  const eq = state.player?.equipment ?? {};

  // Bonus from any equipped "bag" items.
  let bagBonus = 0;
  for (const slot of Object.keys(eq)){
    if (!/^bag\d+$/.test(slot)) continue;
    const k = eq[slot];
    if (!k) continue;
    const t = thingByKey?.[String(k)];
    const add = Number(t?.effect?.inventorySlots) || 0;
    if (add > 0) bagBonus += add;
  }

  // Legacy support: if an older save toggled this upgrade flag, keep applying it
  // unless the player is already receiving the equivalent bonus from an equipped bag.
  const legacyBackpackBonus = (state.player?.upgrades?.backpack_mk1 && bagBonus <= 0) ? 8 : 0;

  return base + bagBonus + legacyBackpackBonus;
}

export function recomputeInventorySlots(){
  // Keep the persisted value in sync for older UI code / saves.
  state.player.inventorySlots = getInventorySlotCap();
  return state.player.inventorySlots;
}

// One-time save repair: older builds could leave a gear item both equipped AND
// still present in the backpack inventory. This treats it as a duplication bug
// and removes ONE copy from inventory per equipped gear key (once per save).
function repairEquippedGearInventoryOnce(){
  try{
    if (!state.player || typeof state.player !== "object") return;
    if (!state.characters || typeof state.characters !== "object") return;
    const inv = (state.player.inventory && typeof state.player.inventory === "object") ? state.player.inventory : (state.player.inventory = {});

    if (!state.player.migrations || typeof state.player.migrations !== "object") state.player.migrations = {};
    const mig = state.player.migrations;
    if (!mig.equippedInventoryFix || typeof mig.equippedInventoryFix !== "object") mig.equippedInventoryFix = {};
    const fixed = mig.equippedInventoryFix;

    for (const ch of Object.values(state.characters)){
      const eq = ch?.equipment;
      if (!eq || typeof eq !== "object") continue;
      for (const key of Object.values(eq)){
        if (!key) continue;
        const k = String(key);
        const t = thingByKey?.[k];
        if (t?.kind !== "Gear") continue;
        if (fixed[k]) continue;
        const have = Math.max(0, Math.floor(Number(inv[k]) || 0));
        if (have > 0){
          inv[k] = Math.max(0, have - 1);
          fixed[k] = true;
        }
      }
    }
  }catch(_){/* ignore */}
}

// (Removed) Strength perks were tied to the legacy combat attributes.


export function getAttributeLevel(attrKey){
  const lvl = state.player?.attributes?.[attrKey]?.level;
  return Math.max(1, Math.floor(Number(lvl) || 1));
}

export function getAttributeXp(attrKey){
  const xp = state.player?.attributes?.[attrKey]?.xp;
  return Math.max(0, Number(xp) || 0);
}

export function getAttributeProgress(attrKey){
  const lvl = getAttributeLevel(attrKey);
  const xp = getAttributeXp(attrKey);
  if (lvl >= LEVEL_CAP) return { level: LEVEL_CAP, cur: 1, need: 1, pct: 1 };
  const curMin = LEVEL_XP_REQUIREMENTS[lvl] ?? 0;
  const nextMin = LEVEL_XP_REQUIREMENTS[lvl + 1] ?? (curMin + 1);
  const cur = Math.max(0, xp - curMin);
  const need = Math.max(1, nextMin - curMin);
  return { level: lvl, cur, need, pct: Math.min(1, cur / need) };
}


// -----------------------------
// CHARACTERS (separate builds)
// Colt + Jackson are now real, independently leveled characters.
// Player is a shared profile (inventory, MU, blueprints).
// -----------------------------
export const CHARACTER_IDS = ["jackson","colt"];
export const COMBAT_STAT_KEYS = ["attack","strength","defence","hp"]; // OSRS-style

// Player-selected combat stat to train (only one at a time).
// This controls where combat XP (from damage dealt) is allocated.
export const TRAINABLE_COMBAT_STATS = ["attack","strength","defence"];

export function getCombatTrainingTarget(){
  const k = String(state?.player?.combatXpTarget || "").toLowerCase();
  return TRAINABLE_COMBAT_STATS.includes(k) ? k : "attack";
}

export function setCombatTrainingTarget(statKey){
  const k = String(statKey || "").toLowerCase();
  if (!TRAINABLE_COMBAT_STATS.includes(k)) return { ok:false, reason:"Invalid training target." };
  if (!state.player || typeof state.player !== "object") state.player = {};
  state.player.combatXpTarget = k;
  return { ok:true, key:k };
}

function makeEmptyEquipment(){
  return {
    headgear: null,
    eyewear: null,
    neckwear: null,
    gloves: null,
    chestwear: null,
    legwear: null,
    shoes: null,
    ring1: null,
    ring2: null,
    bag1: null,
    bag2: null,
    bag3: null,
  };
}

function makeCharacter(id, name, types){
  return {
    id,
    name,
    types: Array.isArray(types) ? types : [String(types || 'normal')],
    level: 1,
    xp: 0,
    // Start at HP level 10 (10 max HP)
    hp: 10,
    maxHp: 10,
    // Combat stats level independently.
    stats: {
      attack: { level: 1, xp: 0 },
      strength: { level: 1, xp: 0 },
      defence: { level: 1, xp: 0 },
      // In this game: HP level == max HP.
      // We start at level 10 HP.
      hp: { level: 10, xp: (LEVEL_XP_REQUIREMENTS?.[10] ?? 1154) },
    },
    equipment: makeEmptyEquipment(),
  };
}

export function getActiveCharId(){
  const id = String(state?.player?.activeCharId || state?.player?.avatarId || "jackson");
  return CHARACTER_IDS.includes(id) ? id : "jackson";
}

export function getCharacter(charId){
  const id = CHARACTER_IDS.includes(String(charId)) ? String(charId) : "jackson";
  if (!state.characters || typeof state.characters !== "object") state.characters = {};
  if (!state.characters[id]) state.characters[id] = makeCharacter(id, id === "colt" ? "Colt" : "Jackson", id === "colt" ? ['electric'] : ['water']);
  return state.characters[id];
}

export function getActiveCharacter(){
  return getCharacter(getActiveCharId());
}

export function setActiveCharacter(charId){
  const id = CHARACTER_IDS.includes(String(charId)) ? String(charId) : "jackson";
  if (!state.player || typeof state.player !== "object") state.player = {};
  state.player.activeCharId = id;
  // Keep legacy fields in sync for older UI pieces.
  const ch = getCharacter(id);
  state.player.avatarId = id;
  state.player.hp = ch.hp;
  state.player.maxHp = ch.maxHp;
  // Keep legacy character-level fields separate from overall player level.
  state.player.activeCharLevel = ch.level;
  state.player.activeCharXp = ch.xp;
    state.player.equipment = { ...(ch.equipment || {}) };
  return id;
}

function syncActiveCharacterFromLegacy(){
  // If an older save only has player.hp/equipment, fold it into Jackson.
  const j = getCharacter("jackson");
  if (typeof state.player?.hp === "number") j.hp = state.player.hp;
  if (typeof state.player?.maxHp === "number") j.maxHp = state.player.maxHp;
  if (state.player?.equipment && typeof state.player.equipment === "object"){
    j.equipment = { ...makeEmptyEquipment(), ...state.player.equipment };
  }
}

export function levelUpFromXp(totalXp){
  return levelFromXp(totalXp);
}

export function addCharacterXp(charId, amount){
  const ch = getCharacter(charId);
  const add = max0Int(amount);
  ch.xp = (ch.xp ?? 0) + add;
  const newLvl = Math.min(LEVEL_CAP, levelFromXp(ch.xp));
  const leveledUp = newLvl > (ch.level ?? 1);
  ch.level = newLvl;
  return { gained:add, leveledUp, level:newLvl, xp: ch.xp };
}

export function getCombatStatLevel(charId, statKey){
  const ch = getCharacter(charId);
  const s = ch?.stats?.[statKey];
  return Math.max(1, Math.floor(Number(s?.level) || 1));
}

export function getCombatStatProgress(charId, statKey){
  const ch = getCharacter(charId);
  const s = ch?.stats?.[statKey] || { level:1, xp:0 };
  const lvl = Math.max(1, Math.floor(Number(s.level) || 1));
  const cur = Math.max(0, Math.floor(Number(s.xp) || 0));
  if (lvl >= LEVEL_CAP) return { lvl, cur, need: cur, pct: 1 };
  const next = LEVEL_XP_REQUIREMENTS[lvl+1] ?? (cur+100);
  const base = LEVEL_XP_REQUIREMENTS[lvl] ?? 0;
  const need = Math.max(1, next - base);
  const into = Math.max(0, cur - base);
  return { lvl, cur: into, need, pct: Math.max(0, Math.min(1, into/need)) };
}

export function addCombatStatXp(charId, statKey, amount){
  if (!COMBAT_STAT_KEYS.includes(statKey)) return { ok:false, reason:"Unknown combat stat." };
  const ch = getCharacter(charId);
  if (!ch.stats) ch.stats = {};
  if (!ch.stats[statKey]) ch.stats[statKey] = { level:1, xp:0 };
  const add = max0Int(amount);
  const s = ch.stats[statKey];
  const prevLevel = Math.max(1, Math.floor(Number(s.level)||1));
  s.xp = (s.xp ?? 0) + add;
  const newLvl = Math.min(LEVEL_CAP, levelFromXp(s.xp));
  s.level = newLvl;
  const leveledUp = newLvl > prevLevel;
  // HP stat increases max HP: HP level == max HP.
  if (statKey === "hp")
  {
    const newMax = newLvl;
    const prevMax = ch.maxHp ?? newMax;
    const delta = newMax - prevMax;
    ch.maxHp = newMax;
    // If max HP increased, grant the extra HP immediately (like RS level-up).
    if (delta > 0){
      ch.hp = Math.min(ch.maxHp, (ch.hp ?? prevMax) + delta);
    } else {
      ch.hp = Math.min(ch.maxHp, (ch.hp ?? ch.maxHp));
    }
  }

  // Overall player level is derived from total XP (skills + active character combat stats).
  // Keep it in sync whenever any combat stat XP changes.
  recomputePlayerOverallLevel();

  return { ok:true, gained:add, leveledUp, level:newLvl, prevLevel, xp:s.xp, key: statKey };
}

function max0Int(x){
  return Math.max(0, Math.floor(Number(x) || 0));
}

// -----------------------------
// OVERALL PLAYER LEVEL
// Player "level" is derived from the SUM of all attribute levels.
// (Skill attributes + the active character's combat stat levels.)
// Total XP is still tracked (and shown in History), but it no longer drives the level.
// -----------------------------
export function computePlayerOverallXp(){
  let total = 0;

  // Skill attributes (Gathering/Refining/Crafting)
  for (const k of ATTRIBUTE_KEYS){
    total += Math.max(0, Number(state?.player?.attributes?.[k]?.xp) || 0);
  }

  // Active character combat stats (Attack/Strength/Defence/HP)
  const ch = getCharacter(getActiveCharId());
  for (const sk of COMBAT_STAT_KEYS){
    const xp = max0Int(ch?.stats?.[sk]?.xp);

    // HP starts at Lv10. For the *total XP* stat, we ignore the baseline HP XP
    // so the number reflects earned XP since game start.
    if (sk === "hp"){
      const baseHpXp = LEVEL_XP_REQUIREMENTS[MIN_STARTING_HP_LEVEL] ?? 0;
      total += Math.max(0, xp - baseHpXp);
    } else {
      total += xp;
    }
  }

  return total;
}

export function computePlayerOverallLevelSum(){
  let total = 0;

  // Skill attributes
  for (const k of ATTRIBUTE_KEYS){
    total += getAttributeLevel(k);
  }

  // Active character combat stats (Attack/Strength/Defence/HP)
  const ch = getCharacter(getActiveCharId());
  for (const sk of COMBAT_STAT_KEYS){
    const lvl = Math.max(1, Math.floor(Number(ch?.stats?.[sk]?.level) || 1));
    total += lvl;
  }

  return Math.max(1, Math.floor(total) || 1);
}

export function recomputePlayerOverallLevel(){
  if (!state.player || typeof state.player !== "object") state.player = {};
  const totalXp = computePlayerOverallXp();
  const totalLevel = computePlayerOverallLevelSum();
  state.player.xp = totalXp;
  state.player.level = totalLevel;

  // Mirror to history for convenience (used by the History panel)
  if (!state.history || typeof state.history !== "object") state.history = {};
  state.history.totalXp = totalXp;

  return { xp: totalXp, level: totalLevel };
}


export function newGameState(){
  // inventory counts for everything are stored in a single object
  const inventory = {};
  for (const t of [...gatherables, ...materials, ...items]) inventory[t.key] = 0;

  // Distillery Cabinet defaults: 200 cap for every known element (upgradable).
  const cabinetStored = {};
  const cabinetCaps = {};
  const cabinetLevels = {};
  for (const ek of ALL_ELEMENT_KEYS){
    cabinetStored[ek] = 0;
    cabinetCaps[ek] = 200;
    cabinetLevels[ek] = 0;
  }

  // A1's storefront: stock list + upgrade progress.
  // (This lives outside player state so it can evolve independently.)
  const store = {
    // Slot capacity for the BUY grid.
    capacity: 8,
    // Future-proof cap so we can expand the ladder later.
    maxCapacity: 16,

    // Current stock keys (BUY grid). Refreshed on a timer.
    stock: [],
    // Next refresh timestamp (ms).
    nextRefreshAt: Date.now() + (4 * 60 * 60 * 1000),

    // Upgrade ladders
    storageLevel: 0, // 0..8
    linkLevel: 0,    // 0..6

    // Elements A1 has banked toward upgrades.
    // Values are counted in "tubes" (each tube == 100g bottled element).
    a1Storage: {},
  };

  return {
    flags: {
      // reserved for future global flags
    },
    store,
    storyProgress: {
      chapters: {}
    },
    ui: { 
      activePage: "story",
      activeChapterKey: null,
      playerMenuOpen: false,
      statsPanelOpen: true,
      strengthExpanded: false,
      historyPanelOpen: true,
      quickPanelOpen: true,
      invPanelOpen: true,
      invEquipOpen: true,
      invBackpackOpen: true,
      // Story "beats" (click-to-advance) state
      storyBeatNodeId: "start",
      storyBeatIndex: 0,
    },
    history: {
      minionsKilled: 0,
      // MU audit (helps diagnose missing currency)
      muEarned: 0,
      muSpent: 0,
      lastMuChange: null,
    },
    currentNodeId: "start",
    player: {
      name: "Nicholas",
      status: "Idle",
      avatarId: "jackson",
      activeCharId: "jackson",
      // Which combat stat receives damage-based XP (besides HP). One of: attack/strength/defence.
      combatXpTarget: "attack",
      level: 1,
      xp: 0,
      hp: 10,
      maxHp: 10,
      // Attributes start at Lv 01 with 0 XP.
      // Attribute level determines its effect.
      credits: 0,
      // Locks prevent accidental selling in the General Store.
      // Map of { [itemKey]: true }
      locks: {},
      // Gadgets are special items with charge + rank.
      gadgets: {},
      // Distillery Cabinet: element storage outside the backpack.
      // Each element has its own container with its own cap.
      distilleryCabinet: { stored: cabinetStored, caps: cabinetCaps, levels: cabinetLevels },
      // Oxygen system: temporary "Breathe" buff state.
      breathe: { active: false, endAt: 0 },
      // Distiller: remembers scraps once they've been distilled at least once.
      // Map of { [scrapKey]: true }
      distillerKnownScraps: {},
      attributes: {
        // Distillery is the single progression skill for salvaging/distilling.
        distillery: { level: 1, xp: 0 },
      },
      equipment: {
        headgear: null,
        eyewear: null,
        neckwear: null,
        gloves: null,
        chestwear: null,
        legwear: null,
        shoes: null,
        ring1: null,
        ring2: null,
        bag1: null,
        bag2: null,
        bag3: null,
      },
toolbelt: {
  tool1: null,
  tool2: null,
  tool3: null,
  tool4: null,
  tool5: null,
  tool6: null
},
      inventory,
      inventorySlots: 16,
      quickSlots: ["fe", "cu", "c"], // defaults; will auto-trim to unlocked items
      // Blueprints are discovered via story/events; start with none.
      blueprintsOwned: [],
      upgrades: { backpack_mk1: false }
    },
    characters: {
      jackson: makeCharacter("jackson", "Jackson", ['water']),
      colt: makeCharacter("colt", "Colt", ['electric']),
    },
    jobs: { refine: {}, craft: {} },
    store,
    lastSavedAt: null
  };
}

export const state = newGameState();
// Initialize derived overall XP/level once the state exists.
recomputePlayerOverallLevel();

export function resetToNewGame(){
  const fresh = newGameState();
  // keep name
  fresh.player.name = state.player.name;
  Object.assign(state, fresh);

  // Ensure legacy sync and derived overall level.
  setActiveCharacter(getActiveCharId());
  recomputePlayerOverallLevel();
}

// Soft reset for testing/balance: resets levels + XP only, keeps inventory/story/blueprints.
// This resets: player XP/level, skill attributes, and all characters' combat stats (including HP).
export function resetLevelsKeepProgress(){
  // Reset player-level XP/level (header bar)
  if (!state.player || typeof state.player !== "object") state.player = {};
  state.player.xp = 0;
  state.player.level = 1;

  // Reset skill attributes (Gathering/Refining/Crafting)
  if (!state.player.attributes || typeof state.player.attributes !== "object") state.player.attributes = {};
  for (const k of ATTRIBUTE_KEYS){
    state.player.attributes[k] = { level: 1, xp: 0 };
  }

  // Reset combat training target
  state.player.combatXpTarget = "attack";

  // Reset character combat stats + character XP/level
  if (!state.characters || typeof state.characters !== "object") state.characters = {};
  for (const id of CHARACTER_IDS){
    const ch = getCharacter(id);

    // Character-level XP/level (shown in stats panel)
    ch.xp = 0;
    ch.level = 1;

    if (!ch.stats || typeof ch.stats !== "object") ch.stats = {};

    // Attack / Strength / Defence back to Lv1
    for (const sk of ["attack","strength","defence"]){
      ch.stats[sk] = { level: 1, xp: 0 };
    }

    // HP starts at Lv10, and HP level == max HP.
    const hpXp = (LEVEL_XP_REQUIREMENTS[10] ?? 0);
    ch.stats.hp = { level: 10, xp: hpXp };
    ch.maxHp = 10;
    ch.hp = 10;
  }

  // Ensure the active character legacy fields stay in sync.
  setActiveCharacter(getActiveCharId());
  recomputeInventorySlots();
  recomputePlayerOverallLevel();
}

export function saveGame(){
  try{
    // Strip volatile UI-only fields (modals, transient popups, etc.) so they
    // don't persist across reloads.
    const ui = { ...(state.ui || {}) };
    if ("lootModal" in ui) delete ui.lootModal;
    const payload = JSON.stringify({ ...state, ui });
    localStorage.setItem(SAVE_KEY, payload);
    state.lastSavedAt = Date.now();
    return true;
  }catch(e){
    console.error(e);
    return false;
  }
}

export function loadGame(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);

    // Merge onto a fresh schema so older / corrupted saves can't remove required structure.
    const fresh = newGameState();

    // Start from the fresh defaults at the top-level.
    Object.assign(state, fresh, data);

    // Volatile UI-only fields should never persist.
    if (state.ui && typeof state.ui === "object"){
      if ("lootModal" in state.ui) delete state.ui.lootModal;
    }

    // Design rule: the Story frame should always boot back to the
    // "Choose Your Adventure" hub on refresh/reload.
    state.currentNodeId = "choose_adventure";
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    state.ui.storyBeatNodeId = "choose_adventure";
    state.ui.storyBeatIndex = 0;
    // Clear transient junkyard beat markers so reloads never land in a loop node.
    if ("lastJunkyardLoot" in state.ui) delete state.ui.lastJunkyardLoot;
    if ("lastJunkyardDistilled" in state.ui) delete state.ui.lastJunkyardDistilled;


    // Legacy combat state removed in v13
    if ("combat" in state) delete state.combat;

    // Ensure characters object exists
    if (!state.characters || typeof state.characters !== "object") state.characters = {};
    // Seed any missing characters
    for (const id of CHARACTER_IDS){
      if (!state.characters[id] || typeof state.characters[id] !== "object"){
        state.characters[id] = makeCharacter(id, id === "colt" ? "Colt" : "Jackson", id === "colt" ? ['electric'] : ['water']);
      }
      // Merge nested defaults
      const freshCh = makeCharacter(id, id === "colt" ? "Colt" : "Jackson", id === "colt" ? ['electric'] : ['water']);
      const ch = state.characters[id];
      ch.stats = { ...freshCh.stats, ...(ch.stats || {}) };
      for (const k of COMBAT_STAT_KEYS){
        if (!ch.stats[k] || typeof ch.stats[k] !== "object") ch.stats[k] = { level:1, xp:0 };
        if (typeof ch.stats[k].xp !== "number") ch.stats[k].xp = 0;
        ch.stats[k].level = Math.min(LEVEL_CAP, levelFromXp(ch.stats[k].xp));
      }

      // Migration / design rule: characters should never be below the starting HP level.
      // (HP level == max HP.)
      if (ch.stats.hp.level < MIN_STARTING_HP_LEVEL){
        ch.stats.hp.xp = Math.max(
          Number(ch.stats.hp.xp) || 0,
          LEVEL_XP_REQUIREMENTS[MIN_STARTING_HP_LEVEL] ?? 0
        );
        ch.stats.hp.level = MIN_STARTING_HP_LEVEL;
      }
      if (!ch.equipment || typeof ch.equipment !== "object") ch.equipment = makeEmptyEquipment();
      ch.equipment = { ...makeEmptyEquipment(), ...ch.equipment };
      if (typeof ch.xp !== "number") ch.xp = 0;
      ch.level = Math.min(LEVEL_CAP, levelFromXp(ch.xp));
      // Ensure maxHp based on hp stat (hp level == max HP)
      const hpLvl = Math.max(1, Math.floor(Number(ch?.stats?.hp?.level) || 1));
      const derivedMax = hpLvl;
      if (typeof ch.maxHp !== "number") ch.maxHp = derivedMax;
      // Clamp old saves down into derived range (prevents legacy saves with inflated HP)
      ch.maxHp = Math.min(ch.maxHp, derivedMax);
      if (typeof ch.hp !== "number") ch.hp = ch.maxHp;
      ch.hp = Math.min(ch.hp, ch.maxHp);
    }

// Ensure player object exists (older saves or broken saves may omit it).
    if (!state.player || typeof state.player !== "object"){
      state.player = { ...fresh.player };
    }

    // Merge nested player defaults (shallow) so missing keys don't break rendering.
    state.player = { ...fresh.player, ...state.player };
    // Validate combat training target.
    if (!TRAINABLE_COMBAT_STATS.includes(String(state.player.combatXpTarget || "").toLowerCase())){
      state.player.combatXpTarget = "attack";
    }
    state.player.attributes = { ...fresh.player.attributes, ...(state.player.attributes || {}) };
        state.player.locks = (state.player.locks && typeof state.player.locks === "object") ? state.player.locks : {};
    state.player.inventory = (state.player.inventory && typeof state.player.inventory === "object") ? state.player.inventory : {};
    state.player.gadgets = (state.player.gadgets && typeof state.player.gadgets === "object") ? state.player.gadgets : {};

    // Back-compat: some older helpers check state.player.characters
    // (we now store characters at state.characters).
    state.player.characters = state.characters;

    // Repair: if a gear item is equipped AND still present in inventory,
    // remove one copy once per save.
    repairEquippedGearInventoryOnce();

    // Distillery system (Cabinet + Distiller)
    if (!state.player.distilleryCabinet || typeof state.player.distilleryCabinet !== "object"){
      state.player.distilleryCabinet = { stored: {}, caps: {}, levels: {} };
    }
    const cab = state.player.distilleryCabinet;
    if (!cab.stored || typeof cab.stored !== "object") cab.stored = {};
    if (!cab.caps || typeof cab.caps !== "object") cab.caps = {};
    for (const ek of ALL_ELEMENT_KEYS){
      if (typeof cab.stored[ek] !== "number") cab.stored[ek] = 0;
      cab.stored[ek] = Math.max(0, Math.floor(Number(cab.stored[ek]) || 0));
      if (typeof cab.caps[ek] !== "number") cab.caps[ek] = 1000;
      cab.caps[ek] = Math.max(0, Math.floor(Number(cab.caps[ek]) || 0));
      if (cab.caps[ek] < 1000) cab.caps[ek] = 1000;
      // If a save somehow has more stored than cap, clamp stored.
      if (cab.stored[ek] > cab.caps[ek]) cab.stored[ek] = cab.caps[ek];
    }

    if (!state.player.distillerKnownScraps || typeof state.player.distillerKnownScraps !== "object"){
      state.player.distillerKnownScraps = {};
    }

    // Oxygen system (Breathe buff)
    if (!state.player.breathe || typeof state.player.breathe !== "object"){
      state.player.breathe = { active:false, endAt:0 };
    }
    if (typeof state.player.breathe.active !== "boolean") state.player.breathe.active = false;
    if (typeof state.player.breathe.endAt !== "number") state.player.breathe.endAt = 0;

    // v??: Remove deprecated craftables/tools/refinables from old saves.
    // - Legacy tools and refinery intermediates were removed once the Distillery became the core loop.
    // - We try to avoid resource loss by converting removed refinables back into their base elements.
    const removedItemKeys = [
      "torch","scrap_knife","crude_goggles",
      // Removed tool items
      "tool_smelt_tin","tool_wire_jig","tool_glass_mold","tool_grinding_stone","tool_hand_press","tool_lens_grinder",
      // Removed refinables/material intermediates
      "charcoal","iron_ingot","copper_ingot","zinc_plate","glass_pane","sulfur_powder","copper_wire","steel_ingot","brass_ingot","glass_lens",
    ];

    const removedBpKeys = [
      "bp_torch","bp_scrap_knife","bp_crude_goggles","bp_backpack_mk1",
      // Removed tool blueprints
      "bp_tool_smelt_tin","bp_tool_wire_jig","bp_tool_glass_mold","bp_tool_grinding_stone","bp_tool_hand_press","bp_tool_lens_grinder",
    ];

    // Convert removed refinables into base elements (grams) to prevent loss.
    // Note: values are derived from the old refine recipes (integer, deterministic).
    const inv = state.player.inventory;
    const addEl = (k, n) => { inv[k] = (inv[k] ?? 0) + Math.max(0, Math.floor(Number(n) || 0)); };
    const take = (k) => {
      const q = Math.max(0, Math.floor(Number(inv[k]) || 0));
      if (q > 0) delete inv[k];
      return q;
    };

    // Refinables -> elements
    const qCharcoal = take("charcoal");
    if (qCharcoal) addEl("c", qCharcoal * 3);
    const qIronIngot = take("iron_ingot");
    if (qIronIngot) addEl("fe", qIronIngot * 4);
    const qCopperIngot = take("copper_ingot");
    if (qCopperIngot) addEl("cu", qCopperIngot * 4);
    const qZincPlate = take("zinc_plate");
    if (qZincPlate) addEl("zn", qZincPlate * 3);
    const qGlassPane = take("glass_pane");
    if (qGlassPane){ addEl("si", qGlassPane * 3); addEl("o", qGlassPane * 3); }
    const qSulfurPowder = take("sulfur_powder");
    if (qSulfurPowder) addEl("s", qSulfurPowder * 3);
    const qCopperWire = take("copper_wire");
    if (qCopperWire) addEl("cu", qCopperWire * 4);
    const qSteelIngot = take("steel_ingot");
    if (qSteelIngot){ addEl("fe", qSteelIngot * 4); addEl("c", qSteelIngot * 3); }
    const qBrassIngot = take("brass_ingot");
    if (qBrassIngot){ addEl("cu", qBrassIngot * 4); addEl("zn", qBrassIngot * 3); }
    const qGlassLens = take("glass_lens");
    if (qGlassLens){ addEl("si", qGlassLens * 6); addEl("o", qGlassLens * 6); }

    // Removed tools: refund their historical build costs as elements (approximate, deterministic).
    // This keeps older saves from feeling "robbed" after the tool system was removed.
    const refundTool = (toolKey, refund) => {
      const q = take(toolKey);
      if (!q) return;
      for (const [ek, amt] of Object.entries(refund)) addEl(ek, amt * q);
    };
    refundTool("tool_smelt_tin", { fe: 12, si: 4, o: 4 });
    // Old tool recipes referenced refinables; refund as base elements.
    refundTool("tool_wire_jig", { fe: 8, cu: 4 });
    refundTool("tool_glass_mold", { fe: 8, si: 4, o: 4 });
    refundTool("tool_grinding_stone", { si: 6, fe: 4 });
    refundTool("tool_hand_press", { fe: 12, cu: 8, si: 4 });
    refundTool("tool_lens_grinder", { si: 12, o: 12, cu: 8 });
    removedItemKeys.forEach(k => {
      if (state.player.inventory && k in state.player.inventory) delete state.player.inventory[k];
      if (state.player.locks && k in state.player.locks) delete state.player.locks[k];
    });
    if (Array.isArray(state.player.quickSlots)){
      state.player.quickSlots = state.player.quickSlots.filter(k => !removedItemKeys.includes(k));
    }
    if (Array.isArray(state.player.blueprintsOwned)){
      state.player.blueprintsOwned = state.player.blueprintsOwned.filter(k => !removedBpKeys.includes(k));
    }
    if (state.player.equipment && typeof state.player.equipment === "object"){
      for (const slot of Object.keys(state.player.equipment)){
        if (removedItemKeys.includes(state.player.equipment[slot])) state.player.equipment[slot] = null;
      }
      // Legacy typo slot
      if ("head" in state.player.equipment && removedItemKeys.includes(state.player.equipment.head)) state.player.equipment.head = null;
    }

    // Toolbelt: clear any removed tool keys.
    if (state.player.toolbelt && typeof state.player.toolbelt === "object"){
      for (const k of Object.keys(state.player.toolbelt)){
        if (removedItemKeys.includes(state.player.toolbelt[k])) state.player.toolbelt[k] = null;
      }
    }

    if (!state.ui) state.ui = { activePage: "story",
      activeChapterKey: null, playerMenuOpen: false };
    if (!state.ui.activePage) state.ui.activePage = "story";
    if (typeof state.ui.playerMenuOpen !== "boolean") state.ui.playerMenuOpen = false;
    if (typeof state.ui.statsPanelOpen !== "boolean") state.ui.statsPanelOpen = true;
    if (typeof state.ui.historyPanelOpen !== "boolean") state.ui.historyPanelOpen = true;
    if (typeof state.ui.quickPanelOpen !== "boolean") state.ui.quickPanelOpen = true;
    if (typeof state.ui.invPanelOpen !== "boolean") state.ui.invPanelOpen = true;
    if (typeof state.ui.invEquipOpen !== "boolean") state.ui.invEquipOpen = true;
    if (typeof state.ui.invBackpackOpen !== "boolean") state.ui.invBackpackOpen = true;

    // Story beats
    if (typeof state.ui.storyBeatNodeId !== "string") state.ui.storyBeatNodeId = state.currentNodeId || "start";
    if (typeof state.ui.storyBeatIndex !== "number") state.ui.storyBeatIndex = 0;

    // global flags (for future use)
    if (!state.flags || typeof state.flags !== "object") state.flags = {};

    // History / feats
    if (!state.history || typeof state.history !== "object") state.history = {};
    if (typeof state.history.minionsKilled !== "number") state.history.minionsKilled = 0;
    if (typeof state.history.scrapsFound !== "number") state.history.scrapsFound = 0;
    if (typeof state.history.muEarned !== "number") state.history.muEarned = 0;
    if (typeof state.history.muSpent !== "number") state.history.muSpent = 0;
    if (!("lastMuChange" in state.history)) state.history.lastMuChange = null;
    if (state.history.lastMuChange !== null && typeof state.history.lastMuChange !== "object") state.history.lastMuChange = null;

    // ensure inventory has all keys (for future updates)
    if (!state.player?.inventory) state.player.inventory = {};

    // player progression defaults
    if (typeof state.player.xp !== "number") state.player.xp = 0;
    if (typeof state.player.level !== "number") state.player.level = 1;
    if (typeof state.player.maxHp !== "number") state.player.maxHp = 100;
    if (typeof state.player.hp !== "number") state.player.hp = state.player.maxHp;
    // Credits / locks
    if (typeof state.player.credits !== "number") state.player.credits = 0;
    if (!state.player.locks || typeof state.player.locks !== "object") state.player.locks = {};
    // Last sale (for "oops" undo)
    if (!("lastSale" in state.player)) state.player.lastSale = null;
    if (state.player.lastSale !== null && typeof state.player.lastSale !== "object") state.player.lastSale = null;

    // Attributes: ensure schema exists and clamp to valid values.
    if (!state.player.attributes || typeof state.player.attributes !== "object") state.player.attributes = {};

    // vNext: Skill consolidation
    // Older saves had Gathering/Refining/Crafting as separate attributes.
    // These are now unified into a single Distillery attribute.
    if (!("distillery" in state.player.attributes)){
      const g = Math.max(0, Number(state.player.attributes?.gathering?.xp) || 0);
      const r = Math.max(0, Number(state.player.attributes?.refining?.xp) || 0);
      const c = Math.max(0, Number(state.player.attributes?.crafting?.xp) || 0);
      const sum = g + r + c;
      if (sum > 0){
        state.player.attributes.distillery = { xp: sum, level: Math.min(LEVEL_CAP, levelFromXp(sum)) };
      }
    }
    for (const k of ATTRIBUTE_KEYS){
      if (!state.player.attributes[k] || typeof state.player.attributes[k] !== "object"){
        state.player.attributes[k] = { level: 1, xp: 0 };
      }
      if (typeof state.player.attributes[k].xp !== "number") state.player.attributes[k].xp = 0;
      // derive level from total XP for that attribute
      state.player.attributes[k].level = Math.min(LEVEL_CAP, levelFromXp(state.player.attributes[k].xp));
    }
    // Remove legacy combat/unused attribute keys
    for (const kk of Object.keys(state.player.attributes)){
      if (!ATTRIBUTE_KEYS.includes(kk)) delete state.player.attributes[kk];
    }

    // Remove legacy combat attributes from older saves
    const legacyAttrKeys = ["strength","speed","accuracy","defense","guard"];
    for (const lk of legacyAttrKeys){
      if (state.player.attributes && lk in state.player.attributes) delete state.player.attributes[lk];
    }

    if (!state.player.equipment || typeof state.player.equipment !== "object"){
      state.player.equipment = {
        headgear:null, eyewear:null, neckwear:null, gloves:null, chestwear:null, legwear:null, shoes:null,
        ring1:null, ring2:null, bag1:null, bag2:null, bag3:null
      };
    }

    // v122: New equipment slot `eyewear`. Migrate legacy placements.
    // - Nerd Glasses used to be `headgear`.
    const eq = state.player.equipment;
    // legacy `head` slot migration
    if ("head" in eq && eq.head){
      if (!eq.eyewear){
        eq.eyewear = eq.head;
      } else {
        // If eyewear already occupied, return the legacy-equipped item to inventory.
        state.player.inventory[eq.head] = (state.player.inventory[eq.head] ?? 0) + 1;
      }
      eq.head = null;
    }
    // Nerd Glasses migration from headgear -> eyewear
    if (eq.headgear === "nerd_glasses"){
      if (!eq.eyewear){
        eq.eyewear = eq.headgear;
      } else {
        // If eyewear already occupied, return Nerd Glasses to inventory.
        state.player.inventory.nerd_glasses = (state.player.inventory.nerd_glasses ?? 0) + 1;
      }
      eq.headgear = null;
    }
    syncActiveCharacterFromLegacy();

    // Clean up legacy key if present
    if ("head" in eq) delete eq.head;
    for (const t of [...gatherables, ...materials, ...items]) {
      if (typeof state.player.inventory[t.key] !== "number") state.player.inventory[t.key] = 0;
    }

    // Quick Gather pins: sanitize (older saves may contain removed keys like "salvage")
    if (!Array.isArray(state.player.quickSlots)) state.player.quickSlots = [];
    const gatherKeySet = new Set(gatherables.map(g => g.key));
    state.player.quickSlots = state.player.quickSlots.filter(k => gatherKeySet.has(k));
    // Trim to max 3
    if (state.player.quickSlots.length > 3) state.player.quickSlots = state.player.quickSlots.slice(0, 3);
    // If empty, seed sensible defaults (first three common-ish)
    if (state.player.quickSlots.length === 0){
      const defaults = ["fe", "cu", "c"].filter(k => gatherKeySet.has(k));
      state.player.quickSlots = defaults.length ? defaults.slice(0,3) : gatherables.slice(0,3).map(g => g.key);
    }
    // (done)
    if (!Array.isArray(state.player.blueprintsOwned)) state.player.blueprintsOwned = [];
    if (!state.player.avatarId || typeof state.player.avatarId !== "string") state.player.avatarId = "jackson";

    // Upgrades + inventory slot cap
    if (!state.player.upgrades || typeof state.player.upgrades !== "object") state.player.upgrades = { backpack_mk1: false };
    if (typeof state.player.upgrades.backpack_mk1 !== "boolean") state.player.upgrades.backpack_mk1 = !!state.player.upgrades.backpack_mk1;
    // Toolbelt
    // Starts at 6 slots, but automatically expands if more tools are added to the game.
    if (!state.player.toolbelt || typeof state.player.toolbelt !== "object"){
      state.player.toolbelt = {};
    }
    const toolCount = Object.keys(thingByKey).filter(k => (thingByKey[k]?.kind || "") === "Tool").length;
    const want = Math.max(6, toolCount);
    for (let i = 1; i <= want; i++){
      const k = `tool${i}`;
      if (!(k in state.player.toolbelt)) state.player.toolbelt[k] = null;
    }

    recomputeInventorySlots();

    // Sync legacy fields (player.hp, player.equipment) from the active character for UI compatibility.
    setActiveCharacter(getActiveCharId());
    // Player level is derived from total attribute XP; recompute after all migrations.
    recomputePlayerOverallLevel();

    // Background jobs (refine/craft + story repeatables)
    if (!state.jobs || typeof state.jobs !== "object") state.jobs = {};
    if (!state.jobs.refine) state.jobs.refine = {};
    if (!state.jobs.craft) state.jobs.craft = {};
    if (!state.jobs.junkyard) state.jobs.junkyard = { active:false, endAt:0, pendingKey:null };

    // A1 store: seed stock/refresh timers even for older saves.
    try{
      ensureStoreState();
      // Don't force: only fill if missing/due.
      storeTick(false);
    }catch(_){ /* ignore */ }

    return true;
  }catch(e){
    console.error(e);
    return false;
  }
}

export function setStatus(text){
  state.player.status = text;
}

export function setPlayerName(name){
  const raw = (name ?? "").toString();
  // collapse whitespace and keep it friendly
  const cleaned = raw.replace(/\s+/g, " ").trim();
  // allow clearing? no — fall back to previous if empty
  if (!cleaned) return { ok:false, reason:"Name cannot be blank." };
  const max = 24;
  state.player.name = cleaned.slice(0, max);
  return { ok:true, name: state.player.name };
}

export function hasResources(req, opts = {}){
  if (!req) return true;
  const useCabinetForElements = !!opts.useCabinetForElements;
  if (useCabinetForElements) ensureDistilleryData();

  for (const [k0, v0] of Object.entries(req)){
    const k = String(k0);
    const need = Math.max(0, Math.floor(Number(v0) || 0));
    if (need <= 0) continue;

    if (useCabinetForElements && isKnownElementKey(k)){
      const inv = Math.max(0, Math.floor(Number(state.player.inventory?.[k]) || 0));
      const cab = Math.max(0, Math.floor(Number(state.player.distilleryCabinet?.stored?.[k]) || 0));
      if ((inv + cab) < need) return false;
    } else {
      if ((state.player.inventory?.[k] ?? 0) < need) return false;
    }
  }
  return true;
}

export function spendResources(req, opts = {}){
  const useCabinetForElements = !!opts.useCabinetForElements;
  if (useCabinetForElements) ensureDistilleryData();

  for (const [k0, v0] of Object.entries(req || {})){
    const k = String(k0);
    const need = Math.max(0, Math.floor(Number(v0) || 0));
    if (need <= 0) continue;

    if (useCabinetForElements && isKnownElementKey(k)){
      const cab0 = Math.max(0, Math.floor(Number(state.player.distilleryCabinet?.stored?.[k]) || 0));
      const takeCab = Math.min(cab0, need);
      if (takeCab > 0){
        state.player.distilleryCabinet.stored[k] = cab0 - takeCab;
      }
      const rem = need - takeCab;
      if (rem > 0){
        state.player.inventory[k] = (state.player.inventory[k] ?? 0) - rem;
        if (state.player.inventory[k] < 0) state.player.inventory[k] = 0;
      }
    } else {
      state.player.inventory[k] = (state.player.inventory[k] ?? 0) - need;
      if (state.player.inventory[k] < 0) state.player.inventory[k] = 0;
    }
  }
}

export function addResources(adds){
  // v59.19: hard lock — disallow non-whitelisted element keys
  adds = filterDisallowedElements(adds);

  for (const [k,v] of Object.entries(adds)){
    state.player.inventory[k] = (state.player.inventory[k] ?? 0) + v;
  }
}

// -----------------------------
// GADGETS (charge + upgrade)
// -----------------------------

export const GADGET_KEYS = items.filter(t => t && t.isGadget).map(t => t.key);

function ensureGadgetData(){
  if (!state.player || typeof state.player !== "object") return;
  if (!state.player.gadgets || typeof state.player.gadgets !== "object") state.player.gadgets = {};
}

export function isGadgetKey(key){
  return !!thingByKey[key]?.isGadget;
}

export function getGadgetState(key){
  ensureGadgetData();
  if (!isGadgetKey(key)) return null;
  const thing = thingByKey[key] || {};
  const g = state.player.gadgets[key] || (state.player.gadgets[key] = { rank:0, charges:0 });
  const maxRank = Math.max(0, Math.floor(Number(thing.gadget?.maxRank) || 3));
  g.rank = Math.max(0, Math.min(maxRank, Math.floor(Number(g.rank) || 0)));
  const maxCharges = 1 + g.rank;
  g.charges = Math.max(0, Math.min(maxCharges, Math.floor(Number(g.charges) || 0)));
  const baseTurns = Math.max(1, Math.floor(Number(thing.gadget?.durationBaseTurns) || 1));
  const durationTurns = baseTurns + g.rank;
  const owned = Math.max(0, Math.floor(Number(state.player.inventory?.[key]) || 0));
  return { key, rank: g.rank, charges: g.charges, maxCharges, durationTurns, maxRank, owned };
}

export function chargeGadget(key){
  const gs = getGadgetState(key);
  if (!gs) return { ok:false, reason:"Not a gadget." };
  if (gs.owned <= 0) return { ok:false, reason:"You don't own this gadget." };
  const g = state.player.gadgets[key];
  if (g.charges >= gs.maxCharges) return { ok:false, reason:"Already fully charged." };
  g.charges = Math.min(gs.maxCharges, g.charges + 1);
  setStatus(`${labelFor(key)} charged (${g.charges}/${gs.maxCharges}).`);
  return { ok:true, charges:g.charges, maxCharges:gs.maxCharges };
}

export function upgradeGadget(key){
  const gs = getGadgetState(key);
  if (!gs) return { ok:false, reason:"Not a gadget." };
  if (gs.owned <= 0) return { ok:false, reason:"You don't own this gadget." };
  if (gs.rank >= gs.maxRank) return { ok:false, reason:"Already max rank." };

  // Upgrade rule (v1): consume 1 extra copy of the gadget.
  // So you must have at least 2 copies: one stays, one is consumed as "parts".
  if (gs.owned < 2) return { ok:false, reason:"Need a spare copy to upgrade." };

  // Spend 1 copy
  state.player.inventory[key] = Math.max(0, (state.player.inventory[key] || 0) - 1);

  const g = state.player.gadgets[key];
  g.rank = Math.min(gs.maxRank, (g.rank || 0) + 1);
  const maxCharges = 1 + g.rank;
  g.charges = Math.min(maxCharges, Math.max(g.charges || 0, 1));

  setStatus(`${labelFor(key)} upgraded to Rank ${g.rank}.`);
  return { ok:true, rank:g.rank, charges:g.charges, maxCharges };
}


// -----------------------------
// GENERAL STORE (buy/sell + locks)
// -----------------------------
export function isLocked(key){
  return !!state.player?.locks?.[key];
}

export function toggleLock(key){
  if (!state.player.locks || typeof state.player.locks !== "object") state.player.locks = {};
  state.player.locks[key] = !state.player.locks[key];
  if (!state.player.locks[key]) delete state.player.locks[key];
  return isLocked(key);
}

function pricesFor(key){
  const t = thingByKey[key];
  return {
    buy: Math.max(0, Math.floor(Number(t?.buyPrice) || 0)),
    sell: Math.max(0, Math.floor(Number(t?.sellPrice) || 0)),
  };
}

function recordMuChange(delta, reason){
  // Ensure audit structure exists even in older saves
  if (!state.history || typeof state.history !== "object") state.history = {};
  if (typeof state.history.muEarned !== "number") state.history.muEarned = 0;
  if (typeof state.history.muSpent !== "number") state.history.muSpent = 0;
  if (!("lastMuChange" in state.history)) state.history.lastMuChange = null;

  if (delta > 0) state.history.muEarned += delta;
  if (delta < 0) state.history.muSpent += Math.abs(delta);

  state.history.lastMuChange = {
    delta,
    reason: String(reason || "").slice(0, 140),
    at: Date.now(),
    balance: state.player.credits ?? 0
  };
}

// Centralized helper so we can audit why MU moved.
// (In multiplayer, this would be server-authoritative.)
export function adjustMU(delta, reason = ""){
  const d = Math.floor(Number(delta) || 0);
  if (!d) return { ok:true, delta:0, balance: state.player.credits ?? 0 };

  const before = Math.max(0, Math.floor(Number(state.player.credits) || 0));
  const after = Math.max(0, before + d);
  state.player.credits = after;

  recordMuChange(after - before, reason);
  return { ok:true, delta: after - before, balance: after };
}

export function buyThing(key, qty = 1){
  const q = Math.max(1, Math.floor(Number(qty) || 1));
  const { buy } = pricesFor(key);
  if (!buy) return { ok:false, reason:"Not for sale." };
  const total = buy * q;
  if ((state.player.credits ?? 0) < total) return { ok:false, reason:"Not enough credits." };

  adjustMU(-total, "Bought: " + (thingByKey[key]?.label ?? key) + " x" + q);
  addResources({ [key]: q });
  return { ok:true, spent: total };
}

export function sellThing(key, qty = 1){
  const q = Math.max(1, Math.floor(Number(qty) || 1));
  if (isLocked(key)) return { ok:false, reason:"Locked." };

  const { sell } = pricesFor(key);
  if (!sell) return { ok:false, reason:"Cannot sell." };

  const have = Math.max(0, Math.floor(Number(state.player.inventory?.[key]) || 0));
  if (have < q) return { ok:false, reason:"Not enough to sell." };

  // Remove from inventory
  spendResources({ [key]: q });

  // A1 Upgrade banking: selling filled element tubes can contribute to store upgrades.
  // We bank raw element grams (1 filled tube contributes FILLED_TUBE_GRAMS).
  try{
    const ek = extractElementKeyFromFilledTubeKey(key);
    if (ek) a1DepositElementGrams(ek, q * FILLED_TUBE_GRAMS);
  }catch(_){ /* ignore banking errors */ }

  const gained = sell * q;
  adjustMU(+gained, "Sold: " + (thingByKey[key]?.label ?? key) + " x" + q);

  // Track last sale for quick undo (saved)
  state.player.lastSale = { key, qty: q, gained, at: Date.now() };

  // If you sold your last copy of an equipped item, automatically unequip it.
  if ((state.player.inventory?.[key] ?? 0) <= 0){
    const eq = state.player.equipment ?? {};
    for (const slot of Object.keys(eq)){
      if (eq[slot] === key) eq[slot] = null;
    }
  }

  return { ok:true, gained };
}

export function undoLastSale(){
  const ls = state.player.lastSale;
  if (!ls || typeof ls !== "object") return { ok:false, reason:"Nothing to undo." };

  const key = ls.key;
  const qty = Math.max(1, Math.floor(Number(ls.qty) || 1));
  const gained = Math.max(0, Math.floor(Number(ls.gained) || 0));

  // Need enough credits to reverse the sale.
  if ((state.player.credits ?? 0) < gained) return { ok:false, reason:"Not enough credits to undo." };

  adjustMU(-gained, "Undo sale: " + (thingByKey[key]?.label ?? key) + " x" + qty);
  addResources({ [key]: qty });
  state.player.lastSale = null;
  return { ok:true, restored: key, qty };
}


export function salvageThing(key, qty = null){
  const qReq = (qty === null) ? null : Math.max(1, Math.floor(Number(qty) || 1));
  if (isLocked(key)) return { ok:false, reason:"Locked." };

  const t = thingByKey[key];
  const have = Math.max(0, Math.floor(Number(state.player.inventory?.[key]) || 0));
  if (have <= 0) return { ok:false, reason:"Nothing to salvage." };

  // Only gear is salvageable for now.
  if (!t || t.kind !== "Gear") return { ok:false, reason:"Cannot salvage." };
  const yieldMap = t.salvageYield;
  if (!yieldMap || typeof yieldMap !== "object") return { ok:false, reason:"No salvage output." };

  const q = Math.min(have, qReq ?? have);

  // Remove items
  state.player.inventory[key] = have - q;

  // Add salvage yield (scaled by quantity)
  const gained = {};
  for (const [rk, amt] of Object.entries(yieldMap)){
    const a = Math.max(0, Math.floor(Number(amt) || 0));
    if (!a) continue;
    gained[rk] = (gained[rk] || 0) + a * q;
  }
  addResources(gained);

  // If you salvaged your last copy of an equipped item, automatically unequip it.
  if ((state.player.inventory[key] || 0) <= 0){
    const ch = getActiveCharacter();
    for (const slot of Object.keys(ch.equipment || {})){
      if (ch.equipment[slot] === key) ch.equipment[slot] = null;
    }
    // Keep any legacy mirrors in sync.
    setActiveCharacter(getActiveCharId());
  }

  return { ok:true, salvaged:q, gained };
}

export function deleteThing(key){
  if (isLocked(key)) return { ok:false, reason:"Locked." };
  const have = Math.max(0, Math.floor(Number(state.player.inventory?.[key]) || 0));
  if (have <= 0) return { ok:false, reason:"Nothing to delete." };

  state.player.inventory[key] = 0;

  // If you deleted your last copy of an equipped item, automatically unequip it.
  {
    const ch = getActiveCharacter();
    for (const slot of Object.keys(ch.equipment || {})){
      if (ch.equipment[slot] === key) ch.equipment[slot] = null;
    }
    setActiveCharacter(getActiveCharId());
  }
  return { ok:true, deleted: have };
}


// -----------------------------
// A1 STORE UPGRADES (Astarr link + storefront capacity)
// - Selling filled test tubes of required elements banks progress.
// - Upgrades consume banked tubes (not the player's inventory).
// -----------------------------

const STORE_BASE_REFRESH_MS = 4 * 60 * 60 * 1000; // 4 hours
const STORE_LINK_REFRESH_MS_BY_LEVEL = [
  4 * 60 * 60 * 1000,        // 0: 4h
  3 * 60 * 60 * 1000,        // 1: 3h
  2.25 * 60 * 60 * 1000,     // 2: 2h 15m
  1.75 * 60 * 60 * 1000,     // 3: 1h 45m
  1.3333333333 * 60 * 60 * 1000, // 4: 1h 20m
  1 * 60 * 60 * 1000,        // 5: 1h
  45 * 60 * 1000,            // 6: 45m
];

// Storage expansion ladder (0 -> 8). Each level adds +1 BUY slot.
// Counts are in TUBES for requirements, but A1 banks raw element grams (1 tube = FILLED_TUBE_GRAMS).
const STORE_STORAGE_REQ_BY_LEVEL = [
  null, // 0 (no upgrade)
  { o:400, na:200, ca:200, fe:180, cu:140, c:120 },
  { o:580, na:290, ca:290, fe:250, al:190, cu:190 },
  { o:850, na:430, ca:430, fe:330, cu:240, ni:170 },
  { o:1220, na:610, ca:610, si:210, fe:450, al:350, cu:310 },
  { o:1770, na:890, ca:890, si:250, fe:600, ti:340, cu:400 },
  { o:2570, na:1290, ca:1290, fe:810, w:270, cu:520, ni:380 },
  { o:3720, na:1860, ca:1860, si:360, fe:1090, al:850, cu:680, au:60 },
  { o:5400, na:2700, ca:2700, si:430, ni:630, ti:820, cu:880, pt:40 },
];

// Link improvement ladder (0 -> 6). Each level reduces refresh time.
const STORE_LINK_REQ_BY_LEVEL = [
  null,
  { si:250, cu:200, ag:100 },
  { si:330, cu:260, au:80 },
  { si:430, cu:340, ga:190, ge:190 },
  { si:550, cu:440, in:280, sn:400 },
  { si:720, cu:580, xe:70 },
  { si:930, cu:750, xe:90, pt:130 },
];

function ensureStoreState(){
  if (!state.store || typeof state.store !== "object") state.store = {};
  const s = state.store;
  if (typeof s.capacity !== "number") s.capacity = 8;
  if (typeof s.maxCapacity !== "number") s.maxCapacity = 16;
  if (!Array.isArray(s.stock)) s.stock = [];
  if (typeof s.nextRefreshAt !== "number") s.nextRefreshAt = Date.now() + STORE_BASE_REFRESH_MS;
  if (typeof s.storageLevel !== "number") s.storageLevel = 0;
  if (typeof s.linkLevel !== "number") s.linkLevel = 0;
  if (!s.a1Storage || typeof s.a1Storage !== "object") s.a1Storage = {};
  // A1 storage units migration: older saves stored 'tubes'. New system stores raw element grams (1 tube = FILLED_TUBE_GRAMS).
  if (s.a1StorageUnit !== "grams") {
    try {
      const cur = s.a1Storage || {};
      for (const k of Object.keys(cur)) {
        const v = Math.max(0, Math.floor(Number(cur[k]) || 0));
        if (v) cur[k] = v * FILLED_TUBE_GRAMS;
        else delete cur[k];
      }
      s.a1Storage = cur;
    } catch (_e) { /* ignore */ }
    s.a1StorageUnit = "grams";
  }
  // Keep capacity in sync with ladder progress (defensive).
  s.capacity = Math.max(8, Math.min(s.maxCapacity, 8 + Math.max(0, Math.floor(s.storageLevel || 0))));
  return s;
}

function storeRefreshMs(){
  const s = ensureStoreState();
  const lvl = Math.max(0, Math.min(6, Math.floor(s.linkLevel || 0)));
  return Math.floor(STORE_LINK_REFRESH_MS_BY_LEVEL[lvl] ?? STORE_BASE_REFRESH_MS);
}

function storePinnedKeys(){
  // Keep the basics always available.
  return ["test_tube"].filter(k => !!thingByKey[k]);
}

function computeStorePool(){
  // Any thing with a buyPrice > 0 can appear.
  // Filter out volatile/cosmetic internals as needed.
  const pool = [];
  for (const [k,t] of Object.entries(thingByKey || {})){
    const buy = Math.max(0, Math.floor(Number(t?.buyPrice) || 0));
    if (!buy) continue;
    // Don't sell filled tubes directly; those are player-made commodities.
    if (String(k).startsWith(FILLED_TUBE_PREFIX)) continue;
    // Keep the store inventory focused.
    if (t?.kind !== "Gear" && t?.kind !== "Material" && t?.kind !== "Item" && t?.kind !== "Tool") continue;
    pool.push(k);
  }
  // Stable ordering for deterministic tests (random selection still happens later).
  pool.sort((a,b) => String(a).localeCompare(String(b)));
  return pool;
}

function pickRandomUnique(keys, n){
  const arr = keys.slice();
  // Fisher–Yates
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, Math.max(0, n));
}

export function storeForceRefresh(){
  return storeTick(true);
}

// Called from the 1s tick loop. Returns true if it changed state.
export function storeTick(force = false){
  const s = ensureStoreState();
  const now = Date.now();
  const due = force || !s.stock.length || (Number(s.nextRefreshAt) || 0) <= now;
  if (!due) return false;

  const cap = Math.max(1, Math.floor(Number(s.capacity) || 8));
  const pinned = storePinnedKeys();
  const pool = computeStorePool().filter(k => !pinned.includes(k));
  const want = Math.max(0, cap - pinned.length);
  const picks = pickRandomUnique(pool, want);
  s.stock = [...pinned, ...picks];
  s.nextRefreshAt = now + storeRefreshMs();
  return true;
}

function extractElementKeyFromFilledTubeKey(key){
  const k = String(key || "");
  if (!k.startsWith(FILLED_TUBE_PREFIX)) return null;
  const ek = k.slice(FILLED_TUBE_PREFIX.length);
  return isKnownElementKey(ek) ? ek : null;
}

function a1NeededKeys(){
  const s = ensureStoreState();
  const nextStorage = Math.min(8, Math.max(0, Math.floor(s.storageLevel || 0)) + 1);
  const nextLink = Math.min(6, Math.max(0, Math.floor(s.linkLevel || 0)) + 1);
  const need = new Set();
  const rS = STORE_STORAGE_REQ_BY_LEVEL[nextStorage];
  const rL = STORE_LINK_REQ_BY_LEVEL[nextLink];
  for (const k of Object.keys(rS || {})) need.add(k);
  for (const k of Object.keys(rL || {})) need.add(k);
  return need;
}

function a1DepositElementGrams(elementKey, grams){
  const s = ensureStoreState();
  const ek = String(elementKey || "");
  const q = Math.max(0, Math.floor(Number(grams) || 0));
  if (!q || !isKnownElementKey(ek)) return false;

  // Only bank elements A1 currently needs (keeps storage meaningful).
  const need = a1NeededKeys();
  if (!need.has(ek)) return false;

  s.a1Storage[ek] = Math.max(0, Math.floor(Number(s.a1Storage[ek]) || 0)) + q;
  return true;
}

// Public helper: move element units from the Distillery Cabinet directly into A1's bank.
// This does not require bottling into test tubes.
export function a1DepositFromCabinet(elementKey, grams){
  const ek = String(elementKey || "");
  const q = Math.max(0, Math.floor(Number(grams) || 0));
  if (!q) return { ok:false, reason:"Choose a quantity." };
  if (!isKnownElementKey(ek)) return { ok:false, reason:"Not an element." };
  // Validate cabinet stock (cabinet stores raw element grams).
  ensureDistilleryData();
  const gramsQty = q;
  const haveG = Math.max(0, Math.floor(Number(state.player?.distilleryCabinet?.stored?.[ek]) || 0));
  if (haveG < q) return { ok:false, reason:"Not enough stored in the Distillery Cabinet." };

  // Tentatively remove from cabinet.
  state.player.distilleryCabinet.stored[ek] = haveG - q;

  // Deposit into A1 (only if needed).
  const ok = a1DepositElementGrams(ek, q);
  if (!ok){
    // Roll back cabinet change.
    state.player.distilleryCabinet.stored[ek] = haveG;
    return { ok:false, reason:"A1 doesn't need that right now." };
  }

  return { ok:true, elementKey: ek, grams: q };
}

function a1HasReq(req){
  const s = ensureStoreState();
  for (const [k,need] of Object.entries(req || {})){
    const have = Math.max(0, Math.floor(Number(s.a1Storage?.[k]) || 0));
    const reqG = Math.max(0, Math.floor(Number(need) || 0)) * FILLED_TUBE_GRAMS;
    if (have < reqG) return false;
  }
  return true;
}

function a1SpendReq(req){
  const s = ensureStoreState();
  for (const [k,need] of Object.entries(req || {})){
    const needT = Math.max(0, Math.floor(Number(need) || 0));
    if (!needT) continue;
    const nG = needT * FILLED_TUBE_GRAMS;
    const haveG = Math.max(0, Math.floor(Number(s.a1Storage?.[k]) || 0));
    const left = Math.max(0, haveG - nG);
    if (left) s.a1Storage[k] = left;
    else delete s.a1Storage[k];
  }
}

export function getA1StoreUpgradeStatus(){
  const s = ensureStoreState();
  const storageLevel = Math.max(0, Math.min(8, Math.floor(s.storageLevel || 0)));
  const linkLevel = Math.max(0, Math.min(6, Math.floor(s.linkLevel || 0)));
  const nextStorage = Math.min(8, storageLevel + 1);
  const nextLink = Math.min(6, linkLevel + 1);
  const storageReq = STORE_STORAGE_REQ_BY_LEVEL[nextStorage] || null;
  const linkReq = STORE_LINK_REQ_BY_LEVEL[nextLink] || null;
  const storageReady = !!storageReq && a1HasReq(storageReq);
  const linkReady = !!linkReq && a1HasReq(linkReq);
  return {
    capacity: s.capacity,
    maxCapacity: s.maxCapacity,
    stockCount: Array.isArray(s.stock) ? s.stock.length : 0,
    nextRefreshAt: Number(s.nextRefreshAt) || 0,
    refreshMs: storeRefreshMs(),
    storageLevel,
    linkLevel,
    storageReq,
    linkReq,
    storageReady,
    linkReady,
    banked: { ...(s.a1Storage || {}) },
  };
}

export function a1ApplyStorageUpgrade(){
  const s = ensureStoreState();
  const next = Math.min(8, Math.max(0, Math.floor(s.storageLevel || 0)) + 1);
  const req = STORE_STORAGE_REQ_BY_LEVEL[next];
  if (!req) return { ok:false, reason:"Maxed." };
  if (!a1HasReq(req)) return { ok:false, reason:"Not enough banked elements." };
  a1SpendReq(req);
  s.storageLevel = next;
  s.capacity = Math.max(8, Math.min(s.maxCapacity, 8 + s.storageLevel));
  // Instantly refresh so the new slot appears stocked.
  storeTick(true);
  return { ok:true, storageLevel: s.storageLevel, capacity: s.capacity };
}

export function a1ApplyLinkUpgrade(){
  const s = ensureStoreState();
  const next = Math.min(6, Math.max(0, Math.floor(s.linkLevel || 0)) + 1);
  const req = STORE_LINK_REQ_BY_LEVEL[next];
  if (!req) return { ok:false, reason:"Maxed." };
  if (!a1HasReq(req)) return { ok:false, reason:"Not enough banked elements." };
  a1SpendReq(req);
  s.linkLevel = next;
  // Pull the next refresh forward so upgrades feel immediate.
  s.nextRefreshAt = Math.min(Number(s.nextRefreshAt) || 0, Date.now() + storeRefreshMs());
  return { ok:true, linkLevel: s.linkLevel, refreshMs: storeRefreshMs() };
}

// -----------------------------
// EQUIPMENT (equip/unequip)
// -----------------------------
function inventoryUsedSlots(){
  const inv = state.player?.inventory ?? {};
  return Object.keys(inv).reduce((acc, k) => acc + ((inv[k] ?? 0) > 0 ? 1 : 0), 0);
}

function hasInventorySpaceFor(key){
  const cap = state.player?.inventorySlots ?? 16;
  const inv = state.player?.inventory ?? {};
  if ((inv[key] ?? 0) > 0) return true; // stacking into an existing slot
  return inventoryUsedSlots() < cap;
}

export function equippedSlotFor(key){
  const eq = state.player?.equipment ?? {};
  for (const slot of Object.keys(eq)){
    if (eq[slot] === key) return slot;
  }
  return null;
}


export function toolbeltSlotFor(key){
  const tb = state.player?.toolbelt ?? {};
  for (const slot of Object.keys(tb)){
    if (tb[slot] === key) return slot;
  }
  return null;
}

export function hasTool(key){
  const inv = state.player?.inventory ?? {};
  if ((inv[key] ?? 0) > 0) return true;
  return !!toolbeltSlotFor(key);
}

function firstEmptyToolbeltSlot(){
  const tb = state.player?.toolbelt ?? {};
  const order = Object.keys(tb)
    .filter(k => /^tool\d+$/.test(k))
    .sort((a,b) => {
      const na = Number(a.replace(/^tool/, "")) || 0;
      const nb = Number(b.replace(/^tool/, "")) || 0;
      return na - nb;
    });
  for (const s of order){
    if (!tb[s]) return s;
  }
  return null;
}

export function equipTool(key){
  const t = thingByKey[key];
  if (!t || t.kind !== "Tool") return { ok:false, reason:"Not a tool." };
  if (toolbeltSlotFor(key)) return { ok:true, belted:true, slot: toolbeltSlotFor(key) };

  const have = Math.max(0, Math.floor(Number(state.player?.inventory?.[key]) || 0));
  if (have <= 0) return { ok:false, reason:"Not in inventory." };

  const slot = firstEmptyToolbeltSlot();
  if (!slot) return { ok:false, reason:"Toolbelt full." };

  state.player.inventory[key] = have - 1;
  state.player.toolbelt[slot] = key;
  return { ok:true, belted:true, slot };
}

export function unequipTool(key){
  const slot = toolbeltSlotFor(key);
  if (!slot) return { ok:false, reason:"Not on toolbelt." };

  if (!hasInventorySpaceFor(key)){
    return { ok:false, reason:"No inventory space." };
  }

  state.player.toolbelt[slot] = null;
  state.player.inventory[key] = (state.player.inventory[key] ?? 0) + 1;
  return { ok:true, belted:false, slot };
}

export function toggleToolbelt(key){
  return toolbeltSlotFor(key) ? unequipTool(key) : equipTool(key);
}

function firstEmptySlot(slotId, eq){
  eq = eq || {};
  // Some gear types map to multiple equipment slots.
  if (slotId === "bag"){
    return (!eq.bag1 ? "bag1" : !eq.bag2 ? "bag2" : !eq.bag3 ? "bag3" : null);
  }
  if (slotId === "ring"){
    return (!eq.ring1 ? "ring1" : !eq.ring2 ? "ring2" : null);
  }
  // 1:1 slots
  return eq[slotId] ? null : slotId;
}

export function equipGear(key){
  // Defensive sync: ensure the active character and legacy mirror (state.player.equipment)
  // are aligned before we mutate. This avoids edge-cases where equipping from certain
  // contexts (like the Monster Brawl loot modal) can appear to "eat" the item.
  const activeId = getActiveCharId();
  setActiveCharacter(activeId);

  const t = thingByKey[key];
  if (!t || t.kind !== "Gear") return { ok:false, reason:"Not equippable." };
  const have = Math.max(0, Math.floor(Number(state.player?.inventory?.[key]) || 0));
  if (have <= 0) return { ok:false, reason:"Not in inventory." };

  // already equipped?
  if (equippedSlotFor(key)) return { ok:false, reason:"Already equipped." };

  const slotId = t.slot;
  if (!slotId) return { ok:false, reason:"Missing slot type." };

  const ch = getCharacter(activeId);
  const target = firstEmptySlot(slotId, ch.equipment);
  if (!target) return { ok:false, reason:"Slot already occupied." };

  // move 1 copy from inventory -> equipment
  state.player.inventory[key] = have - 1;
  ch.equipment[target] = key;
  // Keep the legacy mirror explicitly updated (some UI reads from this directly).
  if (!state.player.equipment || typeof state.player.equipment !== "object"){
    state.player.equipment = { ...makeEmptyEquipment() };
  }
  state.player.equipment[target] = key;
  setActiveCharacter(activeId);
  recomputeInventorySlots();
  return { ok:true, equipped:true, slot: target };
}

export function unequipGear(key){
  // Defensive sync: keep the legacy mirror aligned to the active character
  // before making decisions based on equippedSlotFor().
  const activeId = getActiveCharId();
  setActiveCharacter(activeId);

  const slot = equippedSlotFor(key);
  if (!slot) return { ok:false, reason:"Not equipped." };

  // If there is no inventory space, item remains equipped.
  if (!hasInventorySpaceFor(key)){
    return { ok:false, reason:"No inventory space." };
  }

  const ch = getCharacter(activeId);
  ch.equipment[slot] = null;
  if (state.player.equipment && typeof state.player.equipment === "object"){
    state.player.equipment[slot] = null;
  }
  setActiveCharacter(activeId);
  recomputeInventorySlots();
  state.player.inventory[key] = (state.player.inventory[key] ?? 0) + 1;
  return { ok:true, equipped:false, slot };
}

export function toggleQuickSlot(key){
  if (!isAllowedElementKey(key)) return;

  const slots = state.player.quickSlots ?? [];
  const idx = slots.indexOf(key);
  if (idx >= 0) {
    slots.splice(idx,1);
  } else {
    if (slots.length >= 3) return false;
    slots.push(key);
  }
  state.player.quickSlots = slots;
  return true;
}

export function grantBlueprint(blueprintKey){
  if (!state.player.blueprintsOwned.includes(blueprintKey)){
    state.player.blueprintsOwned.push(blueprintKey);
  }
}

function now(){ return Date.now(); }

export function getRefineJob(recipeKey){
  return state.jobs?.refine?.[recipeKey] ?? null;
}

export function startRefineJob(recipeKey){
  const recipe = refineByKey(recipeKey);
  if (!recipe) return { ok:false, reason:"Unknown recipe." };

// v59.19: element lock + tool gating
if (resourcesContainDisallowedElements(recipe.requires)) return { ok:false, reason:"Locked elements." };
if (recipe.requiresTool && !hasTool(recipe.requiresTool)) return { ok:false, reason:`Requires ${labelFor(recipe.requiresTool)}.` };
  if (getRefineJob(recipeKey)) return { ok:false, reason:"Already refining." };
  if (!hasResources(recipe.requires, { useCabinetForElements: true })) return { ok:false, reason:"Missing resources." };

  spendResources(recipe.requires, { useCabinetForElements: true });
  state.jobs.refine[recipeKey] = {
    endAt: now() + recipe.durationMs,
    produces: recipe.produces
  };
  return { ok:true };
}

export function collectRefineJob(recipeKey){
  const job = getRefineJob(recipeKey);
  if (!job) return { ok:false, reason:"No job." };
  if (now() < job.endAt) return { ok:false, reason:"Not finished." };

  addResources(job.produces);
  delete state.jobs.refine[recipeKey];
  return { ok:true };
}

export function getCraftJob(blueprintKey){
  return state.jobs?.craft?.[blueprintKey] ?? null;
}

export function startCraftJob(blueprintKey){
  const bp = blueprintByKey(blueprintKey);
  if (!bp) return { ok:false, reason:"Unknown blueprint." };

// v59.19: element lock + tool gating
if (resourcesContainDisallowedElements(bp.requires)) return { ok:false, reason:"Locked elements." };
if (bp.requiresTool && !hasTool(bp.requiresTool)) return { ok:false, reason:`Requires ${labelFor(bp.requiresTool)}.` };
  if (!state.player.blueprintsOwned.includes(blueprintKey)) return { ok:false, reason:"Blueprint not owned." };
  if (getCraftJob(blueprintKey)) return { ok:false, reason:"Already crafting." };
  // prevent re-crafting backpack upgrade
  if (bp.itemKey === "backpack_mk1" && state.player.upgrades?.backpack_mk1) return { ok:false, reason:"Already built." };
  if (!hasResources(bp.requires, { useCabinetForElements: true })) return { ok:false, reason:"Missing resources." };

  spendResources(stripToolRequirements(bp.requires), { useCabinetForElements: true });
  state.jobs.craft[blueprintKey] = { endAt: now() + bp.durationMs, itemKey: bp.itemKey };
  return { ok:true };
}

export function collectCraftJob(blueprintKey){
  const job = getCraftJob(blueprintKey);
  if (!job) return { ok:false, reason:"No job." };
  if (now() < job.endAt) return { ok:false, reason:"Not finished." };

  addResources({ [job.itemKey]: 1 });
  delete state.jobs.craft[blueprintKey];

  // apply upgrade effects
  if (job.itemKey === "backpack_mk1"){
    state.player.upgrades.backpack_mk1 = true;
    recomputeInventorySlots();

    // Sync legacy fields (player.hp, player.equipment) from the active character for UI compatibility.
    setActiveCharacter(state.player.activeCharId);
  }
  return { ok:true };
}


// -----------------------------
// Story repeatable: The Junkyard (scrap scavenging)
// -----------------------------

// Weight: relative chance (higher = more common).
const JUNKYARD_SCRAP_POOL = [
  { key: "scrap_soda_can", weight: 50 },
  { key: "scrap_plastic_bottle", weight: 70 },
  { key: "scrap_milk_carton", weight: 50 },
  { key: "scrap_rusty_spoon", weight: 20 },
  { key: "scrap_usb_drive", weight: 10 },
  { key: "scrap_old_doorknob", weight: 30 },
  { key: "scrap_toaster_coil", weight: 20 },
  { key: "scrap_paint_tin", weight: 10 },
  { key: "scrap_broken_lightbulb", weight: 30 },
  { key: "scrap_coat_hanger", weight: 40 },
  { key: "scrap_plastic_bag", weight: 60 },
];

function pickWeightedJunkyardScrapKey(){
  // Defensive: never allow an empty pool.
  if (!Array.isArray(JUNKYARD_SCRAP_POOL) || JUNKYARD_SCRAP_POOL.length === 0) return "scrap_soda_can";
  let total = 0;
  for (const it of JUNKYARD_SCRAP_POOL){
    const w = Math.max(0, Math.floor(Number(it?.weight) || 0));
    total += w;
  }
  if (total <= 0) return String(JUNKYARD_SCRAP_POOL[0]?.key || "scrap_soda_can");
  let r = Math.random() * total;
  for (const it of JUNKYARD_SCRAP_POOL){
    const w = Math.max(0, Math.floor(Number(it?.weight) || 0));
    r -= w;
    if (r < 0) return String(it?.key || "scrap_soda_can");
  }
  return String(JUNKYARD_SCRAP_POOL[JUNKYARD_SCRAP_POOL.length - 1]?.key || "scrap_soda_can");
}

function ensureJunkyardJob(){
  if (!state.jobs || typeof state.jobs !== "object") state.jobs = {};
  if (!state.jobs.junkyard || typeof state.jobs.junkyard !== "object"){
    state.jobs.junkyard = { active:false, endAt:0, pendingKey:null };
  }
  // Normalize
  const j = state.jobs.junkyard;
  j.active = !!j.active;
  j.endAt = Math.max(0, Math.floor(Number(j.endAt) || 0));
  j.pendingKey = j.pendingKey ? String(j.pendingKey) : null;
  return j;
}

export function startJunkyardScavenge(){
  const j = ensureJunkyardJob();
  const t = now();
  if (j.active && t < j.endAt) return { ok:false, reason:"Already scavenging." };

  // Clear last result text so the story node can show a clean countdown.
  if (!state.ui || typeof state.ui !== "object") state.ui = {};
  state.ui.lastJunkyardLoot = null;

  // Pick reward up front so the result feels deterministic once started.
  const pick = pickWeightedJunkyardScrapKey();
  j.active = true;
  j.endAt = t + 20_000;
  j.pendingKey = pick;
  return { ok:true };
}

// Called from the 1s tick loop in bootstrap. Returns true if it changed state.
export function junkyardTick(){
  const j = ensureJunkyardJob();
  if (!j.active) return false;
  const t = now();
  if (t < j.endAt) return false;

  // Complete the run.
  j.active = false;
  j.endAt = 0;
  const key = j.pendingKey || pickWeightedJunkyardScrapKey();
  j.pendingKey = null;

  addResources({ [key]: 1 });

  // History: count scraps found.
  if (!state.history || typeof state.history !== "object") state.history = {};
  state.history.scrapsFound = Math.max(0, Math.floor(Number(state.history.scrapsFound) || 0)) + 1;

  if (!state.ui || typeof state.ui !== "object") state.ui = {};
  state.ui.lastJunkyardLoot = { key, label: labelFor(key), qty: 1, at: Date.now() };
  state.ui.lootModal = {
    open: true,
    title: "The Junkyard",
    enemyName: "",
    itemCount: 1,
    blueprintCount: 0,
    items: [{ key, qty: 1, kind: "item" }],
    // Junkyard quality-of-life: allow immediate salvage into the Distillery Cabinet.
    primaryLabel: "Salvage",
    primaryAction: { kind: "junkyard_salvage", scrapKey: key, qty: 1 },
    at: Date.now(),
  };

  return true;
}

export function labelFor(key){
  return thingByKey[key]?.label ?? key;
}

export function symbolFor(key){
  return thingByKey[key]?.symbol ?? key.toUpperCase();
}


// -----------------------------
// Refining v2: Distillery Cabinet + Distiller
// - Cabinet stores elements outside the backpack (per-element cap + upgrades)
// - Distiller turns scraps into their primary elements and routes them into the Cabinet
// -----------------------------

const DISTILLERY_BASE_CAP = 200;
const DISTILLERY_STEP_BASE = 50;
const DISTILLERY_STEP_MILESTONE_BONUS = 5; // +5 cap gain every 10 upgrades
const DISTILLERY_COST_BASE_SI = 50;
const DISTILLERY_COST_BASE_O = 100;
const DISTILLERY_COST_EXP = 1.15; // power scaling for grindy infinite upgrades

// Distillery Cabinet pressure valves
// - Test Tubes are a *wasteful* way to clear cabinet space when a container blocks further distilling.
// - They deliberately pay out very little MU so scrap selling remains the primary money loop.
const TEST_TUBE_KEY = "test_tube";
const TEST_TUBE_GRAMS = Math.max(1, Math.floor(Number(FILLED_TUBE_GRAMS) || 100)); // 1 unit = 1 gram; 1 tube holds 100g
const COMMODITY_PAYOUT_MULT = 1.0; // payout multiplier applied to each element's base MU/g

// When selling a filled Test Tube to the commodity buyer, the buyer also pays a small
// fixed "container return" value per tube. This prevents early-game low-value elements
// from frequently rounding down to 0 MU and makes bottling feel worthwhile.
// (This is effectively a refundable deposit for returning a certified container.)
const TEST_TUBE_RETURN_MU = 5;

// Fallback base values if an element isn't annotated yet.
const FALLBACK_MU_PER_G_BY_TIER = {
  6: 0.02,
  5: 0.03,
  4: 0.05,
  3: 0.08,
  2: 0.12,
  1: 0.20,
};

function commodityBaseMuPerGramForElement(ek){
  const t = thingByKey[String(ek)] || {};
  const direct = Number(t.baseMuPerGram);
  if (Number.isFinite(direct) && direct >= 0) return direct;
  const tier = Math.max(1, Math.min(6, Math.floor(Number(t.tier) || 6)));
  return Number(FALLBACK_MU_PER_G_BY_TIER[tier]) || 0;
}

function commodityPayoutMuForElement(ek, grams){
  const g = Math.max(0, Math.floor(Number(grams) || 0));
  if (g <= 0) return 0;
  const basePerG = commodityBaseMuPerGramForElement(ek);
  const base = basePerG * g;
  return Math.max(0, Math.floor(base * COMMODITY_PAYOUT_MULT));
}

// Distillery Cabinet upgrade pacing:
// - Always doable: costs are capped to the current max of the relevant container(s).
// - Grindy but fair: primary cost is ~50% of the container max (rounded up).
// - Glass container: also requires Silicon (half of the primary cost).
const DISTILLERY_UPGRADE_PRIMARY_RATIO = 0.5;
const DISTILLERY_UPGRADE_SILICON_RATIO = 0.5;

function distilleryUpgradePrimaryCostFromCap(cap){
  const c = Math.max(0, Math.floor(Number(cap) || 0));
  if (c <= 1) return 1;
  const ratioCost = Math.max(1, Math.ceil(c * DISTILLERY_UPGRADE_PRIMARY_RATIO));
  return Math.min(c - 1, ratioCost);
}

function distilleryUpgradeSiliconCostFromPrimary(primaryCost){
  const p = Math.max(0, Math.floor(Number(primaryCost) || 0));
  if (p <= 0) return 0;
  // Silicon cost is half the primary cost, but must also be storable in the Silicon container.
  const siCap = distilleryCapFor("si");
  if (siCap <= 1) return 1;
  const want = Math.max(1, Math.ceil(p * DISTILLERY_UPGRADE_SILICON_RATIO));
  return Math.min(siCap - 1, want);
}

function distilleryCapFromLevel(level){
  const lvl = Math.max(0, Math.floor(Number(level) || 0));
  const fullBlocks = Math.floor(lvl / 10);
  const rem = lvl % 10;
  // Full blocks of 10 upgrades: gain per upgrade increases by +5 each block.
  // Block 0: +50, block 1: +55, block 2: +60, ...
  const gainFull = (500 * fullBlocks) + (25 * fullBlocks * (fullBlocks - 1));
  const gainRem = rem * (DISTILLERY_STEP_BASE + (DISTILLERY_STEP_MILESTONE_BONUS * fullBlocks));
  return DISTILLERY_BASE_CAP + gainFull + gainRem;
}

function distilleryNextUpgradeGain(currentLevel){
  const lvl = Math.max(0, Math.floor(Number(currentLevel) || 0));
  // Gain is based on the current level (so upgrades 1-10 are +50, 11-20 are +55, etc.)
  return DISTILLERY_STEP_BASE + (DISTILLERY_STEP_MILESTONE_BONUS * Math.floor(lvl / 10));
}

function distilleryCostMultForNextLevel(nextLevel){
  const n = Math.max(1, Math.floor(Number(nextLevel) || 1));
  // Gentle power curve: grindy over time, but not instantly absurd.
  return Math.max(1, Math.ceil(Math.pow(n, DISTILLERY_COST_EXP)));
}

function rollDistillYield(entry){
  // Supports:
  // - number: fixed amount
  // - {min,max}: uniform integer in [min,max]
  // - {min,max,chance}: same, but only occurs with probability "chance" (0..1)
  if (entry == null) return 0;
  if (typeof entry === "number") return Math.max(0, Math.floor(entry));
  if (typeof entry !== "object") return 0;

  const chance = (typeof entry.chance === "number") ? entry.chance : 1;
  if (chance < 1 && Math.random() > Math.max(0, Math.min(1, chance))) return 0;

  let min = (entry.min != null) ? entry.min : (entry.value != null ? entry.value : 0);
  let max = (entry.max != null) ? entry.max : (entry.value != null ? entry.value : min);
  min = Math.floor(Number(min) || 0);
  max = Math.floor(Number(max) || 0);
  if (max < min) [min, max] = [max, min];
  if (min === max) return Math.max(0, min);
  return Math.max(0, min + Math.floor(Math.random() * (max - min + 1)));
}

function ensureDistilleryData(){
  if (!state.player || typeof state.player !== "object") state.player = {};
  if (!state.player.distilleryCabinet || typeof state.player.distilleryCabinet !== "object"){
    state.player.distilleryCabinet = { stored: {}, caps: {}, levels: {} };
  }
  const cab = state.player.distilleryCabinet;
  if (!cab.stored || typeof cab.stored !== "object") cab.stored = {};
  if (!cab.caps || typeof cab.caps !== "object") cab.caps = {};
  if (!cab.levels || typeof cab.levels !== "object") cab.levels = {};

  // Migration notes:
  // Older saves used base 1000 and step 500 (caps-only). We now use explicit levels + a lower base cap.
  // If we detect an old-style cap, we infer an approximate level, then recompute caps with the new curve.
  const OLD_BASE = 1000;
  const OLD_STEP = 500;

  for (const ek of ALL_ELEMENT_KEYS){
    if (typeof cab.stored[ek] !== "number") cab.stored[ek] = 0;
    cab.stored[ek] = Math.max(0, Math.floor(Number(cab.stored[ek]) || 0));

    // Infer/validate level
    let lvl = cab.levels[ek];
    if (typeof lvl !== "number" || !Number.isFinite(lvl)){
      // Infer from old caps if present
      const oldCap = Math.floor(Number(cab.caps[ek]) || 0);
      if (oldCap >= OLD_BASE){
        lvl = Math.max(0, Math.floor((oldCap - OLD_BASE) / OLD_STEP));
      }else{
        lvl = 0;
      }
    }
    lvl = Math.max(0, Math.floor(Number(lvl) || 0));
    cab.levels[ek] = lvl;

    // Recompute cap from level
    const cap = distilleryCapFromLevel(lvl);
    cab.caps[ek] = cap;

    // Prevent resource loss on migration: spill overflow back to inventory.
    if (cab.stored[ek] > cap){
      const overflow = cab.stored[ek] - cap;
      cab.stored[ek] = cap;
      addResources({ [ek]: overflow });
    }
  }
}

export function distilleryCapFor(elementKey){
  ensureDistilleryData();
  const ek = String(elementKey);
  return Math.max(0, Math.floor(Number(state.player.distilleryCabinet?.caps?.[ek]) || 0));
}

export function distilleryStoredFor(elementKey){
  ensureDistilleryData();
  const ek = String(elementKey);
  return Math.max(0, Math.floor(Number(state.player.distilleryCabinet?.stored?.[ek]) || 0));
}

export function distilleryNextUpgradeGainFor(elementKey){
  ensureDistilleryData();
  const ek = String(elementKey);
  if (!isKnownElementKey(ek)) return 0;
  const curCap = distilleryCapFor(ek);
  const curLvl = Math.max(0, Math.floor(Number(state.player.distilleryCabinet?.levels?.[ek]) || 0));
  const nextCap = distilleryCapFromLevel(curLvl + 1);
  return Math.max(0, nextCap - curCap);
}


export function distilleryUpgradeCostFor(elementKey){
  ensureDistilleryData();
  const ek = String(elementKey);
  if (!isKnownElementKey(ek)) return null;

  // Consistent rule for ALL containers:
  // - Primary cost is ALWAYS paid in Oxygen (glasswork / life-support effort), from the cabinet.
  // - Silicon is required as a glass material (from the cabinet).
  const cap = distilleryCapFor(ek);
  const oCap = distilleryCapFor("o");

  // Primary cost is scaled from the target container's cap, but must be storable in the Oxygen container.
  const ratioCost = Math.max(1, Math.ceil(Math.max(0, cap) * DISTILLERY_UPGRADE_PRIMARY_RATIO));
  const primary = (cap <= 1 || oCap <= 1)
    ? 1
    : Math.min(cap - 1, oCap - 1, ratioCost);
  const silicon = distilleryUpgradeSiliconCostFromPrimary(primary);

  return { o: primary, si: silicon };
}

export function distilleryStoreElement(elementKey, qty = null){
  ensureDistilleryData();
  const ek = String(elementKey);
  if (!isKnownElementKey(ek)) return { ok:false, reason:"Not an element." };

  const have = Math.max(0, Math.floor(Number(state.player.inventory?.[ek]) || 0));
  if (have <= 0) return { ok:false, reason:"None in inventory." };

  const cap = distilleryCapFor(ek);
  const stored = distilleryStoredFor(ek);
  const space = Math.max(0, cap - stored);
  const wanted = (qty === null) ? have : Math.max(1, Math.floor(Number(qty) || 1));
  const move = Math.min(have, space, wanted);
  if (move <= 0) return { ok:false, reason:"Container full." };

  spendResources({ [ek]: move });
  state.player.distilleryCabinet.stored[ek] = stored + move;
  return { ok:true, moved: move, stored: stored + move, cap };
}

export function distilleryUnloadInventory(){
  // Move any elements in the player's inventory into the matching cabinet containers.
  // This is best-effort: non-elements are ignored; full containers will clamp transfers.
  ensureDistilleryData();
  const inv = (state.player && state.player.inventory) ? state.player.inventory : {};
  const movedByKey = {};
  let movedTotal = 0;

  for (const k of Object.keys(inv || {})){
    const have = Math.max(0, Math.floor(Number(inv[k]) || 0));
    if (have <= 0) continue;
    const res = distilleryStoreElement(k, null);
    if (res && res.ok && (res.moved || 0) > 0){
      movedByKey[k] = (movedByKey[k] || 0) + res.moved;
      movedTotal += res.moved;
    }
  }

  if (movedTotal <= 0){
    return { ok:false, reason:"No elements to unload (or containers are full)." };
  }
  return { ok:true, movedTotal, movedByKey };
}

// Bottle element grams into filled Test Tubes (inventory items).
// - Consumes 1 empty Test Tube per bottle.
// - Each bottle always contains 100g.
// - Produces a *real item* (e.g., "Silica Sip (Si)") that can be sold in the General Store.
export function distilleryBottle(elementKey, tubeQty = 1){
  ensureDistilleryData();
  const ek = String(elementKey);
  if (!isKnownElementKey(ek)) return { ok:false, reason:"Not an element." };

  const haveTubes = Math.max(0, Math.floor(Number(state.player?.inventory?.[TEST_TUBE_KEY]) || 0));
  if (haveTubes <= 0) return { ok:false, reason:"No Test Tubes." };

  const stored = distilleryStoredFor(ek);
  if (stored < TEST_TUBE_GRAMS) return { ok:false, reason:`Need at least ${TEST_TUBE_GRAMS}g stored to bottle.` };

  const wantTubes = Math.max(1, Math.floor(Number(tubeQty) || 1));
  const maxByStored = Math.floor(stored / TEST_TUBE_GRAMS);
  const tubesToUse = Math.min(haveTubes, wantTubes, maxByStored);
  if (tubesToUse <= 0) return { ok:false, reason:"Nothing to bottle." };

  const gramsMoved = tubesToUse * TEST_TUBE_GRAMS;

  // Spend empty tubes from backpack
  spendResources({ [TEST_TUBE_KEY]: tubesToUse });

  // Remove grams from cabinet
  state.player.distilleryCabinet.stored[ek] = Math.max(0, stored - gramsMoved);

  // Add filled tube items to inventory
  const filledKey = filledTubeKeyForElementKey(ek);
  addResources({ [filledKey]: tubesToUse });

  setStatus(`Bottled ${tubesToUse} × ${TEST_TUBE_GRAMS}g of ${labelFor(ek)}.`);
  return { ok:true, elementKey: ek, filledKey, gramsMoved, tubesUsed: tubesToUse, storedAfter: distilleryStoredFor(ek) };
}

// Permanently discard stored grams (no MU). Useful if the player wants to unblock distilling without tubes.
export function distilleryDumpElement(elementKey, grams = null){
  ensureDistilleryData();
  const ek = String(elementKey);
  if (!isKnownElementKey(ek)) return { ok:false, reason:"Not an element." };

  const stored = distilleryStoredFor(ek);
  if (stored <= 0) return { ok:false, reason:"Nothing stored." };

  const want = (grams === null) ? stored : Math.max(1, Math.floor(Number(grams) || 1));
  const drop = Math.min(stored, want);
  state.player.distilleryCabinet.stored[ek] = Math.max(0, stored - drop);
  return { ok:true, elementKey: ek, gramsDropped: drop, storedAfter: distilleryStoredFor(ek) };
}


export function distilleryUpgradeContainer(elementKey){
  ensureDistilleryData();
  const ek = String(elementKey);
  if (!isKnownElementKey(ek)) return { ok:false, reason:"Not an element." };

  const cost = distilleryUpgradeCostFor(ek);
  if (!cost) return { ok:false, reason:"No upgrade path." };

  // Upgrade costs are paid from the Distillery Cabinet itself (stored elements).
  for (const [ck, cv0] of Object.entries(cost)){
    const cv = Math.max(0, Math.floor(Number(cv0) || 0));
    if (cv <= 0) continue;
    const have = distilleryStoredFor(ck);
    if (have < cv){
      return { ok:false, reason:`Not enough ${labelFor(ck)} stored.`, cost, from:"cabinet" };
    }
  }

  const curLvl = Math.max(0, Math.floor(Number(state.player.distilleryCabinet?.levels?.[ek]) || 0));
  const nextLvl = curLvl + 1;
  const nextCap = distilleryCapFromLevel(nextLvl);
  const gain = Math.max(0, nextCap - distilleryCapFor(ek));

  // Spend from cabinet
  for (const [ck, cv0] of Object.entries(cost)){
    const cv = Math.max(0, Math.floor(Number(cv0) || 0));
    if (cv <= 0) continue;
    const have = distilleryStoredFor(ck);
    state.player.distilleryCabinet.stored[ck] = Math.max(0, have - cv);
  }

  state.player.distilleryCabinet.levels[ek] = nextLvl;
  state.player.distilleryCabinet.caps[ek] = nextCap;

  return { ok:true, gainedCap: gain, cap: nextCap, level: nextLvl, cost, from:"cabinet" };
}

export function knownDistilledScraps(){
  ensureDistilleryData();
  return new Set(Object.keys(state.player.distillerKnownScraps || {}).filter(k => !!state.player.distillerKnownScraps[k]));
}

export function distillScrap(scrapKey, qty = 1){
  ensureDistilleryData();
  const key = String(scrapKey);
  const t = thingByKey[key];
  const yieldMap = t?.distillYield;
  if (!yieldMap || typeof yieldMap !== "object") return { ok:false, reason:"Cannot distill this scrap yet." };

  const have = Math.max(0, Math.floor(Number(state.player.inventory?.[key]) || 0));
  if (have <= 0) return { ok:false, reason:"Not enough scrap." };

  const qReq = Math.max(1, Math.floor(Number(qty) || 1));
  const q = Math.min(have, qReq);

  // Roll outputs first (small randomness), then check capacity with the rolled total.
  const gained = {};
  for (let i = 0; i < q; i++){
    for (const [ek0, entry] of Object.entries(yieldMap)){
      const ek = String(ek0);
      if (!isKnownElementKey(ek)) return { ok:false, reason:`Unknown output: ${ek}` };
      const add = rollDistillYield(entry);
      if (!add) continue;
      gained[ek] = (gained[ek] || 0) + add;
    }
  }

  // Pre-check: if any output container would overflow, block the distillation (no scrap spent).
  for (const [ek, add] of Object.entries(gained)){
    const cap = distilleryCapFor(ek);
    const stored = distilleryStoredFor(ek);
    if (stored + add > cap){
      return { ok:false, reason:`${labelFor(ek)} container is full.`, blocked: ek, wouldGain: gained };
    }
  }

  // Remove scrap
  spendResources({ [key]: q });

  // Add to cabinet
  for (const [ek, add] of Object.entries(gained)){
    state.player.distilleryCabinet.stored[ek] = distilleryStoredFor(ek) + add;
  }

  // XP: 0.25 XP per Stable element unit distilled from a scrap.
  let stableUnits = 0;
  for (const [ek, amt] of Object.entries(gained)){
    if (Number(thingByKey[ek]?.tier) === 6){
      stableUnits += Math.max(0, Number(amt) || 0);
    }
  }
  const xpGained = stableUnits * 0.25;
  const xpRes = xpGained > 0 ? addAttributeXp("distillery", xpGained) : { ok:true, gained:0 };

  // Remember this scrap forever.
  state.player.distillerKnownScraps[key] = true;

  return { ok:true, scrapKey: key, qty: q, gained, xp: xpRes.gained || 0 };
}




// -----------------------------
// Monster Brawl (RS combat + typing)
// Replaces all legacy combat. Turn-based UI remains menu-driven.
// -----------------------------

// Combat typing (temporary v1): Water / Fire / Electric + Normal
// Paper-scissors-rock: Water > Fire > Electric > Water
const BEATS = { water: 'fire', fire: 'electric', electric: 'water' };

function normType(t){
  return String(t || 'normal').toLowerCase();
}

function typeMultiplier(attackType, defenderTypes){
  const a = normType(attackType);
  if (a === 'normal') return 1;

  const defs = Array.isArray(defenderTypes) ? defenderTypes : (defenderTypes ? [defenderTypes] : []);
  let mult = 1;
  for (const d0 of defs){
    const d = normType(d0);
    if (d === 'normal') continue;
    if (a === d){
      mult *= 0.75; // same-type resistance for elementals
    } else if (BEATS[a] === d){
      mult *= 1.5; // super effective
    } else if (BEATS[d] === a){
      mult *= 0.75; // not very effective
    }
  }
  if (!Number.isFinite(mult)) mult = 1;
  return Math.max(0, Math.min(2, mult));
}

function typeTag(mult){
  if (mult >= 1.5) return "It's super effective!";
  if (mult <= 0.75) return "It's not very effective…";
  return "";
}

// OSRS-style hit chance from rolls
function osrsHitChance(attackRoll, defenceRoll){
  const a = Math.max(0, Math.floor(Number(attackRoll) || 0));
  const d = Math.max(0, Math.floor(Number(defenceRoll) || 0));
  if (a > d) return 1 - (d + 2) / (2 * (a + 1));
  return a / (2 * (d + 1));
}

function osrsMaxHit(strLevel, strBonus){
  const s = Math.max(1, Math.floor(Number(strLevel) || 1));
  const b = Math.max(0, Math.floor(Number(strBonus) || 0));
  return Math.max(1, Math.floor(0.5 + (s * (b + 64)) / 640));
}

function gearBonusesForChar(charId){
  const ch = getCharacter(charId);
  const eq = ch?.equipment || {};
  let attackBonus = 0;
  let strengthBonus = 0;
  let defenceBonus = 0;
  let extraHitPassive = false;

  for (const key of Object.values(eq)){
    if (!key) continue;
    const thing = thingByKey[key];
    const eff = thing?.effect || {};
    // Map old gear effects into RS bonuses.
    if (typeof eff.accuracy === "number") attackBonus += Math.round(eff.accuracy * 8);
    if (typeof eff.defense === "number") defenceBonus += Math.round(eff.defense * 8);
    if (typeof eff.strength === "number") strengthBonus += Math.round(eff.strength * 8);
    if (typeof eff.speed === "number"){
      // Speed becomes a small accuracy boost in this system.
      attackBonus += Math.round(eff.speed * 4);
    }
    if (eff.attacksPerTurn && key === "twinstrike_gloves"){
      extraHitPassive = true;
    }
  }
  return { attackBonus, strengthBonus, defenceBonus, extraHitPassive };
}


export const BRAWL_MOVES = {
  // Base moves (shared)
  strike: { name: "Strike", type:"normal", accMod: 1.00, maxHitMod: 1.00, flatMaxHit: 1, hits: 1, desc: "A quick, reliable slash attack." },
  twin_swing: { name: "Twin Swing", type:"normal", accMod: 0.95, maxHitMod: 0.75, flatMaxHit: 0, hits: 2, desc: "Two quick hits." },
  feint: { name: "Feint", type:"normal", accMod: 1.10, maxHitMod: 0.80, flatMaxHit: 0, hits: 1, desc: "Accurate poke." },
  overcharge: { name: "Overcharge", type:"normal", accMod: 0.85, maxHitMod: 1.35, flatMaxHit: 1, hits: 1, desc: "Big hit. Risky." },

  // Jackson movepool
  show_off: { name: "Show Off", type:"normal", noDamage: true, desc: "Reduces the enemy's Accuracy." },
  spit: { name: "Spit", type:"water", accMod: 1.05, maxHitMod: 1.00, flatMaxHit: 1, hits: 1, desc: "A gross little water blast." },
  shoulder_charge: { name: "Shoulder Charge", type:"normal", accMod: 0.75, maxHitMod: 1.25, flatMaxHit: 2, hits: 1, desc: "A heavy hit, if it lands." },
  glare: { name: "Glare", type:"normal", noDamage: true, desc: "Reduces the enemy's defence." },
  clothesline: { name: "Clothesline", type:"normal", accMod: 1.00, maxHitMod: 1.00, flatMaxHit: 2, hits: 1, desc: "A brutal hit (designed to hit multiple enemies)." },
  breakdown: { name: "Breakdown", type:"normal", noDamage: true, desc: "Greatly increases your Accuracy." },
  resolve: { name: "Resolve", type:"normal", noDamage: true, desc: "Endure and survive with at least 1 HP next turn." },

  // Colt typed move
  zap:  { name: "Zap",  type:"electric", accMod: 1.02, maxHitMod: 1.05, flatMaxHit: 0, hits: 1, desc: "Electric jab." },

  // Gadget-attacks (used via Tech → Gadgets)
  squirt: { name: "Squirt", type:"water", accMod: 0.90, maxHitMod: 1.00, flatMaxHit: 0, hits: "1-2", desc: "I can't believe this actually works." },
  soak:   { name: "Soak",   type:"water", accMod: 0.90, maxHitMod: 1.20, flatMaxHit: 0, hits: "2-4", desc: "Or we could just soak them." },
};


export const BRAWL_TECH = {
  guard: { name: "Guard", desc: "Boost defence for the next enemy hit." },
  analyze: { name: "Analyze", desc: "Reveal typing and boost accuracy briefly." },
};


// Per-character movepools (level-gated).
// Jackson's list comes from Jackson Movepool.txt.
const CHARACTER_MOVEPOOL = {
  jackson: [
    { level: 1,  key: "strike" },
    { level: 2,  key: "show_off" },
    { level: 5,  key: "spit" },
    { level: 7,  key: "shoulder_charge" },
    { level: 15, key: "glare" },
    { level: 17, key: "clothesline" },
    { level: 85, key: "breakdown" },
    { level: 99, key: "resolve" },
  ],
  // Colt still uses the small shared set until you provide a Colt movepool.
  colt: [
    { level: 1, key: "zap" },
    { level: 1, key: "strike" },
    { level: 1, key: "twin_swing" },
    { level: 1, key: "feint" },
    { level: 1, key: "overcharge" },
  ],
};

// Gadget battle actions (Tech → Gadgets). These are level-gated and consume charges.
export const GADGET_BRAWL_META = {
  basketball:   { actionName: "Point Guard", reqLevel: 8,  moveKey: null },     // buff
  water_pistol: { actionName: "Squirt",      reqLevel: 12, moveKey: "squirt" }, // attack
  mouthguard:   { actionName: "Grin",        reqLevel: 18, moveKey: null },     // buff + next-hit
  super_soaker: { actionName: "Soak",        reqLevel: 36, moveKey: "soak" },   // attack
};

function movePoolForChar(charId){
  const ch = getCharacter(charId);
  const lvl = Math.max(1, Math.floor(Number(ch?.level) || 1));
  const pool = CHARACTER_MOVEPOOL[charId] || [];
  const unlocked = pool
    .filter(m => lvl >= (m.level || 1))
    .map(m => m.key)
    .filter(k => !!BRAWL_MOVES?.[k]);

  // Always ensure Strike exists so the player is never stuck.
  if (!unlocked.includes("strike") && BRAWL_MOVES?.strike) unlocked.unshift("strike");
  return [...new Set(unlocked)];
}

export function getMovePoolForChar(charId){
  return movePoolForChar(charId);
}

export function getGadgetBattleActionName(gadgetKey){
  return GADGET_BRAWL_META?.[gadgetKey]?.actionName || labelFor(gadgetKey);
}

export function getGadgetBattleReqLevel(gadgetKey){
  return Math.max(1, Math.floor(Number(GADGET_BRAWL_META?.[gadgetKey]?.reqLevel) || 1));
}

export function getGadgetBattleMoveKey(gadgetKey){
  return GADGET_BRAWL_META?.[gadgetKey]?.moveKey || null;
}

// Gadgets: items that can be charged outside battle and consumed inside battle.
// Rank affects max charges and duration.
const GADGET_EFFECTS = {
  basketball: {
    name: "Basketball",
    techLabel: "Point Guard",
    desc: "Boost accuracy for a few turns.",
    onUse(b, duration){
      if (!b.buffs) b.buffs = {};
      b.buffs.accBoostTurns = Math.max(b.buffs.accBoostTurns||0, duration);
      b.buffs.accBoost = 0.12;
      return ["You take your stance.", "Accuracy up!"]; 
    }
  },
  mouthguard: {
    name: "Mouthguard",
    techLabel: "Grin",
    desc: "Lose Accuracy and gain Power. Your next attack hits harder.",
    onUse(b, duration){
      if (!b.buffs) b.buffs = {};
      // Lasts for a limited number of turns, and is consumed on your next attack.
      b.buffs.grinTurns = Math.max(b.buffs.grinTurns || 0, duration);
      b.buffs.nextAttackMult = 1.5;
      b.buffs.nextAttackAccMult = 0.88;
      return ["You grin behind the mouthguard.", "Power up, Accuracy down!"];
    }
  },
  water_pistol: {
    name: "Water Pistol",
    techLabel: "Squirt",
    desc: "Splash the enemy and soften their defence.",
    onUse(b, duration){
      if (!b.debuffs) b.debuffs = {};
      b.debuffs.enemyDefDownTurns = Math.max(b.debuffs.enemyDefDownTurns||0, duration);
      b.debuffs.enemyDefDownMult = 0.85;
      // small chip damage
      if (b.enemy){
        b.enemy.hp = Math.max(0, Math.floor((b.enemy.hp||0) - 1));
      }
      return ["You spray a cold stream.", "Enemy defence down!"]; 
    }
  },
  super_soaker: {
    name: "Super Soaker",
    techLabel: "Soak",
    desc: "Heavy splash and bigger defence drop.",
    onUse(b, duration){
      if (!b.debuffs) b.debuffs = {};
      b.debuffs.enemyDefDownTurns = Math.max(b.debuffs.enemyDefDownTurns||0, duration);
      b.debuffs.enemyDefDownMult = 0.75;
      if (b.enemy){
        b.enemy.hp = Math.max(0, Math.floor((b.enemy.hp||0) - 2));
      }
      return ["You blast them point-blank.", "Enemy defence way down!"]; 
    }
  },
};

function clamp01(x){ return Math.max(0, Math.min(1, Number(x) || 0)); }

function ensureBattleState(){
  if (!state.battle || typeof state.battle !== "object") state.battle = null;
  return state.battle;
}

export function startMonsterBrawl(){
  // Start brawl for the currently active character.
  const charId = getActiveCharId();
  setActiveCharacter(charId);

  state.battle = {
    type: "monster_brawl",
    active: true,
    menu: "root", // root | move | item | tech
    playerCharId: charId,
    msgLines: ["A Vulkraine minion squares up."],

    enemy: {
      key: "vulkraine_minion",
      name: "Gravelling Minion",
      level: 1,
      types: ["fire"],
      // Enemy uses RS stats too
      stats: { attack: 1, strength: 1, defence: 1 },
      // Keep early-game goblin vibes: small bonuses.
      bonuses: { attack: 0, strength: 0, defence: 0 },
      maxHp: 5,
      hp: 5,
    },

    items: { synthfruit: 2 },
    buffs: { analyzedTurns: 0, guardOnce: false, accBoostTurns: 0, accBoost: 0, defBoostTurns: 0, defBoostMult: 1 },
    debuffs: { enemyDefDownTurns: 0, enemyDefDownMult: 1 },
    lastTurnAt: Date.now(),
  };
  return true;
}

export function battleStatus(){
  const b = ensureBattleState();
  if (!b || !b.active) return null;
  return b;
}

function setBattleMsg(lines){
  const b = battleStatus();
  if (!b) return;
  const arr = Array.isArray(lines) ? lines : [String(lines ?? "")];
  b.msgLines = arr.filter(Boolean);
}

function enemyChooseMove(){
  // Simple pattern: mostly normal swipes, sometimes a fire bite.
  const r = Math.random();
  if (r < 0.25) return { name:"Flare Bite", type:"fire", accMod:0.92, maxHitMod:1.15, flatMaxHit:0 };
  return { name:"Claw", type:"normal", accMod:0.98, maxHitMod:1.00, flatMaxHit:0 };
}

function rollPlayerHit(charId, move){
  const ch = getCharacter(charId);
  const gb = gearBonusesForChar(charId);
  const atkLvl = getCombatStatLevel(charId, "attack");
  const defLvlE = Math.max(1, Math.floor(Number(state.battle.enemy?.stats?.defence || 1)));
  const atkRoll = (atkLvl) * (gb.attackBonus + 64);
  const defRoll0 = (defLvlE) * ((state.battle.enemy?.bonuses?.defence || 0) + 64);
  let defRoll = defRoll0;
  if ((state.battle.debuffs?.enemyDefDownTurns || 0) > 0) defRoll = Math.max(1, Math.floor(defRoll * (state.battle.debuffs.enemyDefDownMult || 1)));
  let chance = osrsHitChance(atkRoll, defRoll);
  if ((state.battle.buffs?.analyzedTurns || 0) > 0) chance = Math.min(0.98, chance + 0.10);
  if ((state.battle.buffs?.accBoostTurns || 0) > 0) chance = Math.min(0.98, chance + (state.battle.buffs?.accBoost || 0));
  chance = clamp01(chance * (move?.accMod ?? 1));
  if ((state.battle.buffs?.nextAttackAccMult || 0) > 0) chance = clamp01(chance * state.battle.buffs.nextAttackAccMult);
  chance = Math.max(0.05, Math.min(0.98, chance));
  return chance;
}

function rollPlayerDamage(charId, move){
  const gb = gearBonusesForChar(charId);
  const strLvl = getCombatStatLevel(charId, "strength");
  let maxHit = osrsMaxHit(strLvl, gb.strengthBonus);
  maxHit = Math.max(1, Math.floor(maxHit * (move?.maxHitMod ?? 1) + (move?.flatMaxHit ?? 0)));
  if ((state.battle.buffs?.nextAttackMult || 0) > 0) maxHit = Math.max(1, Math.floor(maxHit * state.battle.buffs.nextAttackMult));
  const roll = Math.floor(Math.random() * (maxHit + 1));
  return { roll, maxHit };
}

function applyEnemyTurn(extraLines=[]){
  const b = battleStatus();
  if (!b) return { done:true, next:null };
  const charId = b.playerCharId || "jackson";
  const ch = getCharacter(charId);

  const mv = enemyChooseMove();
  const gb = gearBonusesForChar(charId);

  const atkLvlE = Math.max(1, Math.floor(Number(b.enemy?.stats?.attack || 1)));
  const defLvlP = getCombatStatLevel(charId, "defence");

  let defBonus = gb.defenceBonus;
  if (b.buffs?.guardOnce){
    defBonus = Math.floor(defBonus * 1.25);
    b.buffs.guardOnce = false;
  }
  if ((b.buffs?.defBoostTurns || 0) > 0)
    defBonus = Math.floor(defBonus * (b.buffs.defBoostMult || 1));

  const atkRoll = atkLvlE * ((b.enemy?.bonuses?.attack || 0) + 64);
  const defRoll = defLvlP * (defBonus + 64);
  let hitChance = osrsHitChance(atkRoll, defRoll);
  hitChance = clamp01(hitChance * (mv.accMod ?? 1));
  if ((b.debuffs?.enemyAccDownTurns || 0) > 0) hitChance = clamp01(hitChance * (b.debuffs.enemyAccDownMult || 1));
  hitChance = Math.max(0.05, Math.min(0.98, hitChance));

  const hit = Math.random() < hitChance;
  let dmg = 0;
  let mult = 1;
  if (hit){
    const strLvlE = Math.max(1, Math.floor(Number(b.enemy?.stats?.strength || 1)));
    let maxHit = osrsMaxHit(strLvlE, (b.enemy?.bonuses?.strength || 0));
    maxHit = Math.max(1, Math.floor(maxHit * (mv.maxHitMod ?? 1) + (mv.flatMaxHit ?? 0)));
    const raw = Math.floor(Math.random() * (maxHit + 1));
    dmg = raw;
    // apply typing vs player (Organic baseline for now)
    mult = typeMultiplier(mv.type, ch.types || []);
    dmg = Math.max(0, Math.floor(dmg * mult));
    // Avoid \"can't hurt it\" situations at very low max hits.
    if (raw > 0 && mult > 0 && dmg === 0) dmg = 1;
    // Make super-effective matter at low rolls.
    if (raw > 0 && mult > 1 && dmg === raw) dmg += 1;
    const beforeHp = (ch.hp ?? 0);
let afterHp = Math.max(0, beforeHp - dmg);
// Resolve: endure one hit and stay at 1 HP (only if you'd be dropped to 0).
if (afterHp <= 0 && (b.buffs?.endureTurns || 0) > 0){
  afterHp = 1;
  b.buffs.endureTurns = 0;
  dmg = Math.max(0, beforeHp - afterHp);
}
ch.hp = afterHp;
  }

  const lines = [...extraLines, `Minion used ${mv.name}!`];
  if (!hit) lines.push("It missed.");
  else lines.push(`You took ${dmg} damage.`);
  const tag = typeTag(mult);
  if (hit && tag) lines.push(tag);  // tick buffs / debuffs (turns tick down after the enemy acts)
  if ((b.buffs?.analyzedTurns || 0) > 0) b.buffs.analyzedTurns -= 1;
  if ((b.buffs?.accBoostTurns || 0) > 0) b.buffs.accBoostTurns -= 1;
  if ((b.buffs?.defBoostTurns || 0) > 0) b.buffs.defBoostTurns -= 1;
  if ((b.debuffs?.enemyDefDownTurns || 0) > 0) b.debuffs.enemyDefDownTurns -= 1;
  if ((b.debuffs?.enemyAccDownTurns || 0) > 0) b.debuffs.enemyAccDownTurns -= 1;
  if ((b.buffs?.grinTurns || 0) > 0) b.buffs.grinTurns -= 1;
  if ((b.buffs?.accBoostTurns || 0) <= 0){ b.buffs.accBoostTurns = 0; b.buffs.accBoost = 0; }
  if ((b.buffs?.defBoostTurns || 0) <= 0){ b.buffs.defBoostTurns = 0; b.buffs.defBoostMult = 1; }
  if ((b.debuffs?.enemyDefDownTurns || 0) <= 0){ b.debuffs.enemyDefDownTurns = 0; b.debuffs.enemyDefDownMult = 1; }
  if ((b.debuffs?.enemyAccDownTurns || 0) <= 0){ b.debuffs.enemyAccDownTurns = 0; b.debuffs.enemyAccDownMult = 1; }
  if ((b.buffs?.grinTurns || 0) <= 0){ b.buffs.grinTurns = 0; if (b.buffs.nextAttackMult){ b.buffs.nextAttackMult = 0; b.buffs.nextAttackAccMult = 0; } }

  // defeat
  if (ch.hp <= 0){
    b.active = false;
    setBattleMsg([...lines, "", "DEFEAT"]);
    state.battle = null;
    // keep legacy mirror
    setActiveCharacter(charId);
    return { done:true, next:"sq_monster_defeat" };
  }

  b.lastTurnAt = Date.now();
  setBattleMsg(lines);
  // keep legacy mirror
  setActiveCharacter(charId);
  return { done:false, next:null };
}



// -----------------------------
// Lootpools (slot model)
// - Each win rolls 1–3 loot slots.
// - At most 1 "rare" reward can be awarded per win.
// - Rare gadget rewards unlock blueprints only (one-time).
// -----------------------------
export const LOOTPOOLS = {
  vulkraine_minion: {
    // Slot count distribution: 1 (~67.5%), 2 (~22.5%), 3 (~10%)
    slots: { min: 1, max: 3, p2: 0.25, p3: 0.10 },

    // Rare rewards: independent roll per entry, but only one can be awarded.
    // NOTE: gadget rewards are blueprint-only; if already unlocked, they are ineligible.
    rare: [
      { key:"oxygen_mask", chance: 0.0325, type:"gear" },
      { key:"twinstrike_gloves", chance: 0.01, type:"gear" },

      { key:"basketball", chance: 0.0075, type:"gadget", bp:"bp_basketball" },
      { key:"water_pistol", chance: 0.006, type:"gadget", bp:"bp_water_pistol" },
      { key:"mouthguard", chance: 0.003, type:"gadget", bp:"bp_mouthguard" },
      { key:"super_soaker", chance: 0.002, type:"gadget", bp:"bp_super_soaker" },
    ],

    // Common slot table: each slot picks ONE entry by weight (no replacement within a win).
    // Qty scales upward as enemy level rises (small multiplier).
    common: [
      // (Removed) Charcoal was a legacy refinery intermediate; award Carbon directly.
      { key:"c", weight: 4.25, qty:[2,5], label:"Carbon Chunk" },

      { key:"zn", weight: 7.5, qty:[1,4] },
      { key:"h",  weight: 10,  qty:[1,4], note:"Harder to find in Vulkraine." },
      { key:"o",  weight: 10,  qty:[1,4], note:"Harder to find in Vulkraine." },
      { key:"cu", weight: 12.5, qty:[1,4] },

      { key:"fe", weight: 17.5, qty:[2,4] },
      { key:"si", weight: 20,  qty:[2,4] },
      { key:"c",  weight: 20,  qty:[2,8] },

      // Vulkraine = sulfur-rich / toxic vibe
      { key:"s",  weight: 22.5, qty:[2,8] },
      { key:"s",  weight: 1.15, qty:[25,25], label:"Sulfur Cache" },
    ],
  },
};

function awardBrawlVictory(charId, enemy){
  const enemyKey = enemy?.key || enemy;
  const enemyLevel = Number(enemy?.level || 1);
  const lines = [];
  const lootItems = [];
  if (!state.history || typeof state.history !== "object") state.history = {};
  state.history.minionsKilled = (state.history.minionsKilled ?? 0) + 1;

  // Character XP (combat stats are trained via damage dealt).
  addCharacterXp(charId, 8);

  const ch = getCharacter(charId);
  lines.push(`Rewards: +8 XP (${ch.name}).`);

  // heal (small OSRS-ish top-up)
  const heal = 2;
  const before = ch.hp ?? 0;
  ch.hp = Math.min(ch.maxHp ?? 10, before + heal);
  const gained = Math.max(0, ch.hp - before);
  if (gained > 0) lines.push(`You catch your breath (+${gained} HP).`);


  // Loot (slot model)
  const def = LOOTPOOLS[enemyKey] || LOOTPOOLS.vulkraine_minion;

  // Roll 1–3 slots (biased to 1).
  let slotCount = def?.slots?.min ?? 1;
  if (Math.random() < (def?.slots?.p2 ?? 0.25)) slotCount += 1;
  if (Math.random() < (def?.slots?.p3 ?? 0.10) && slotCount < (def?.slots?.max ?? 3)) slotCount += 1;
  slotCount = Math.max(def?.slots?.min ?? 1, Math.min(def?.slots?.max ?? 3, slotCount));

  // Qty scaling (small bump per enemy level)
  const qtyScale = 1 + Math.max(0, enemyLevel - 1) * 0.15;

  const eq = ch.equipment || {};
  const drops = [];

  function hasBp(bp){
    return !!bp && Array.isArray(state.player.blueprintsOwned) && state.player.blueprintsOwned.includes(bp);
  }

  function playerHasItemKey(itemKey){
    if (!itemKey) return false;
    const k = String(itemKey);
    const inv = Number(state.player?.inventory?.[k] || 0);
    if (inv > 0) return true;

    // Legacy mirror (some UI paths read from here)
    const peq = state.player?.equipment || {};
    if (peq && typeof peq === "object" && Object.values(peq).includes(k)) return true;

    // Any character equipped
    const chars = state.player?.characters || {};
    if (chars && typeof chars === "object"){
      for (const cid of Object.keys(chars)){
        const eq = chars[cid]?.equipment || {};
        if (eq && typeof eq === "object" && Object.values(eq).includes(k)) return true;
      }
    }
    return false;
  }

  function rollQty(qty){
    const baseMin = Number(qty?.[0]) || 1;
    const baseMax = Number(qty?.[1]) || baseMin;
    const min = Math.max(0, Math.floor(baseMin * qtyScale));
    const max = Math.max(min, Math.floor(baseMax * qtyScale));
    return min === max ? min : (min + Math.floor(Math.random() * (max - min + 1)));
  }

  function pickWeighted(items){
    const total = items.reduce((sum, it) => sum + Math.max(0, Number(it?.weight) || 0), 0);
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (const it of items){
      r -= Math.max(0, Number(it?.weight) || 0);
      if (r <= 0) return it;
    }
    return items[items.length - 1] || null;
  }

  // Rare: independent rolls, then pick at most one.
  let gotRare = false;
  const rareHits = [];
  for (const entry of (def?.rare || [])){
    const p = Math.max(0, Number(entry?.chance) || 0);

    // Unique drop rule: only one Oxygen Mask can exist at a time.
    // If one is already in inventory or equipped, treat the drop as ineligible.
    if (entry?.key === "oxygen_mask" && playerHasItemKey("oxygen_mask")) continue;

    // Level gating (optional)
    const minLvl = Number(entry?.minLevel) || 1;
    if ((ch.level || 1) < minLvl) continue;

    // Blueprint-only gadgets: ineligible once owned
    if (entry?.type === "gadget" && entry?.bp && hasBp(entry.bp)) continue;

    if (Math.random() < p) rareHits.push(entry);
  }
  if (rareHits.length){
    // Choose one (weighted by chance)
    const total = rareHits.reduce((sum, it) => sum + Math.max(0, Number(it?.chance) || 0), 0) || rareHits.length;
    let r = Math.random() * total;
    let chosen = rareHits[0];
    for (const it of rareHits){
      r -= Math.max(0, Number(it?.chance) || 0) || (total === rareHits.length ? 1 : 0);
      if (r <= 0){ chosen = it; break; }
    }

    const itemKey = chosen?.key;
    if (itemKey){
      gotRare = true;

      if (chosen.type === "gadget" && chosen.bp){
        // Blueprint-only gadget reward
        grantBlueprint(chosen.bp);
        drops.push(`Blueprint: ${labelFor(itemKey)}`);
        lootItems.push({ key: itemKey, qty: 1, kind: "blueprint", bp: chosen.bp, isNew: true });
      } else {
        // Normal item reward
        addResources({ [itemKey]: 1 });
        drops.push(labelFor(itemKey));
        lootItems.push({ key: itemKey, qty: 1, kind: "item" });

        // Auto-equip Twinstrike Gloves if gloves slot is empty.
        if (itemKey === "twinstrike_gloves" && !eq.gloves){
          state.player.inventory.twinstrike_gloves = Math.max(0, (state.player.inventory.twinstrike_gloves ?? 0) - 1);
          eq.gloves = "twinstrike_gloves";
          drops[drops.length - 1] = "Twinstrike Gloves (equipped)";
          // Mark the last loot entry as equipped for the UI.
          lootItems[lootItems.length - 1] = { key: itemKey, qty: 1, kind: "item", equipped: true };
        }
      }
    }
  }

  // Common slots: pick without replacement within the win.
  const commonSlots = Math.max(0, slotCount - (gotRare ? 1 : 0));
  const remaining = (def?.common || []).slice();
  for (let i = 0; i < commonSlots; i++){
    if (!remaining.length) break;
    const pick = pickWeighted(remaining);
    if (!pick) break;

    // Remove picked entry so we don't show duplicates in the 1–3 item display.
    const idx = remaining.indexOf(pick);
    if (idx >= 0) remaining.splice(idx, 1);

    const itemKey = pick.key;
    if (!itemKey) continue;

    // Level gating (optional)
    const minLvl = Number(pick?.minLevel) || 1;
    if ((ch.level || 1) < minLvl) continue;

    const qty = rollQty(pick.qty || [1,1]);
    if (qty <= 0) continue;

    addResources({ [itemKey]: qty });

    const label = pick.label ? pick.label : labelFor(itemKey);
    drops.push(qty === 1 ? label : `${label} x${qty}`);
    lootItems.push({ key: itemKey, qty, kind: "item", labelOverride: pick.label || null });
  }

  if (drops.length) lines.push(`Loot: ${drops.join(", ")}`);

  // Store a volatile, UI-only loot payload so the UI can show a victory modal.
  // (This is stripped out by saveGame and cleared on load.)
  const bpCount = lootItems.filter(it => it.kind === "blueprint").length;
  const itemCount = lootItems.length;
  if (!state.ui || typeof state.ui !== "object") state.ui = {};
  state.ui.lootModal = {
    open: true,
    title: "Loot Acquired",
    enemyName: enemy?.name || "Minion",
    itemCount,
    blueprintCount: bpCount,
    items: lootItems,
    at: Date.now(),
  };

  setActiveCharacter(charId);
  return lines;
}


function resolveMoveHits(hits){
  if (hits === null || hits === undefined) return 1;
  if (typeof hits === "number") return Math.max(0, Math.floor(hits));
  const s = String(hits).trim();
  // range like "1-2" or "2-4"
  const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m){
    const a = Math.max(0, parseInt(m[1], 10));
    const b = Math.max(0, parseInt(m[2], 10));
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }
  const n = Math.floor(Number(s) || 0);
  return Math.max(0, n);
}

function consumeNextAttackBuffs(b){
  if (!b?.buffs) return;
  if (b.buffs.nextAttackMult){
    b.buffs.nextAttackMult = 0;
    b.buffs.nextAttackAccMult = 0;
  }
}

// Damage-based training:
// - 1 XP to HP per point of damage dealt
// - 4 XP to the player-selected combat stat (attack/strength/defence) per point of damage dealt
function awardDamageTrainingXp(charId, damage){
  const d = Math.max(0, Math.floor(Number(damage) || 0));
  if (d <= 0) return;
  addCombatStatXp(charId, "hp", d);
  const target = getCombatTrainingTarget();
  addCombatStatXp(charId, target, d * 4);
}

export function battleAct(kind, key){
  const b = battleStatus();
  if (!b) return { ok:false, next:null };
  const charId = b.playerCharId || "jackson";
  const ch = getCharacter(charId);

  // menu navigation
  if (kind === "menu"){
    b.menu = key || "root";
    return { ok:true, next:null };
  }

  const lines = [];

  if (kind === "move"){
    const pool = movePoolForChar(charId);
    if (!pool.includes(key)) return { ok:false, next:null };

    const mv = BRAWL_MOVES[key];
    if (!mv) return { ok:false, next:null };
// Utility moves (no damage)
if (mv.noDamage){
  if (!b.buffs) b.buffs = {};
  if (!b.debuffs) b.debuffs = {};

  if (key === "show_off"){
    b.debuffs.enemyAccDownTurns = Infinity;
    b.debuffs.enemyAccDownMult = 0.85;
    lines.push("You show off.");
    lines.push("Enemy Accuracy down!");
  } else if (key === "glare"){
    b.debuffs.enemyDefDownTurns = Infinity;
    b.debuffs.enemyDefDownMult = 0.85;
    lines.push("You glare them down.");
    lines.push("Enemy defence down!");
  } else if (key === "breakdown"){
    b.buffs.accBoostTurns = Infinity;
    b.buffs.accBoost = 0.25;
    lines.push("You break down and lock in.");
    lines.push("Accuracy way up!");
  } else if (key === "resolve"){
    b.buffs.endureTurns = Math.max(b.buffs.endureTurns || 0, 1);
    lines.push("You steel yourself.");
    lines.push("You will endure the next hit.");
  } else {
    lines.push(`${mv.name}.`);
  }

  // Enemy responds
  const res = applyEnemyTurn(lines);
  if (b) b.menu = "root";
  return { ok:true, next: res.next };
}


    // Determine hits: Twinstrike gloves add +1 hit to single-hit moves.
    const gb = gearBonusesForChar(charId);
    let hits = resolveMoveHits(mv.hits);
    const isUtility = !!mv.noDamage;
    if (!isUtility) hits = Math.max(1, hits);
    if (gb.extraHitPassive && hits === 1) hits = 2;

    let landed = 0;
    let total = 0;
    let lastMult = 1;

    for (let i=0;i<hits;i++){
      const chance = rollPlayerHit(charId, mv);
      if (Math.random() < chance){
        landed += 1;
        const dmgRoll = rollPlayerDamage(charId, mv);
        const mult = typeMultiplier(mv.type, b.enemy?.types || []);
        lastMult = mult;
        let dmg = Math.max(0, Math.floor(dmgRoll.roll * mult));
        // Avoid \"can't hurt it\" situations at very low max hits.
        if (dmgRoll.roll > 0 && mult > 0 && dmg === 0) dmg = 1;
        // Make super-effective matter even at low rolls (1 -> 2).
        if (dmgRoll.roll > 0 && mult > 1 && dmg === dmgRoll.roll) dmg += 1;
        total += dmg;
        b.enemy.hp = Math.max(0, (b.enemy.hp ?? 0) - dmg);
        if (b.enemy.hp <= 0) break;
      }
    }

    lines.push(`${ch.name} used ${mv.name}!`);
    if (landed <= 0) lines.push("It missed.");
    else lines.push(`Hits: ${landed}/${hits}  •  Damage: ${total}`);

    // Train combat stats from damage dealt.
    if (total > 0) awardDamageTrainingXp(charId, total);

    // If a buff was priming the next attack (e.g. Grin), consume it after attempting an attack.
    consumeNextAttackBuffs(b);

    const tag = typeTag(lastMult);
    if (landed > 0 && tag) lines.push(tag);

    if (b.enemy.hp <= 0){
      const rewardLines = awardBrawlVictory(charId, b.enemy);
      b.active = false;
      setBattleMsg([...lines, "", "VICTORY", ...rewardLines]);
      state.battle = null;
      return { ok:true, next: "sq_monster_complete" };
    }

  } else if (kind === "item"){
    if (key === "synthfruit"){
      const have = Math.max(0, Math.floor(b.items?.synthfruit ?? 0));
      if (have <= 0){
        setBattleMsg(["No Synthfruit left."]);
        return { ok:true, next:null };
      }
      const max = ch.maxHp ?? 100;
      const cur = ch.hp ?? max;
      if (cur >= max){
        setBattleMsg(["HP is already full."]);
        return { ok:true, next:null };
      }
      b.items.synthfruit = have - 1;
      const heal = Math.max(1, Math.floor(max * 0.25));
      ch.hp = Math.min(max, cur + heal);
      lines.push(`${ch.name} ate Synthfruit.`);
      lines.push(`Recovered ${Math.min(heal, max - cur)} HP.`);
      setActiveCharacter(charId);
    }

  } else if (kind === "gadget"){
    if (!isGadgetKey(key)) return { ok:false, next:null };
    const gs = getGadgetState(key);
    if (!gs || gs.owned <= 0) { setBattleMsg(["You don't own that gadget."]); return { ok:true, next:null }; }
const reqLvl = getGadgetBattleReqLevel(key);
if ((ch.level || 1) < reqLvl){
  setBattleMsg([`You need level ${reqLvl} to use ${getGadgetBattleActionName(key)}.`]);
  return { ok:true, next:null };
}

    if (gs.charges <= 0) { setBattleMsg(["No charge left. Charge it before battle."]); return { ok:true, next:null }; }

    // Spend 1 charge from persistent player gadget state
    state.player.gadgets[key].charges = Math.max(0, (state.player.gadgets[key].charges || 0) - 1);

    const duration = gs.durationTurns;
const actionName = getGadgetBattleActionName(key);
const moveKey = getGadgetBattleMoveKey(key);

// Some gadgets are straight-up attacks (they use normal hit/damage rules).
if (moveKey && BRAWL_MOVES?.[moveKey]){
  const mv = BRAWL_MOVES[moveKey];

  // Determine hits: Twinstrike gloves add +1 hit to single-hit moves.
  const gb = gearBonusesForChar(charId);
  let hits = resolveMoveHits(mv.hits);
  hits = Math.max(1, hits);
  if (gb.extraHitPassive && hits === 1) hits = 2;

  let landed = 0;
  let total = 0;
  let lastMult = 1;

  for (let i=0;i<hits;i++){
    const chance = rollPlayerHit(charId, mv);
    if (Math.random() < chance){
      landed += 1;
      const dmgRoll = rollPlayerDamage(charId, mv);
      const mult = typeMultiplier(mv.type, b.enemy?.types || []);
      lastMult = mult;
      let dmg = Math.max(0, Math.floor(dmgRoll.roll * mult));
      if (dmgRoll.roll > 0 && mult > 0 && dmg === 0) dmg = 1;
      if (dmgRoll.roll > 0 && mult > 1 && dmg === dmgRoll.roll) dmg += 1;
      total += dmg;
      if (b.enemy) b.enemy.hp = Math.max(0, Math.floor((b.enemy.hp||0) - dmg));
    }
  }

  lines.push(`You used ${actionName}.`);
  if (landed <= 0) lines.push("It missed.");
  else lines.push(`Hits: ${landed}/${hits}  •  Damage: ${total}`);

  // Train combat stats from damage dealt.
  if (total > 0) awardDamageTrainingXp(charId, total);

  const tag = typeTag(lastMult);
  if (landed > 0 && tag) lines.push(tag);

  consumeNextAttackBuffs(b);
} else {
  // Buff-style gadgets
  const effect = GADGET_EFFECTS[key];
  const effectLines = effect?.onUse ? effect.onUse(b, duration) : [`You used ${actionName}.`];
  lines.push(...effectLines);
}

lines.push(`(${actionName}: -1 charge)`);


    // Victory check from chip-damage gadgets
    if (b.enemy.hp <= 0){
      const rewardLines = awardBrawlVictory(charId, b.enemy);
      b.active = false;
      setBattleMsg([...lines, "", "VICTORY", ...rewardLines]);
      state.battle = null;
      return { ok:true, next: "sq_monster_complete" };
    }
  } else if (kind === "tech"){
    if (key === "guard"){
      b.buffs.guardOnce = true;
      lines.push(`${ch.name} raised a guard field.`);
    } else if (key === "analyze"){
      b.buffs.analyzedTurns = 2;
      const types = (b.enemy?.types || []).map(t => t[0].toUpperCase()+t.slice(1)).join(" / ") || "Unknown";
      lines.push(`${ch.name} analyzed the minion.`);
      lines.push(`Typing: ${types}`);
      lines.push("Accuracy increased." );
    }

  } else if (kind === "run"){
    b.active = false;
    state.battle = null;
    return { ok:true, next: "sq_monster_run" };
  }

  // Enemy responds after actions.
  const res = applyEnemyTurn(lines);
  if (b) b.menu = "root";
  return { ok:true, next: res.next };
}

// -----------------------------
// (Legacy combat loop removed)
// -----------------------------

export function regenHpTick(){
  const ch = getActiveCharacter();
  if (!ch) return false;
  if ((ch.hp ?? 0) >= (ch.maxHp ?? 100)) return false;
  ch.hp = Math.min(ch.maxHp ?? 100, (ch.hp ?? 0) + 1);
  setActiveCharacter(getActiveCharId());
  return true;
}

// -----------------------------
// Oxygen system (Distillery Cabinet oxygen container)
// -----------------------------

const BREATHE_DURATION_MS = 5 * 60 * 1000;

export function toggleBreathe(){
  if (!state.player || typeof state.player !== "object") return { ok:false, reason:"Missing player state." };
  if (!state.player.breathe || typeof state.player.breathe !== "object"){
    state.player.breathe = { active:false, endAt:0 };
  }

  // Clicking always (re)starts the buff for a fresh 5 minutes.
  state.player.breathe.active = true;
  state.player.breathe.endAt = Date.now() + BREATHE_DURATION_MS;
  return { ok:true };
}

function isInJunkyard(){
  const id = String(state.currentNodeId || "");
  return /^sq_junkyard_/i.test(id);
}

function isInMonsterBrawl(){
  if (state?.battle?.active) return true;
  const id = String(state.currentNodeId || "");
  return /^(sq_brawl_|sq_monster_|sq_vulkraine_brawl)/i.test(id);
}

function isWearingOxygenMask(){
  const ch = getActiveCharacter();
  const eq = ch?.equipment || {};
  return eq.eyewear === "oxygen_mask" || eq.headgear === "oxygen_mask";
}

function setCabinetStored(elementKey, next){
  if (!state.player?.distilleryCabinet) return false;
  const cab = state.player.distilleryCabinet;
  if (!cab.stored || typeof cab.stored !== "object") cab.stored = {};
  if (!cab.caps || typeof cab.caps !== "object") cab.caps = {};
  const cap = Math.max(0, Math.floor(Number(cab.caps[elementKey]) || 0));
  const clamped = Math.max(0, Math.min(cap, Math.floor(Number(next) || 0)));
  const prev = Math.max(0, Math.floor(Number(cab.stored[elementKey]) || 0));
  cab.stored[elementKey] = clamped;
  return clamped !== prev;
}

// Runs on a 30-second cadence (see bootstrap.js). Oxygen is not a separate pool:
// it is exactly the Distillery Cabinet oxygen container value.
export function oxygenTick(){
  if (!state.player?.distilleryCabinet) return false;
  if (state.ui?.faintModal?.open) return false;

  // Expire breathe buff if needed.
  if (!state.player.breathe || typeof state.player.breathe !== "object"){
    state.player.breathe = { active:false, endAt:0 };
  }
  const nowMs = Date.now();
  if (state.player.breathe.active && (Number(state.player.breathe.endAt) || 0) <= nowMs){
    state.player.breathe.active = false;
  }

  const inBrawl = isInMonsterBrawl();
  const inJunk = isInJunkyard();

  // No oxygen mechanics outside these contexts (except Breathe gain).
  let delta = 0;

  if (state.player.breathe.active){
    delta += isWearingOxygenMask() ? 2 : 1;
  }
  if (inBrawl) delta -= 2;
  else if (inJunk) delta -= 1;

  // Apply
  let changed = false;
  if (delta !== 0){
    const cur = distilleryStoredFor("o");
    changed = setCabinetStored("o", cur + delta) || changed;
  }

  // Fainting (only while inside Monster Brawl or Junkyard)
  const after = distilleryStoredFor("o");
  if (after <= 0 && (inBrawl || inJunk)){
    // Close other overlays so the faint message is unambiguous.
    if (!state.ui) state.ui = {};
    delete state.ui.lootModal;
    state.ui.faintModal = {
      open: true,
      message: "You ran out of air and fainted. You've been taken to a safe place to recover.",
      at: nowMs,
      from: inBrawl ? "brawl" : "junkyard",
    };

    // Stop any ongoing event loops (no progress is "lost"—you just get pulled out.)
    if (state.battle) state.battle = null;
    if (state.jobs?.junkyard) state.jobs.junkyard.active = false;
    changed = true;
  }

  return changed;
}
