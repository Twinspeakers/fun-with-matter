import { periodicTable, findabilityTierFor } from "./elements.js";

// All elements are now present + unlocked (for testing / design).
// Keys are the element symbols lowercased (e.g. "Fe" -> "fe").
export const gatherables = (periodicTable || []).map(e => ({
  key: String(e?.symbol || "").toLowerCase(),
  label: String(e?.name || e?.symbol || ""),
  symbol: String(e?.symbol || ""),
  tier: findabilityTierFor(String(e?.symbol || "")),
}));

// Keeping the original API so the rest of the game doesn't care whether elements are gated.
export const ALLOWED_ELEMENTS_L1 = gatherables.map(g => g.key);
const _allowedElementSet = new Set(ALLOWED_ELEMENTS_L1);
export function isAllowedElementKey(key){
  const k = String(key || "").toLowerCase();
  return _allowedElementSet.has(k);
}


// Ensure gatherable tiers always match the glossary's findability tiers.
const DEFAULT_MU_PER_G_BY_TIER = {
  6: 0.02, // Stable (very common feedstock)
  5: 0.03, // Reactive
  4: 0.05, // Hazardous
  3: 0.08, // Distorted
  2: 0.12, // Unbounded
  1: 0.20  // Singular
};

// Per-element commodity reference price (MU per gram) for the NPC commodity buyer.
// This is intentionally simple and game-facing (not a real market quote).
const MU_PER_G_OVERRIDES = {
  c: 0.02,  // Carbon: 100g -> 2 MU
  o: 0.01,
  h: 0.01,
  si: 0.03,
  fe: 0.02,
  cu: 0.05,
  zn: 0.04,
  s: 0.03,
};

export function muPerGramForElementKey(key){
  const k = String(key);
  if (k in MU_PER_G_OVERRIDES) return MU_PER_G_OVERRIDES[k];
  const g = gatherables.find(x => x.key === k);
  const tier = g ? (Number(g.tier) || 6) : 6;
  return DEFAULT_MU_PER_G_BY_TIER[Math.max(1, Math.min(6, Math.floor(tier)))] ?? 0.02;
}

// Ensure gatherable tiers always match the glossary's findability tiers.
gatherables.forEach(g => {
  g.tier = findabilityTierFor(g.symbol);
  g.baseMuPerGram = muPerGramForElementKey(g.key);
});


const things = [
  {
    "key": "test_tube",
    "label": "Test Tube",
    "symbol": "🧪",
    "kind": "Material",
    "buyPrice": 20,
    "sellPrice": 5,
    "tier": 6,
    "description": "A small glass tube used to bottle tiny quantities of elements for a commodity buyer."
  },
        {
    "key": "backpack_mk1",
    "label": "Backpack Mk.I",
    "symbol": "🎒",
    "kind": "Gear",
    "slot": "bag",
    "buyPrice": 450,
    "sellPrice": 150,
    "tier": 2,
    "description": "A sturdy backpack that increases your inventory capacity.",
    "found": "Buy at the General Store.",
    "effect": {
      "inventorySlots": 8
    },
    "salvageYield": {
      "c": 10,
      "fe": 6,
      "cu": 2
    }
  },
  {
    "key": "twinstrike_gloves",
    "label": "Twinstrike Gloves",
    "symbol": "<img class=\"itemIconImg iconTwinstrike\" src=\"./assets/icons/twinstrike-gloves.png\" alt=\"\" />",
    "kind": "Gear",
    "slot": "gloves",
    "effect": {
      "attacksPerTurn": 2
    },
    "buyPrice": 300,
    "sellPrice": 120,
    "tier": 3,
    "description": "Lightweight combat gloves that let you strike twice each turn.",
    "found": "EVENT: Monster brawl (2.25% drop). Occasionally sold at the General Store.",
    "salvageYield": {
      "fe": 6,
      "cu": 3,
      "c": 5
    }
  },

{
  "key": "basketball",
  "label": "Basketball",
  "symbol": "🏀",
  "kind": "Item",
  "tier": 4,
  "isGadget": true,
  "description": "A battered street ball. In a fight, it gets your head in the game.",
  "found": "EVENT: Monster brawl (3.75% drop).",
  "gadget": {
    "durationBaseTurns": 1,
    "maxRank": 3
  }
},
{
  "key": "water_pistol",
  "label": "Water Pistol",
  "symbol": "🔫",
  "kind": "Item",
  "tier": 4,
  "isGadget": true,
  "description": "A cheap water pistol. Not deadly—annoyingly effective.",
  "found": "EVENT: Monster brawl (2% drop).",
  "gadget": {
    "durationBaseTurns": 1,
    "maxRank": 3
  }
},
{
  "key": "mouthguard",
  "label": "Mouthguard",
  "symbol": "🦷",
  "kind": "Item",
  "tier": 4,
  "isGadget": true,
  "description": "A scuffed mouthguard. Helps you brace for impact.",
  "found": "EVENT: Monster brawl (1% drop).",
  "gadget": {
    "durationBaseTurns": 1,
    "maxRank": 3
  }
},
{
  "key": "super_soaker",
  "label": "Super Soaker",
  "symbol": "💦",
  "kind": "Item",
  "tier": 3,
  "isGadget": true,
  "description": "A pressurized water blaster. Overkill, but satisfying.",
  "found": "EVENT: Monster brawl (0.5% drop).",
  "gadget": {
    "durationBaseTurns": 2,
    "maxRank": 3
  }
},
  {
    "key": "work_cap",
    "label": "Work Cap",
    "symbol": "🧢",
    "kind": "Gear",
    "slot": "headgear",
    "buyPrice": 120,
    "sellPrice": 45,
    "tier": 1,
    "description": "A practical cap. Mostly cosmetic—might help later.",
    "found": "General Store.",
    "salvageYield": {
      "c": 2
    }
  },
  {
    "key": "utility_boots",
    "label": "Utility Boots",
    "symbol": "👢",
    "kind": "Gear",
    "slot": "shoes",
    "buyPrice": 180,
    "sellPrice": 70,
    "tier": 1,
    "description": "Hard-wearing boots. Mostly cosmetic—might help later.",
    "found": "General Store.",
    "salvageYield": {
      "c": 2,
      "fe": 1
    }
  },
  {
    "key": "nerd_glasses",
    "label": "Nerd Glasses",
    "symbol": "👓",
    "kind": "Gear",
    "slot": "eyewear",
    "buyPrice": 1500,
    "sellPrice": 600,
    "tier": 6,
    "description": "Only a nerd would wear these.",
    "found": "Crafting (Blueprint) or General Store.",
    "effect": {
      "accuracy": 1
    },
    "salvageYield": {
      "c": 3,
      "fe": 1
    }
  },
  {
    "key": "oxygen_mask",
    "label": "Oxygen Mask",
    "symbol": "😷",
    "kind": "Gear",
    "slot": "eyewear",
    "tier": 2,
    "buyPrice": 0,
    "sellPrice": 40,
    "description": "A sealed mask with a small filter. While \"Breathe\" is active, it doubles your oxygen gain.",
    "found": "EVENT: Monster brawl (minion drop).",
    "effect": {
      "oxygenGainMult": 2
    },
    "salvageYield": {
      "c": 2,
      "fe": 1
    }
  },
  {
    "key": "running_shoes",
    "label": "Running Shoes",
    "symbol": "👟",
    "kind": "Gear",
    "slot": "shoes",
    "buyPrice": 1500,
    "sellPrice": 600,
    "tier": 6,
    "description": "Light and springy. You feel faster just looking at them.",
    "found": "Crafting (Blueprint) or General Store.",
    "effect": {
      "speed": 1
    },
    "salvageYield": {
      "c": 3,
      "fe": 1
    }
  },
  {
    "key": "bulletproof_vest",
  "label": "Bulletproof Vest",
  "symbol": "🦺",
  "kind": "Gear",
  "slot": "chestwear",
  "buyPrice": 3000,
  "sellPrice": 1200,
  "tier": 3,
  "description": "Just pray they don't aim for the head!",
  "found": "General Store.",
  "effect": {
    "defense": 2
  },
  "salvageYield": {
    "c": 5,
    "fe": 2
  }
},
  {
    "key": "simple_ring",
    "label": "Simple Ring",
    "symbol": "💍",
    "kind": "Gear",
    "slot": "ring",
    "buyPrice": 220,
    "sellPrice": 85,
    "tier": 2,
    "description": "A simple ring with an odd sheen. No effect… yet.",
    "found": "General Store.",
    "salvageYield": {
      "cu": 1
    }
  },

  // -----------------------------
  // Junkyard scraps (repeatable Story event)
  // -----------------------------
  {
    "key": "scrap_soda_can",
    "label": "Empty soda can",
    "symbol": "🥫",
    "kind": "Material",
    "buyPrice": 10,
    "sellPrice": 5,
    "tier": 6,
    "description": "Crushed aluminium can. Mostly useless… for now.",
    "found": "The Junkyard.",
    "distillYield": {
      "al": { "min": 10, "max": 14 },
      "o": { "min": 0, "max": 2 }
    }
  },
  {
    "key": "scrap_plastic_bottle",
    "label": "Empty plastic bottle",
    "symbol": "🧴",
    "kind": "Material",
    "buyPrice": 10,
    "sellPrice": 5,
    "tier": 6,
    "description": "A cloudy plastic bottle with the label half peeled off.",
    "found": "The Junkyard.",
    "distillYield": {
      "c": { "min": 8, "max": 12 },
      "h": { "min": 6, "max": 10 },
      "o": { "min": 2, "max": 5 }
    }
  },
  {
    "key": "scrap_milk_carton",
    "label": "Empty milk carton",
    "symbol": "🧃",
    "kind": "Material",
    "buyPrice": 10,
    "sellPrice": 5,
    "tier": 6,
    "description": "Dented carton. Smells faintly like regret.",
    "found": "The Junkyard.",
    "distillYield": {
      "c": { "min": 6, "max": 10 },
      "h": { "min": 4, "max": 8 },
      "o": { "min": 4, "max": 8 }
    }
  },
    {
    "key": "scrap_rusty_spoon",
    "label": "Rusty Spoon",
    "symbol": "🥄",
    "kind": "Material",
    "buyPrice": 10,
    "sellPrice": 5,
    "tier": 6,
    "description": "A bent spoon with rust blooming across the bowl. Still good for one thing: oxygen.",
    "found": "The Junkyard.",
    "distillYield": {
      "fe": { "min": 2, "max": 4 },
      "o": { "min": 8, "max": 12 }
    }
  },
  {
    "key": "scrap_usb_drive",
    "label": "Dead USB drive",
    "symbol": "💾",
    "kind": "Material",
    "buyPrice": 20,
    "sellPrice": 10,
    "tier": 6,
    "description": "A tiny brick of ancient data. Now it's just element soup.",
    "found": "The Junkyard.",
    "distillYield": {
      "si": { "min": 12, "max": 16 },
      "cu": { "min": 2, "max": 6 },
      "fe": { "min": 1, "max": 3 },
      "c": { "min": 1, "max": 3 }
    }
  },
  {
    "key": "scrap_old_doorknob",
    "label": "Old Doorknob",
    "symbol": "🚪",
    "kind": "Material",
    "buyPrice": 10,
    "sellPrice": 5,
    "tier": 6,
    "description": "A doorknob made of rusted brass. Good for... well, nothing now.",
    "found": "The Junkyard.",
    "distillYield": {
      "cu": { "min": 6, "max": 9 },
      "zn": { "min": 4, "max": 8 },
      "o": { "min": 2, "max": 4 }
    }
  },
  {
    "key": "scrap_toaster_coil",
    "label": "Broken Toaster Coil",
    "symbol": "🌀",
    "kind": "Material",
    "buyPrice": 10,
    "sellPrice": 5,
    "tier": 5,
    "description": "Pity they don't use two cent coins anymore.",
    "found": "The Junkyard.",
    "distillYield": {
      "fe": { "min": 3, "max": 6 },
      "ni": { "min": 3, "max": 6 }
    }
  },
  {
    "key": "scrap_paint_tin",
    "label": "Crushed Paint Tin",
    "symbol": "🪣",
    "kind": "Material",
    "buyPrice": 10,
    "sellPrice": 5,
    "tier": 5,
    "description": "The tin is junk, but the leftover paint looks interesting.",
    "found": "The Junkyard.",
    "distillYield": {
      "fe": { "min": 6, "max": 12 },
      "ti": { "min": 2, "max": 4 }
    }
  },
  {
    "key": "scrap_broken_lightbulb",
    "label": "Broken Lightbulb",
    "symbol": "💡",
    "kind": "Material",
    "buyPrice": 10,
    "sellPrice": 5,
    "tier": 6,
    "description": "Should I be touching this?",
    "found": "The Junkyard.",
    "distillYield": {
      "o": { "min": 5, "max": 10 },
      "si": { "min": 6, "max": 9 }
    }
  },
  {
    "key": "scrap_coat_hanger",
    "label": "Twisted Coat Hanger",
    "symbol": "🪝",
    "kind": "Material",
    "buyPrice": 10,
    "sellPrice": 5,
    "tier": 6,
    "description": "Mangled beyond repair.",
    "found": "The Junkyard.",
    "distillYield": {
      "fe": { "min": 4, "max": 8 },
      "o": { "min": 4, "max": 8 }
    }
  },
  {
    "key": "scrap_plastic_bag",
    "label": "Plastic Bag",
    "symbol": "🛍️",
    "kind": "Material",
    "buyPrice": 10,
    "sellPrice": 5,
    "tier": 6,
    "description": "Ew, microplastics... send it to the abyss!",
    "found": "The Junkyard.",
    "distillYield": {
      "o": { "min": 5, "max": 10 },
      "si": { "min": 6, "max": 9 }
    }
  }
]

// --- Distillery Bottles (filled test tubes) ---
// Bottling 100g of an element consumes 1 empty Test Tube and produces a sealed
// item that can be treated like a normal object (inventory, locks, store sell, etc.).
export const FILLED_TUBE_PREFIX = "tube_";
export const FILLED_TUBE_GRAMS = 100;
export const FILLED_TUBE_RETURN_MU = 5; // matches empty Test Tube sell price / deposit
export function filledTubeKeyForElementKey(elementKey){
  return FILLED_TUBE_PREFIX + String(elementKey);
}

const FUN_TUBE_LABEL_OVERRIDES = {
  c:  { label: "Charcoal Shot" },
  h:  { label: "H-Breath Ampoule" },
  o:  { label: "Breather's Brew" },
  si: { label: "Silica Sip" },
  fe: { label: "Rust Ration" },
  cu: { label: "Penny Juice" },
  s:  { label: "Brimstone Bite" },
  zn: { label: "Zing Zest" },
};

function funLabelForFilledTube(g){
  const k = String(g?.key || "");
  const base = FUN_TUBE_LABEL_OVERRIDES[k]?.label;
  const nm = String(g?.label || k);
  const sym = String(g?.symbol || "");
  // Keep it fun but still readable + searchable.
  if (base) return `${base} (${sym})`;
  return `Vial of ${nm} (${sym})`;
}

function sellPriceForFilledTube(g){
  const perG = Number(g?.baseMuPerGram);
  const commodity = Math.max(0, Math.floor((Number.isFinite(perG) ? perG : 0) * FILLED_TUBE_GRAMS));
  const payout = commodity + FILLED_TUBE_RETURN_MU;
  // Never let it be unsellable in the store UI.
  return Math.max(1, Math.floor(payout));
}

// Create one filled-tube item per element we know about.
for (const g of (gatherables || [])){
  const key = filledTubeKeyForElementKey(g.key);
  things.push({
    key,
    label: funLabelForFilledTube(g),
    symbol: `🧪${String(g.symbol || "")}`,
    kind: "Item",
    buyPrice: 0,
    sellPrice: sellPriceForFilledTube(g),
    tier: g.tier ?? 6,
    description: `A sealed test tube containing ${FILLED_TUBE_GRAMS}g of ${g.label} (${g.symbol}).`,
    found: "Bottle in the Distillery Cabinet.",
  });
}

export const materials = things.filter(t => t.kind === "Material");
export const items = things.filter(t => t.kind !== "Material");




export const nodes = (gatherables || []).map(g => ({
  id: g.key,
  label: g.label,
  resourceKey: g.key,
  tier: g.tier,
  // These are immediately normalized by applyElementSoupGatheringNerf() below.
  avgTarget: 1,
  maxTarget: 1,
  tickMsRegular: 240000,
  tickMsQuick: 60000,
  maxChunk: 1
}));


// --- Operation: Element Soup ---
// Gathering pace is intentionally slow so the Junkyard is the primary early-game grind loop.
// Each element has a baseline production pace (ms per 1g packet).
const DEFAULT_GATHER_TICK_MS_BY_TIER = {
  6: 180000, // 3m
  5: 210000, // 3.5m
  4: 240000, // 4m
  3: 300000, // 5m
  2: 420000, // 7m
  1: 600000, // 10m
};

const GATHER_TICK_MS_OVERRIDES = {
  c: 180000,
  o: 180000,
  h: 210000,
  si: 240000,
  fe: 240000,
  cu: 300000,
  zn: 300000,
  s: 300000,
};

export function gatherTickMsRegularForElementKey(key){
  const k = String(key);
  const tier = (gatherables.find(g => g.key===k)?.tier) ?? 6;
  return GATHER_TICK_MS_OVERRIDES[k] ?? DEFAULT_GATHER_TICK_MS_BY_TIER[tier] ?? 240000;
}

function applyElementSoupGatheringNerf(){
  for (const n of nodes){
    const ms = gatherTickMsRegularForElementKey(n.resourceKey);
    n.avgTarget = 1;
    n.maxTarget = 1;
    n.maxChunk = 1;
    n.tickMsRegular = ms;
    // Quick slots are still faster, but nowhere near the Junkyard.
    n.tickMsQuick = Math.max(60000, Math.floor(ms/3));
  }
}
applyElementSoupGatheringNerf();



export const thingByKey = Object.fromEntries(
  [...gatherables, ...materials, ...items].map(t => [t.key, t])
);


// v59.19: L1-locked views
export const gatherablesL1 = gatherables.filter(g => isAllowedElementKey(g.key));
export const nodesL1 = nodes.filter(n => isAllowedElementKey(n.resourceKey));
