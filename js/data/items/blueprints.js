
export const refineRecipes = [
{
  key: "test_tube",
  label: "Test Tube",
  description: "A simple glass tube used to bottle small quantities of elements.",
  durationMs: 60_000,
  requires: { si: 2, o: 4 },
  produces: { test_tube: 1 }
}
];

export const blueprintCatalog = [
{
    key: "bp_nerd_glasses",
    label: "Nerd Glasses Blueprint",
    itemKey: "nerd_glasses",
    description: "A simple brass frame with a ground lens. Only a nerd would wear these.",
    durationMs: 80_000,
    requires: { si: 12, o: 12, cu: 12, zn: 6 }
  },
{
    key: "bp_running_shoes",
    label: "Running Shoes Blueprint",
    itemKey: "running_shoes",
    description: "Improvised running shoes with a reinforced sole and wire laces.",
    durationMs: 90_000,
    requires: { fe: 12, c: 12, cu: 4 }
  },

{
  key: "bp_basketball",
  label: "Basketball Blueprint",
  itemKey: "basketball",
  description: "A battered street ball with reinforced seams. Unlocks the Basketball gadget.",
  durationMs: 80_000,
  requires: { c: 12, o: 4, fe: 2 }
},
{
  key: "bp_water_pistol",
  label: "Water Pistol Blueprint",
  itemKey: "water_pistol",
  description: "A simple water pistol with a press-fit valve. Unlocks the Water Pistol gadget.",
  durationMs: 85_000,
  requires: { fe: 10, c: 4, cu: 6, si: 6, o: 6 }
},
{
  key: "bp_mouthguard",
  label: "Mouthguard Blueprint",
  itemKey: "mouthguard",
  description: "A scuffed mouthguard with a molded brace. Unlocks the Mouthguard gadget.",
  durationMs: 75_000,
  requires: { cu: 8, zn: 6, si: 6, o: 6 }
},
{
  key: "bp_super_soaker",
  label: "Super Soaker Blueprint",
  itemKey: "super_soaker",
  description: "A pressurized water blaster with a reinforced tank. Unlocks the Super Soaker gadget.",
  durationMs: 110_000,
  requires: { water_pistol: 1, fe: 12, cu: 8, si: 8, o: 8, c: 4 }
},
];

export function blueprintByKey(key){
  return blueprintCatalog.find(b => b.key === key) ?? null;
}

export function refineByKey(key){
  return refineRecipes.find(r => r.key === key) ?? null;
}
