const STORE_FALLBACK_STOCK = [
  "backpack_mk1",
  "test_tube",
  "nerd_glasses",
  "running_shoes",
  "bulletproof_vest",
  "scrap_soda_can",
  "scrap_plastic_bottle",
  "scrap_milk_carton",
  "scrap_usb_drive",
];

const A1_STORE_GREETINGS = [
  "Welcome back. Buying today, or unloading scrap?",
  "Everything has a price. Even patience.",
  "I can *hear* your backpack creaking from here.",
  "Clean deals. Messy world.",
  "If youâ€™re here, you survived. Thatâ€™s worth something."
];

const A1_STORE_TALK_LINES = [
  "A1â€™s eyes shift color for a heartbeat. â€˜Donâ€™t stare. Itâ€™s rude.â€™",
  "â€˜I sell tools. I collect stories. Both cut deep.â€™",
  "â€˜Locks are love. Use them.â€™",
  "â€˜Bring me weird scrap. Iâ€™ll pretend Iâ€™m not impressed.â€™",
  "He smiles â€” then someone elseâ€™s smile. â€˜Same sentiment.â€™"
];

export function fmtMsCompact(ms){
  const m = Math.max(0, Math.floor(Number(ms) || 0));
  const s = Math.floor(m / 1000);
  const sec = s % 60;
  const min = Math.floor(s / 60) % 60;
  const hr = Math.floor(s / 3600);
  if (hr > 0) return `${hr}h ${min}m`;
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

function fmtA1Tubes(v){
  const x = Number(v) || 0;
  if (!Number.isFinite(x)) return "0";
  const r = Math.round(x);
  if (Math.abs(x - r) < 1e-9) return String(r);
  return x.toFixed(2);
}

function reqProgress(req, banked){
  const r = req || {};
  const b = banked || {};
  let needTotal = 0;
  let haveTotal = 0;
  for (const [k,n] of Object.entries(r)){
    const nnT = Math.max(0, Math.floor(Number(n) || 0));
    if (!nnT) continue;
    const nn = nnT * 100; // requirements are in tubes; banked is in grams
    needTotal += nn;
    const hh = Math.max(0, Math.floor(Number(b[k]) || 0));
    haveTotal += Math.min(hh, nn);
  }
  const pct = needTotal ? (haveTotal / needTotal) : 0;
  return { needTotal, haveTotal, pct: Math.max(0, Math.min(1, pct)) };
}

function pickA1StoreLine(deps, reason){
  const credits = Math.max(0, Math.floor(Number(deps.state?.player?.credits) || 0));
  const lastSale = deps.state?.player?.lastSale;

  if (reason === "enter"){
    if (credits <= 0) return "No MU? Thatâ€™s fine. Sell me something shiny â€” Iâ€™ll remember.";
    if (credits < 10) return "Low on MU. Smart buying beats brave buying.";
    if (credits >= 250) return "Heavy purse. Light conscience. Letâ€™s see what you want.";
    if (lastSale?.key) return "Still thinking about that last sale, huh?";
  }

  const visits = Math.max(0, Math.floor(Number(deps.state?.ui?.a1StoreVisits) || 0));
  const idx = visits % A1_STORE_GREETINGS.length;
  return A1_STORE_GREETINGS[idx] || A1_STORE_GREETINGS[0];
}

function setA1StoreLine(deps, text, { subline=null } = {}){
  if (!deps.els?.storeA1Line) return;
  deps.els.storeA1Line.textContent = String(text || "â€¦");
  if (deps.els.storeA1Subline){
    const show = !!subline;
    deps.els.storeA1Subline.style.display = show ? "block" : "none";
    if (show) deps.els.storeA1Subline.textContent = String(subline);
  }
}

export function a1StoreOnEnter(deps){
  if (!deps.state?.ui) deps.state.ui = {};
  deps.state.ui.a1StoreVisits = (Number(deps.state.ui.a1StoreVisits) || 0) + 1;
  setA1StoreLine(deps, pickA1StoreLine(deps, "enter"));
}

export function a1StoreTalk(deps){
  if (!deps.state?.ui) deps.state.ui = {};
  const n = (Number(deps.state.ui.a1StoreTalks) || 0);
  const idx = n % A1_STORE_TALK_LINES.length;
  deps.state.ui.a1StoreTalks = n + 1;
  setA1StoreLine(deps, A1_STORE_TALK_LINES[idx], { subline: "(More options coming soon: Ask, Rumors, Upgrades)" });
  try{ deps.saveGame?.(); }catch(_){/* ignore */}
}

export function renderA1UpgradePanel(deps){
  const { els, state, getA1StoreUpgradeStatus, distilleryStoredFor, symbolFor, labelFor } = deps;
  if (!els?.storeA1UpgradesPanel) return;
  const open = els.storeA1UpgradesPanel.style.display !== "none";
  if (!open) return;

  const st = getA1StoreUpgradeStatus();

  if (els.a1StorageMeta){
    if (!st.storageReq) els.a1StorageMeta.textContent = `Maxed: ${st.capacity}/${st.maxCapacity} slots`;
    else els.a1StorageMeta.textContent = `Next module: +1 slot (to ${Math.min(st.maxCapacity, st.capacity + 1)})`;
  }
  const sp = reqProgress(st.storageReq, st.banked);
  if (els.a1StorageBarFill) els.a1StorageBarFill.style.width = `${Math.round(sp.pct * 100)}%`;
  if (els.a1StorageUpgradeBtn){
    els.a1StorageUpgradeBtn.disabled = !st.storageReady;
    els.a1StorageUpgradeBtn.title = st.storageReady ? "" : "Sell required tubes or transfer elements from the Distillery Cabinet.";
  }
  if (els.a1StorageNeeds){
    els.a1StorageNeeds.innerHTML = "";
    if (!st.storageReq){
      els.a1StorageNeeds.innerHTML = `<div class="muted small">No further storage upgrades yet.</div>`;
    } else {
      for (const [ek,need] of Object.entries(st.storageReq)){
        const haveG = Math.max(0, Math.floor(Number(st.banked?.[ek]) || 0));
        const TUBE_GRAMS = 100;
        const cabGrams = distilleryStoredFor(ek);
        const needG = Math.max(0, Math.floor(Number(need) || 0)) * TUBE_GRAMS;
        const remainingG = Math.max(0, needG - haveG);
        const maxTransfer = Math.max(0, Math.min(cabGrams, remainingG));
        const row = document.createElement("div");
        row.className = "a1NeedRow";
        row.innerHTML = `
          <div class="a1NeedLeft">
            <div class="a1NeedSym">${symbolFor(ek)}</div>
            <div class="a1NeedName">${labelFor(ek)}</div>
          </div>
          <div class="a1NeedRight">
            <div class="a1NeedCount">${fmtA1Tubes(Math.min(haveG, needG) / TUBE_GRAMS)}/${fmtA1Tubes(needG / TUBE_GRAMS)}</div>
            <button class="subtleBtn a1TransferBtn" type="button" ${maxTransfer > 0 ? "" : "disabled"}
              title="Transfer from Distillery Cabinet" data-ek="${ek}" data-max="${maxTransfer}">Transfer</button>
          </div>
        `;
        row.querySelector(".a1TransferBtn")?.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const max = Math.max(0, Math.floor(Number(e.currentTarget?.dataset?.max) || 0));
          if (max <= 0) return;
          openA1TransferModal(deps, { elementKey: ek, maxGrams: max, remainingGrams: remainingG, cabGrams });
        });
        els.a1StorageNeeds.appendChild(row);
      }
    }
  }

  if (els.a1LinkMeta){
    if (!st.linkReq) els.a1LinkMeta.textContent = `Maxed: Link ${st.linkLevel}/${st.maxLinkLevel}`;
    else els.a1LinkMeta.textContent = `Next: +1 link (to ${Math.min(st.maxLinkLevel, st.linkLevel + 1)})`;
  }
  const lp = reqProgress(st.linkReq, st.banked);
  if (els.a1LinkBarFill) els.a1LinkBarFill.style.width = `${Math.round(lp.pct * 100)}%`;
  if (els.a1LinkUpgradeBtn){
    els.a1LinkUpgradeBtn.disabled = !st.linkReady;
    els.a1LinkUpgradeBtn.title = st.linkReady ? "" : "Sell required tubes or transfer elements from the Distillery Cabinet.";
  }
  if (els.a1LinkNeeds){
    els.a1LinkNeeds.innerHTML = "";
    if (!st.linkReq){
      els.a1LinkNeeds.innerHTML = `<div class="muted small">No further link upgrades yet.</div>`;
    } else {
      for (const [ek,need] of Object.entries(st.linkReq)){
        const haveG = Math.max(0, Math.floor(Number(st.banked?.[ek]) || 0));
        const TUBE_GRAMS = 100;
        const cabGrams = distilleryStoredFor(ek);
        const needG = Math.max(0, Math.floor(Number(need) || 0)) * TUBE_GRAMS;
        const remainingG = Math.max(0, needG - haveG);
        const maxTransfer = Math.max(0, Math.min(cabGrams, remainingG));
        const row = document.createElement("div");
        row.className = "a1NeedRow";
        row.innerHTML = `
          <div class="a1NeedLeft">
            <div class="a1NeedSym">${symbolFor(ek)}</div>
            <div class="a1NeedName">${labelFor(ek)}</div>
          </div>
          <div class="a1NeedRight">
            <div class="a1NeedCount">${fmtA1Tubes(Math.min(haveG, needG) / TUBE_GRAMS)}/${fmtA1Tubes(needG / TUBE_GRAMS)}</div>
            <button class="subtleBtn a1TransferBtn" type="button" ${maxTransfer > 0 ? "" : "disabled"}
              title="Transfer from Distillery Cabinet" data-ek="${ek}" data-max="${maxTransfer}">Transfer</button>
          </div>
        `;
        row.querySelector(".a1TransferBtn")?.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const max = Math.max(0, Math.floor(Number(e.currentTarget?.dataset?.max) || 0));
          if (max <= 0) return;
          openA1TransferModal(deps, { elementKey: ek, maxGrams: max, remainingGrams: remainingG, cabGrams });
        });
        els.a1LinkNeeds.appendChild(row);
      }
    }
  }
}

export function openA1TransferModal(deps, { elementKey, maxGrams, remainingGrams, cabGrams }){
  const ek = String(elementKey || "");
  const max = Math.max(1, Math.floor(Number(maxGrams) || 1));
  const tier = Number(deps.thingByKey?.[ek]?.tier || 0) || 0;
  const itemName = deps.labelFor(ek);
  const sym = deps.symbolFor(ek);
  let qty = 1;

  deps.openActionModal({
    title: "Transfer",
    tier,
    bodyHtml: `
      <div class="actionRow">
        <div class="actionTileWrap">
          <div class="fwm-tile tier-${tier || 6}">
            <div class="slotCount" id="a1QtyCount">${qty}</div>
            <div class="slotSymbol">${deps.escapeHtml(sym)}</div>
          </div>
        </div>
        <div class="actionText">
          <div class="actionLine"><span class="actionItemName">${deps.escapeHtml(itemName)}</span></div>
          <div class="actionMeta">From Distillery Cabinet â€¢ Available: ${Math.max(0, cabGrams)}g</div>
          <div class="muted small">Remaining needed for current upgrade: ${Math.max(0, Math.floor(Number(remainingGrams) || 0))}g</div>
        </div>
      </div>
      <div class="actionQtyBlock">
        <div class="actionLabel">Amount to transfer (g)</div>
        <div class="actionQtyRow">
          <div class="energyBar tier-${tier || 6}" id="a1EnergyBar">
            <div class="batterySegments" id="a1QtySegments" aria-hidden="true"></div>
            <div class="energyThumb" id="a1QtyThumb" aria-hidden="true"></div>
            <input id="a1QtyRange" class="energyRange" type="range" min="1" max="${max}" step="1" value="${qty}" aria-label="Quantity slider">
          </div>
          <input id="a1QtyNum" type="number" min="1" max="${max}" step="1" value="${qty}">
        </div>
        <div id="a1QtyError" class="actionError" hidden></div>
        <div id="a1TotalLine" class="actionTotal">Transfer: ${qty}g (${fmtA1Tubes(qty / 100)} tubes)</div>
      </div>
    `,
    actions: [
      { kind: "cancel", label: "Cancel", autoFocus: true, onClick: () => deps.closeActionModal() },
      { kind: "confirm", label: `Transfer ${qty}g`, onClick: () => {
          const refs = deps.getActionModalRefs();
          const modal = refs?.modalEl;
          const nEl = modal?.querySelector?.("#a1QtyNum");
          const errEl = modal?.querySelector?.("#a1QtyError");
          const raw = Math.floor(Number(nEl?.value) || 0);
          if (!Number.isFinite(raw) || raw < 1){
            if (errEl){ errEl.hidden = false; errEl.textContent = "Enter a quantity of 1 or more."; }
            return;
          }
          if (raw > max){
            if (errEl){ errEl.hidden = false; errEl.textContent = `You can transfer at most ${max}.`; }
            return;
          }
          const n = Math.max(1, Math.min(max, raw));
          deps.closeActionModal();
          const res = deps.handlers?.onA1DepositFromCabinet?.(ek, n);
          if (res && res.ok){
            try{ setA1StoreLine(deps, "â€˜Good.â€™ A1 pockets the sample.", { subline: "Transferred from the Distillery Cabinet." }); }catch(_){/* ignore */}
          }
          deps.renderAll();
        }
      },
    ],
  });

  setTimeout(() => {
    const refs = deps.getActionModalRefs();
    const modal = refs?.modalEl;
    if (!modal) return;
    const range = modal.querySelector("#a1QtyRange");
    const num = modal.querySelector("#a1QtyNum");
    const totalEl = modal.querySelector("#a1TotalLine");
    const countEl = modal.querySelector("#a1QtyCount");
    const errEl = modal.querySelector("#a1QtyError");
    const energyBar = modal.querySelector("#a1EnergyBar");
    const segWrap = modal.querySelector("#a1QtySegments");
    const confirmBtn = refs?.actionsEl?.querySelector?.('button[data-kind="confirm"]');

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

    const m = Math.max(1, Number(max || 1));
    const segCount = (m <= 20 ? m : 20);
    if (segWrap){
      segWrap.style.setProperty("--segs", String(segCount));
      segWrap.innerHTML = Array.from({ length: segCount }).map(() => "<span class=\"seg\"></span>").join("");
    }

    const setEnergy = (n) => {
      const q = Math.max(1, Math.min(m, Math.floor(Number(n) || 1)));
      const filled = (m <= segCount) ? q : Math.max(1, Math.round((q / m) * segCount));
      if (segWrap){
        const segs = segWrap.querySelectorAll?.(".seg") || [];
        segs.forEach((el, idx) => el.classList.toggle("on", idx < filled));
      }
      if (energyBar){
        const segs = segWrap?.querySelectorAll?.(".seg") || [];
        const idx = Math.max(0, Math.min(segs.length - 1, filled - 1));
        const segEl = segs[idx];
        if (segEl && typeof segEl.getBoundingClientRect === "function"){
          const barRect = energyBar.getBoundingClientRect();
          const segRect = segEl.getBoundingClientRect();
          const centerPx = (segRect.left - barRect.left) + (segRect.width / 2);
          energyBar.style.setProperty("--thumbX", `${centerPx}px`);
        } else {
          const p = (segCount <= 1) ? 50 : ((filled - 0.5) / segCount) * 100;
          energyBar.style.setProperty("--p", `${p}`);
          energyBar.style.removeProperty("--thumbX");
        }
      }
    };

    const clamp = (n) => Math.max(1, Math.min(m, Math.floor(Number(n) || 1)));
    const updateFromValid = (n) => {
      qty = clamp(n);
      if (range) range.value = String(qty);
      if (num) num.value = String(qty);
      if (countEl) countEl.textContent = String(qty);
      if (totalEl) totalEl.textContent = `Transfer: ${qty}g (${fmtA1Tubes(qty / 100)} tubes)`;
      if (confirmBtn) confirmBtn.textContent = `Transfer ${qty}g`;
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
      if (raw > m){
        showErr(`You can transfer at most ${m}.`);
        setConfirmEnabled(false);
        return;
      }
      updateFromValid(raw);
    };

    range?.addEventListener("input", () => updateFromValid(range.value), { passive: true });
    num?.addEventListener("input", () => validateNum(), { passive: true });

    updateFromValid(qty);
  }, 0);
}

export function renderStore(deps){
  const {
    els,
    state,
    handlers,
    thingByKey,
    labelFor,
    symbolFor,
    sortKeyList,
    applyTierClass,
    getA1StoreUpgradeStatus,
    distilleryStoredFor
  } = deps;
  if (!els.storeBuyGrid || !els.storeSellGrid) return;

  if (els.storeCredits) els.storeCredits.textContent = `${String(state.player.credits ?? 0)} MU`;

  if (els.storeUndoBtn){
    const ls = state.player.lastSale;
    const show = !!ls && typeof ls === "object" && ls.key;
    els.storeUndoBtn.style.display = show ? "inline-flex" : "none";
    if (show){
      const nm = labelFor(ls.key);
      els.storeUndoBtn.textContent = `Undo last sale (${nm})`;
    }
  }

  if (els.storeBuySort) els.storeBuySort.value = (state.ui.storeBuySort ?? "type");
  try{ deps.syncSortChips(els.storeBuySort); }catch(_){/* ignore */}

  const st = getA1StoreUpgradeStatus();
  if (els.storeA1Subline){
    const now = Date.now();
    const left = Math.max(0, (Number(st.nextRefreshAt) || 0) - now);
    els.storeA1Subline.style.display = "block";
    els.storeA1Subline.textContent = `Slots: ${st.capacity}/${st.maxCapacity} â€¢ Next refresh in ${fmtMsCompact(left)}`;
  }
  renderA1UpgradePanel(deps);

  els.storeBuyGrid.innerHTML = "";
  const sortMode = (state.ui.storeBuySort ?? "type");
  const raw = (Array.isArray(state.store?.stock) && state.store.stock.length)
    ? state.store.stock
    : STORE_FALLBACK_STOCK;
  const cap = Math.max(1, Math.floor(Number(st.capacity) || raw.length || 8));
  const keysSorted = sortKeyList(raw.filter(Boolean), sortMode).slice(0, cap);

  for (let i = 0; i < cap; i++){
    const key = keysSorted[i] || null;
    const slot = document.createElement("div");
    slot.className = "slot storeSlot";
    if (!key){
      slot.classList.add("is-empty");
      slot.innerHTML = `<div class="slotEmpty">Empty slot</div>`;
      els.storeBuyGrid.appendChild(slot);
      continue;
    }

    const t = thingByKey[key];
    const price = Math.max(0, Math.floor(Number(t?.buyPrice) || 0));
    const tier = t?.tier;
    if (tier) slot.classList.add(`tier-${tier}`);
    slot.innerHTML = `
      <div class="slotPrice">${price} MU</div>
      <div class="slotSymbol">${symbolFor(key)}</div>
    `;
    slot.title = `Buy: ${labelFor(key)} (${price} MU)`;
    slot.addEventListener("click", (e) => {
      try{ e.stopPropagation(); }catch(_){/* ignore */}
      deps.openInspector(key, slot, "store-buy");
    });

    els.storeBuyGrid.appendChild(slot);
  }

  els.storeSellGrid.innerHTML = "";
  const inv = state.player.inventory ?? {};
  const eq = state.player.equipment ?? {};
  const tb = state.player.toolbelt ?? {};
  void tb;

  const equippedGearKeys = new Set(Object.values(eq).filter(Boolean));
  const ownedKeys = Object.keys(inv).filter(k => (inv[k] ?? 0) > 0);

  const sellableUniverse = new Set([
    ...Object.keys(thingByKey).filter(k => {
      const t = thingByKey[k];
      return t?.kind === "Material" || t?.kind === "Gear" || t?.kind === "Item" || t?.kind === "Tool";
    })
  ]);

  const keys = Array.from(new Set(ownedKeys))
    .filter(k => sellableUniverse.has(k))
    .filter(k => !equippedGearKeys.has(k));

  keys.sort((a,b) => {
    const ak = thingByKey[a]?.kind ?? "";
    const bk = thingByKey[b]?.kind ?? "";
    const ord = (k) => (k === "Gear" ? 0 : k === "Material" ? 1 : 2);
    const ao = ord(ak), bo = ord(bk);
    if (ao !== bo) return ao - bo;
    return labelFor(a).localeCompare(labelFor(b));
  });

  for (const key of keys){
    const slot = document.createElement("div");
    slot.className = "slot storeSlot";

    const t = thingByKey[key];
    const tier = t?.tier;
    if (tier) slot.classList.add(`tier-${tier}`);
    const count = Math.max(0, Math.floor(Number(inv[key]) || 0));
    const price = Math.max(0, Math.floor(Number(t?.sellPrice) || 0));

    const lockBtn = document.createElement("button");
    lockBtn.type = "button";
    const isLocked = !!state.player?.locks?.[key];
    lockBtn.className = "lockBtn" + (isLocked ? " locked" : " unlocked");
    lockBtn.title = state.player?.locks?.[key] ? "Locked (click to unlock)" : "Click to lock";
    lockBtn.textContent = state.player?.locks?.[key] ? "ðŸ”’" : "ðŸ”“";
    lockBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers?.onToggleLock?.(key);
    });

    slot.innerHTML = `
      <div class="slotCount">${count}</div>
      <div class="slotPrice">${price} MU</div>
      <div class="slotSymbol">${symbolFor(key)}</div>
    `;
    slot.appendChild(lockBtn);
    const lockedNow = !!state.player?.locks?.[key];
    if (lockedNow) slot.classList.add("lockedSlot");
    slot.title = lockedNow
      ? `Locked: ${labelFor(key)} (cannot sell)`
      : `Sell: ${labelFor(key)} (${price} MU each)`;

    slot.addEventListener("click", (e) => {
      e.stopPropagation();
      deps.openInspector(key, slot, "store-sell");
    });

    els.storeSellGrid.appendChild(slot);
  }
}
