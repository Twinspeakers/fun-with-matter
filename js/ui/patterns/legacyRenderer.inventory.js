export function renderLeftPanels(deps){
  const { els, state, setShown } = deps;
  if (!els || !state) return;

  const statsOpen = (state.ui.statsPanelOpen ?? true);
  if (els.statsBody) setShown(els.statsBody, statsOpen, "block");
  if (els.statsToggle) els.statsToggle.setAttribute("aria-expanded", statsOpen ? "true" : "false");

  const historyOpen = (state.ui.historyPanelOpen ?? true);
  if (els.historyBody) setShown(els.historyBody, historyOpen, "block");
  if (els.historyToggle) els.historyToggle.setAttribute("aria-expanded", historyOpen ? "true" : "false");

  const quickOpen = (state.ui.quickPanelOpen ?? true);
  if (els.quickBody) setShown(els.quickBody, quickOpen, "block");
  if (els.quickToggle) els.quickToggle.setAttribute("aria-expanded", quickOpen ? "true" : "false");

  const scavengeOpen = (state.ui.scavengePanelOpen ?? true);
  if (els.scavengeBody) setShown(els.scavengeBody, scavengeOpen, "block");
  if (els.scavengeToggle) els.scavengeToggle.setAttribute("aria-expanded", scavengeOpen ? "true" : "false");

  const invOpen = (state.ui.invPanelOpen ?? true);
  if (els.invBody) setShown(els.invBody, invOpen, "block");
  if (els.invToggle) els.invToggle.setAttribute("aria-expanded", invOpen ? "true" : "false");
}

export function renderInventoryPanels(deps){
  const { els, state, setShown } = deps;
  if (!els || !state) return;

  const equipOpen = (state.ui.invEquipOpen ?? true);
  if (els.equipBody) setShown(els.equipBody, equipOpen, "block");
  if (els.equipToggle) els.equipToggle.setAttribute("aria-expanded", equipOpen ? "true" : "false");

  const toolbeltOpen = (state.ui.invToolbeltOpen ?? true);
  if (els.toolbeltBody) setShown(els.toolbeltBody, toolbeltOpen, "block");
  if (els.toolbeltToggle) els.toolbeltToggle.setAttribute("aria-expanded", toolbeltOpen ? "true" : "false");

  const backpackOpen = (state.ui.invBackpackOpen ?? true);
  if (els.backpackBody) setShown(els.backpackBody, backpackOpen, "block");
  if (els.backpackToggle) els.backpackToggle.setAttribute("aria-expanded", backpackOpen ? "true" : "false");
}

export function renderInventoryPage(deps){
  const {
    els,
    state,
    thingByKey,
    applyTierClass,
    symbolFor,
    sortKeyList,
    twAdd,
    openInspector,
    scheduleCloseInspector
  } = deps;
  if (!els || !state) return;

  if (els.equipGrid){
    els.equipGrid.innerHTML = "";
    const eq = state.player.equipment ?? {};
    const slots = [
      { key:"headgear", label:"Headgear" },
      { key:"eyewear", label:"Eyewear" },
      { key:"neckwear", label:"Neckwear" },
      { key:"gloves", label:"Gloves" },
      { key:"chestwear", label:"Chestwear" },
      { key:"legwear", label:"Legwear" },
      { key:"shoes", label:"Shoes" },
      { key:"ring1", label:"Ring" },
      { key:"ring2", label:"Ring" },
      { key:"bag1", label:"Bag" },
      { key:"bag2", label:"Bag" },
      { key:"bag3", label:"Bag" },
    ];

    const POS = {
      headgear:  "col-start-2 row-start-1",
      eyewear:   "col-start-2 row-start-2",
      neckwear:  "col-start-2 row-start-3",
      ring2:     "col-start-1 row-start-2",
      ring1:     "col-start-1 row-start-3",
      gloves:    "col-start-1 row-start-4",
      chestwear: "col-start-2 row-start-4",
      bag1:      "col-start-3 row-start-3",
      bag2:      "col-start-3 row-start-4",
      bag3:      "col-start-3 row-start-5",
      legwear:   "col-start-2 row-start-5",
      shoes:     "col-start-2 row-start-6",
    };

    slots.forEach(s => {
      const cell = document.createElement("div");
      cell.className = "equipCell";
      cell.dataset.slot = s.key;
      twAdd(cell, "flex flex-col items-center gap-1 " + (POS[s.key] || ""));

      const slot = document.createElement("div");
      slot.className = "slot equipSlot";
      const itemKey = eq[s.key];
      if (itemKey){
        const tier = thingByKey[itemKey]?.tier;
        if (tier) applyTierClass(slot, tier);
        slot.innerHTML = `
          <div class="slotSymbol">${symbolFor(itemKey)}</div>
        `;

        slot.addEventListener("mouseenter", () => openInspector(itemKey, slot, "inventory"));
        slot.addEventListener("mouseleave", () => scheduleCloseInspector());
        slot.addEventListener("click", (e) => {
          e.stopPropagation();
          openInspector(itemKey, slot, "inventory");
        });
      } else {
        slot.classList.add("is-empty");
        slot.innerHTML = "";
      }

      const lab = document.createElement("div");
      lab.className = "equipLabel";
      twAdd(lab, "text-[10px] font-normal tracking-tight text-slate-500 dark:text-slate-400");
      lab.textContent = s.label;

      cell.appendChild(slot);
      cell.appendChild(lab);
      els.equipGrid.appendChild(cell);
    });
  }

  if (els.toolbeltGrid){
    els.toolbeltGrid.innerHTML = "";
    const tb = state.player.toolbelt ?? {};
    const TOOLBELT_SLOTS = ["tool1","tool2","tool3","tool4","tool5","tool6"];

    const used = TOOLBELT_SLOTS.reduce((acc, s) => acc + (tb[s] ? 1 : 0), 0);
    const total = TOOLBELT_SLOTS.length;
    if (els.toolbeltCount) els.toolbeltCount.textContent = String(used);
    if (els.toolbeltTotal) els.toolbeltTotal.textContent = String(total);

    TOOLBELT_SLOTS.forEach((slotKey, i) => {
      const toolKey = tb[slotKey] ?? null;
      const slot = document.createElement("div");
      slot.className = "slot equipSlot toolbeltToolSlot toolbeltSlot";
      slot.dataset.slot = slotKey;

      const idx = i + 1;
      const symbol = toolKey ? symbolFor(toolKey) : "\uD83E\uDDF0";
      slot.innerHTML = `
        <div class="toolbeltIndex absolute top-1 left-1 grid h-4 min-w-4 place-items-center rounded-md bg-slate-900/10 px-1 text-[10px] font-normal text-slate-900 dark:bg-white/10 dark:text-slate-100">${idx}</div>
        <div class="slotSymbol grid place-items-center text-xl leading-none select-none">${symbol}</div>
      `;

      if (toolKey){
        const tier = thingByKey[toolKey]?.tier;
        if (tier) applyTierClass(slot, tier);

        slot.addEventListener("mouseenter", () => openInspector(toolKey, slot, "inventory"));
        slot.addEventListener("mouseleave", () => scheduleCloseInspector());
        slot.addEventListener("click", (e) => {
          e.stopPropagation();
          openInspector(toolKey, slot, "inventory");
        });
      } else {
        slot.classList.add("is-empty", "toolGhost");
      }

      els.toolbeltGrid.appendChild(slot);
    });
  }

  if (els.invSlotsGrid){
    els.invSlotsGrid.innerHTML = "";
    const cap = state.player.inventorySlots ?? 16;
    const inv = state.player.inventory ?? {};
    const nonZero = Object.keys(inv)
      .filter(k => (inv[k] ?? 0) > 0)
      .map(k => ({ key:k, count:inv[k] }));

    const sortMode = (state.ui.invBackpackSort ?? "type");
    if (els.invBackpackSort) els.invBackpackSort.value = sortMode;

    const sortedKeys = sortKeyList(nonZero.map(o => o.key), sortMode);
    const sorted = sortedKeys.map(k => nonZero.find(o => o.key === k)).filter(Boolean).slice(0, cap);

    for (let i = 0; i < cap; i++){
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.classList.add("cabinetSlot");

      if (sorted[i]){
        const it = sorted[i];
        const tier = thingByKey[it.key]?.tier;
        if (tier) applyTierClass(slot, tier);
        slot.innerHTML = `
          <div class="slotCount">${it.count}</div>
          <div class="slotSymbol">${symbolFor(it.key)}</div>
        `;
        slot.addEventListener("mouseenter", () => openInspector(it.key, slot, "inventory"));
        slot.addEventListener("mouseleave", () => scheduleCloseInspector());
        slot.addEventListener("click", (e) => {
          e.stopPropagation();
          openInspector(it.key, slot, "inventory");
        });
      } else {
        slot.classList.add("is-empty");
        slot.innerHTML = "";
      }
      els.invSlotsGrid.appendChild(slot);
    }
  }
}

export function renderMiniInventory(deps){
  const {
    els,
    state,
    thingByKey,
    applyTierClass,
    symbolFor,
    sortKeyList,
    openInspector,
    scheduleCloseInspector
  } = deps;
  if (!els || !state) return;

  els.inventoryMiniGrid.innerHTML = "";

  const cap = state.player.inventorySlots ?? 16;
  els.invSlotsLabel.textContent = `${cap} slots`;
  if (els.invSlotsLabel2) els.invSlotsLabel2.textContent = String(cap);

  const inv = state.player.inventory ?? {};

  const sortMode = (state.ui.invBackpackSort ?? "type");
  const keys = Object.keys(inv).filter(k => (inv[k] ?? 0) > 0);
  const sortedKeys = sortKeyList(keys, sortMode).slice(0, cap);
  const things = sortedKeys.map(k => ({ key:k, count:inv[k] }));

  for (let i = 0; i < cap; i++){
    const slot = document.createElement("div");
    slot.className = "miniSlot";

    if (things[i]){
      const t = things[i];
      const tier = thingByKey[t.key]?.tier;
      if (tier) applyTierClass(slot, tier);
      slot.innerHTML = `
        <div class="miniCount">${t.count}</div>
        <div class="miniSymbol">${symbolFor(t.key)}</div>
      `;

      slot.addEventListener("mouseenter", () => openInspector(t.key, slot, "inventory"));
      slot.addEventListener("mouseleave", () => scheduleCloseInspector());
      slot.addEventListener("click", (e) => {
        e.stopPropagation();
        openInspector(t.key, slot, "inventory");
      });
    } else {
      slot.classList.add("is-empty");
      slot.innerHTML = "";
    }

    els.inventoryMiniGrid.appendChild(slot);
  }
}

export function renderStats(deps){
  const {
    els,
    state,
    LEVEL_CAP,
    COMBAT_STAT_KEYS,
    getActiveCharId,
    getCharacter,
    getCombatTrainingTarget,
    getCombatStatLevel,
    getAttributeLevel,
    getAttributeProgress
  } = deps;
  if (!els?.statsGrid || !state) return;

  const activeId = getActiveCharId();
  const ch = getCharacter(activeId);

  const trainTarget = getCombatTrainingTarget();

  const ICON = {
    hp: `
    <svg class="attrSvg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fwm-hp-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="currentColor" stop-opacity="0.95"/>
          <stop offset="1" stop-color="currentColor" stop-opacity="0.35"/>
        </linearGradient>
      </defs>
      <path d="M32 54C20 45 10 36 10 25c0-7 5-13 12-13 5 0 8 2 10 6 2-4 5-6 10-6 7 0 12 6 12 13 0 11-10 20-22 29z"
        fill="url(#fwm-hp-g)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    </svg>`,
    attack: `
    <svg class="attrSvg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fwm-atk-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="currentColor" stop-opacity="0.95"/>
          <stop offset="1" stop-color="currentColor" stop-opacity="0.30"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="3"/>
      <circle cx="32" cy="32" r="6" fill="url(#fwm-atk-g)" stroke="currentColor" stroke-width="3"/>
      <path d="M32 8v10M32 46v10M8 32h10M46 32h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    strength: `
    <svg class="attrSvg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fwm-str-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="currentColor" stop-opacity="0.95"/>
          <stop offset="1" stop-color="currentColor" stop-opacity="0.28"/>
        </linearGradient>
      </defs>
      <!-- Dumbbell (Strength) -->
      <rect x="10" y="25" width="6" height="14" rx="2" fill="url(#fwm-str-g)" stroke="currentColor" stroke-width="3"/>
      <rect x="16" y="21" width="7" height="22" rx="2" fill="url(#fwm-str-g)" stroke="currentColor" stroke-width="3"/>
      <path d="M23 32h18" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
      <rect x="41" y="21" width="7" height="22" rx="2" fill="url(#fwm-str-g)" stroke="currentColor" stroke-width="3"/>
      <rect x="48" y="25" width="6" height="14" rx="2" fill="url(#fwm-str-g)" stroke="currentColor" stroke-width="3"/>
    </svg>`,
    defence: `
    <svg class="attrSvg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fwm-def-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="currentColor" stop-opacity="0.95"/>
          <stop offset="1" stop-color="currentColor" stop-opacity="0.30"/>
        </linearGradient>
      </defs>
      <path d="M32 8l18 8v18c0 14-10 23-18 27-8-4-18-13-18-27V16l18-8z"
        fill="url(#fwm-def-g)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
      <path d="M32 18v32" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    </svg>`,
    distillery: `
    <svg class="attrSvg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fwm-dis-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="currentColor" stop-opacity="0.95"/>
          <stop offset="1" stop-color="currentColor" stop-opacity="0.28"/>
        </linearGradient>
      </defs>
      <path d="M24 8h16v8l-2 2v10l12 18c3 5-1 12-7 12H21c-6 0-10-7-7-12l12-18V18l-2-2V8z"
        fill="url(#fwm-dis-g)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
      <path d="M22 42h20" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.65"/>
    </svg>`,
  };

  const ORDER = ["hp","attack","strength","defence","distillery"];

  const tilesHtml = ORDER.map((key) => {
    const isCombat = COMBAT_STAT_KEYS.includes(key);
    const lvl = isCombat ? getCombatStatLevel(activeId, key) : getAttributeLevel(key);

    const isTrainable = (key === "attack" || key === "strength" || key === "defence");
    const isActive = isTrainable && trainTarget === key;

    const trainIcon = isTrainable
      ? `<span class="trainTarget${isActive ? " active" : ""}" data-train="${key}" title="Set training target" aria-label="Set training target">âŒ–</span>`
      : "";

    const dataAttr = isCombat ? `data-combat="${key}"` : `data-attr="${key}"`;
    const klass = isCombat ? "combatAttrItem" : "attrItem";
    const label = key.charAt(0).toUpperCase() + key.slice(1);

    return `
      <div class="attrTile expandable ${klass}" ${dataAttr} aria-label="${label}">
        ${trainIcon}
        <div class="attrTileIcon">${ICON[key] || ""}</div>
        <div class="attrTileLevel">${lvl}</div>
      </div>`;
  }).join("");

  els.statsGrid.innerHTML = `
    <div style="grid-column:1 / -1;display:flex;flex-direction:column;gap:8px">
      <div class="statItem" style="text-align:left">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div style="font-weight:900">${ch.name}</div>
          <div class="statLabel">Lvl ${ch.level} â€¢ ${ch.hp}/${ch.maxHp} HP</div>
        </div>
      </div>
      <div class="attrTilesGrid">${tilesHtml}</div>
    </div>
  `;
}

export function renderHistory(deps){
  const { els, state } = deps;
  if (!els?.historyList || !state) return;
  const h = state.history ?? {};

  const rows = [
    { k: "MU earned", v: h.muEarned ?? 0 },
    { k: "MU spent", v: h.muSpent ?? 0 },
    { k: "Minions killed", v: h.minionsKilled ?? 0 },
    { k: "Scraps found", v: h.scrapsFound ?? 0 },
    { k: "Total XP", v: state?.player?.xp ?? 0 },
  ];

  els.historyList.innerHTML = "";
  rows.forEach(r => {
    const item = document.createElement("div");
    item.className = "historyItem";
    item.innerHTML = '<span class="historyKey">' + r.k + '</span><span class="historyValue">' + r.v + '</span>';
    els.historyList.appendChild(item);
  });
}
