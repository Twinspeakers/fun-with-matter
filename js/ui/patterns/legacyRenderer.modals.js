let lootModalRefs = null;
let actionModalRefs = null;
let actionModalCloseTimer = null;
let prevBodyOverflow = null;
let faintModalRefs = null;

function ensureLootModal(deps){
  if (typeof document === "undefined") return null;

  const existing = document.getElementById("lootModalOverlay");
  if (lootModalRefs?.overlay && existing === lootModalRefs.overlay){
    return lootModalRefs;
  }

  let overlay = existing;
  if (!overlay){
    overlay = document.createElement("div");
    overlay.id = "lootModalOverlay";
    overlay.className = "lootOverlay";
    overlay.hidden = true;
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "14px";
    overlay.style.zIndex = "10000";
    overlay.style.pointerEvents = "auto";
    overlay.innerHTML = `
      <div class="lootBackdrop" data-loot-backdrop="1"></div>
      <div class="lootModal" role="dialog" aria-modal="true" aria-labelledby="lootModalTitle">
        <div class="lootHeader">
          <div class="lootHeaderText">
            <div id="lootModalTitle" class="lootTitle">Loot</div>
            <div class="lootSubtitle muted"></div>
          </div>
          <button type="button" class="lootCloseBtn" aria-label="Close">×</button>
        </div>
        <div class="lootGrid"></div>
        <div class="lootActions">
          <button type="button" class="lootInvBtn">Open Inventory</button>
          <button type="button" class="lootContinueBtn">Continue</button>
        </div>
      </div>
    `;
    const host = document.querySelector(".fwm") || document.body;
    host.appendChild(overlay);
  } else {
    const host = document.querySelector(".fwm") || document.body;
    if (overlay.parentElement !== host){
      host.appendChild(overlay);
    }

    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.display = overlay.hidden ? "none" : "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "14px";
    overlay.style.zIndex = "10000";
    overlay.style.pointerEvents = "auto";
  }

  if (!overlay.dataset.wired){
    overlay.dataset.wired = "1";

    const close = () => {
      deps.closeInspector?.();
      if (deps.state?.ui && typeof deps.state.ui === "object"){
        delete deps.state.ui.lootModal;
      }
      deps.saveGame?.();
      renderLootModal(deps);
    };

    const onAnyPointer = (e) => {
      if (e.target?.dataset?.lootBackdrop) close();
    };
    overlay.addEventListener("click", onAnyPointer, true);
    overlay.addEventListener("touchstart", onAnyPointer, true);

    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!deps.state?.ui?.lootModal?.open) return;
      close();
    });

    overlay.querySelector(".lootCloseBtn")?.addEventListener("click", close, true);
    overlay.querySelector(".lootContinueBtn")?.addEventListener("click", close, true);
    overlay.querySelector(".lootInvBtn")?.addEventListener("click", () => {
      const lm = deps.state?.ui?.lootModal;
      const primary = lm?.primaryAction;

      if (primary){
        deps.handlers?.onLootPrimary?.(primary);
        return;
      }

      if (!deps.state?.ui) deps.state.ui = {};
      deps.state.ui.activePage = "inventory";
      close();
      deps.renderAll?.();
    });
  }

  lootModalRefs = lootModalRefs || {};
  lootModalRefs.overlay = overlay;
  lootModalRefs.titleEl = overlay.querySelector("#lootModalTitle");
  lootModalRefs.subtitleEl = overlay.querySelector(".lootSubtitle");
  lootModalRefs.gridEl = overlay.querySelector(".lootGrid");
  lootModalRefs.invBtn = overlay.querySelector(".lootInvBtn");
  lootModalRefs.continueBtn = overlay.querySelector(".lootContinueBtn");
  lootModalRefs._sig = overlay.dataset.sig || null;

  return lootModalRefs;
}

export function renderLootModal(deps){
  const refs = ensureLootModal(deps);
  if (!refs?.overlay) return;
  const lm = deps.state?.ui?.lootModal;

  if (!lm?.open){
    refs.overlay.hidden = true;
    refs.overlay.style.display = "none";
    refs.overlay.classList.remove("open");
    refs.overlay.style.display = "none";
    if (refs.gridEl) refs.gridEl.innerHTML = "";
    refs._sig = null;
    refs.overlay.dataset.sig = "";
    return;
  }

  refs.overlay.hidden = false;
  refs.overlay.style.display = "flex";
  refs.overlay.classList.add("open");
  refs.overlay.style.display = "flex";

  if (refs.invBtn) refs.invBtn.textContent = lm?.primaryLabel || (lm?.primaryAction ? "Action" : "Open Inventory");
  if (refs.continueBtn) refs.continueBtn.textContent = lm?.continueLabel || "Continue";
  const actionsRow = refs.overlay.querySelector(".lootActions");
  if (actionsRow && refs.invBtn && refs.continueBtn){
    if (lm?.swapActions){
      actionsRow.insertBefore(refs.continueBtn, refs.invBtn);
    } else {
      actionsRow.insertBefore(refs.invBtn, refs.continueBtn);
    }
  }

  if (refs.titleEl) refs.titleEl.textContent = lm.title || "Loot";
  const drops = Math.max(0, Number(lm.itemCount) || 0);
  const bp = Math.max(0, Number(lm.blueprintCount) || 0);
  const subBits = [];
  subBits.push(`${drops} drop${drops === 1 ? "" : "s"}`);
  if (bp > 0) subBits.push(`${bp} blueprint${bp === 1 ? "" : "s"} unlocked`);
  if (lm.enemyName) subBits.push(`from ${lm.enemyName}`);
  if (refs.subtitleEl) refs.subtitleEl.textContent = subBits.join(" • ");

  const items = Array.isArray(lm.items) ? lm.items : [];
  const compactItems = items.map(it => ({
    key: it?.key,
    qty: Math.max(0, Math.floor(Number(it?.qty) || 0)),
    kind: it?.kind || "",
    equipped: !!it?.equipped,
    labelOverride: !!it?.labelOverride,
  })).filter(it => !!it.key);
  const sig = JSON.stringify({
    title: lm.title || "",
    enemyName: lm.enemyName || "",
    itemCount: Number(lm.itemCount) || 0,
    blueprintCount: Number(lm.blueprintCount) || 0,
    items: compactItems,
  });

  if (refs._sig === sig) return;
  refs._sig = sig;
  refs.overlay.dataset.sig = sig;

  if (refs.gridEl){
    refs.gridEl.innerHTML = "";
    compactItems.forEach((it, i) => {
      const key = it?.key;
      if (!key) return;
      const slot = document.createElement("div");
      slot.className = "slot lootSlot lootPop";
      const tier = deps.thingByKey?.[key]?.tier;
      if (tier) deps.applyTierClass?.(slot, tier);

      const qty = it.qty;
      const isBlueprint = it.kind === "blueprint";
      const tags = [];
      if (isBlueprint) tags.push("NEW BP");
      if (it.kind === "cabinet") tags.push("CABINET");
      if (it.equipped) tags.push("EQUIPPED");
      if (it.labelOverride) tags.push("CACHE");

      slot.innerHTML = `
        ${(!isBlueprint) ? `<div class="slotCount">${qty || 1}</div>` : ``}
        <div class="slotSymbol">${deps.symbolFor?.(key) ?? ""}</div>
        ${tags.length ? `<div class="lootTag">${tags[0]}</div>` : ``}
      `;

      slot.style.animationDelay = `${Math.min(12, i) * 110}ms`;

      slot.addEventListener("mouseenter", () => deps.openInspector?.(key, slot, "inventory"));
      slot.addEventListener("mouseleave", () => deps.scheduleCloseInspector?.());
      slot.addEventListener("click", (e) => {
        e.stopPropagation();
        deps.openInspector?.(key, slot, "inventory");
      });

      refs.gridEl.appendChild(slot);
    });
  }
}

function ensureActionModal(deps){
  if (typeof document === "undefined") return null;

  const existing = document.getElementById("actionModalOverlay");
  if (actionModalRefs?.overlay && existing === actionModalRefs.overlay){
    return actionModalRefs;
  }

  let overlay = existing;
  if (!overlay){
    overlay = document.createElement("div");
    overlay.id = "actionModalOverlay";
    overlay.className = "actionOverlay";
    overlay.hidden = true;
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "14px";
    overlay.style.zIndex = "11000";
    overlay.style.pointerEvents = "auto";
    overlay.innerHTML = `
      <div class="actionBackdrop" data-action-backdrop="1"></div>
      <div class="actionModal" role="dialog" aria-modal="true" aria-labelledby="actionModalTitle">
        <div class="actionHeader">
          <div id="actionModalTitle" class="actionTitle">Confirm</div>
          <button type="button" class="actionCloseBtn" aria-label="Close">×</button>
        </div>
        <div class="actionBody"></div>
        <div class="actionActions"></div>
      </div>
    `;
    const host = document.querySelector(".fwm") || document.body;
    host.appendChild(overlay);
  } else {
    const host = document.querySelector(".fwm") || document.body;
    if (overlay.parentElement !== host){
      host.appendChild(overlay);
    }
  }

  if (!overlay.dataset.wired){
    overlay.dataset.wired = "1";

    const close = () => closeActionModal(deps);

    const onAnyPointer = (e) => {
      if (e.target?.dataset?.actionBackdrop) close();
    };
    overlay.addEventListener("click", onAnyPointer, true);
    overlay.addEventListener("touchstart", onAnyPointer, true);
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!deps.state?.ui?.actionModal?.open) return;
      close();
    });
    overlay.querySelector(".actionCloseBtn")?.addEventListener("click", close, true);
  }

  actionModalRefs = actionModalRefs || {};
  actionModalRefs.overlay = overlay;
  actionModalRefs.titleEl = overlay.querySelector("#actionModalTitle");
  actionModalRefs.modalEl = overlay.querySelector(".actionModal");
  actionModalRefs.bodyEl = overlay.querySelector(".actionBody");
  actionModalRefs.actionsEl = overlay.querySelector(".actionActions");
  actionModalRefs.callbacks = actionModalRefs.callbacks || Object.create(null);
  return actionModalRefs;
}

export function renderActionModal(deps){
  const refs = ensureActionModal(deps);
  if (!refs?.overlay) return;
  const am = deps.state?.ui?.actionModal;
  if (!am?.open){
    if (refs.modalEl){
      refs.modalEl.classList.remove("open", "closing");
      refs.modalEl.classList.remove("tier-1", "tier-2", "tier-3", "tier-4", "tier-5", "tier-6");
    }
    refs.overlay.hidden = true;
    refs.overlay.style.display = "none";
    if (refs.bodyEl) refs.bodyEl.innerHTML = "";
    if (refs.actionsEl) refs.actionsEl.innerHTML = "";
    return;
  }

  refs.overlay.hidden = false;
  refs.overlay.style.display = "flex";

  if (refs.titleEl) refs.titleEl.textContent = am.title || "Confirm";

  if (refs.modalEl){
    refs.modalEl.classList.remove("tier-1", "tier-2", "tier-3", "tier-4", "tier-5", "tier-6");
    const tier = Number(am.tier || 0);
    if (tier) refs.modalEl.classList.add(`tier-${tier}`);

    refs.modalEl.classList.remove("closing");
    refs.modalEl.classList.add("open");
  }

  if (refs.bodyEl) refs.bodyEl.innerHTML = am.bodyHtml || "";

  if (refs.actionsEl){
    refs.actionsEl.innerHTML = "";
    const buttons = Array.isArray(am.actions) ? am.actions : [];
    buttons.forEach((btn, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(btn?.label || "OK");
      if (btn?.kind) b.dataset.kind = String(btn.kind);
      const kind = String(btn?.kind || "");
      if (kind === "cancel") b.classList.add("actionCancel");
      if (kind === "confirm") b.classList.add("actionConfirm");
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = String(btn?.id || "");
        const cb = (id && refs?.callbacks) ? refs.callbacks[id] : null;
        try{ cb?.(); }catch(_){/* ignore */}
      }, true);
      refs.actionsEl.appendChild(b);

      if (idx === 0 && btn?.autoFocus){
        setTimeout(() => { try{ b.focus(); }catch(_){/* ignore */} }, 0);
      }
    });
  }
}

export function getActionModalRefs(deps){
  return ensureActionModal(deps);
}

export function openActionModal(deps, { title="Confirm", tier=0, bodyHtml="", actions=[] } = {}){
  const refs = ensureActionModal(deps);
  if (!deps.state?.ui) deps.state.ui = {};

  if (actionModalCloseTimer){
    clearTimeout(actionModalCloseTimer);
    actionModalCloseTimer = null;
  }

  try{
    if (prevBodyOverflow === null) prevBodyOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
  }catch(_){/* ignore */}

  refs.callbacks = Object.create(null);

  const safeActions = (Array.isArray(actions) ? actions : []).map((a, i) => {
    const id = String(a?.id || `a${Date.now()}_${i}`);
    if (typeof a?.onClick === "function") refs.callbacks[id] = a.onClick;
    return {
      id,
      label: String(a?.label || "OK"),
      kind: a?.kind ? String(a.kind) : "",
      autoFocus: !!a?.autoFocus,
    };
  });

  deps.state.ui.actionModal = {
    open: true,
    title: String(title || "Confirm"),
    tier: Number(tier || 0) || 0,
    bodyHtml: String(bodyHtml || ""),
    actions: safeActions,
  };

  renderActionModal(deps);
}

export function closeActionModal(deps){
  const refs = ensureActionModal(deps);
  if (!refs?.overlay) return;

  if (deps.state?.ui?.actionModal?.open && refs.modalEl){
    refs.modalEl.classList.remove("open");
    refs.modalEl.classList.add("closing");
  }

  if (actionModalCloseTimer){
    clearTimeout(actionModalCloseTimer);
    actionModalCloseTimer = null;
  }

  actionModalCloseTimer = setTimeout(() => {
    try{ if (deps.state?.ui && typeof deps.state.ui === "object") delete deps.state.ui.actionModal; }catch(_){/* ignore */}
    try{ if (refs?.callbacks) refs.callbacks = Object.create(null); }catch(_){/* ignore */}
    renderActionModal(deps);
    try{
      if (prevBodyOverflow !== null){
        document.body.style.overflow = prevBodyOverflow;
        prevBodyOverflow = null;
      }
    }catch(_){/* ignore */}
  }, 170);
}

function ensureFaintModal(deps){
  if (typeof document === "undefined") return null;

  const existing = document.getElementById("faintModalOverlay");
  if (faintModalRefs?.overlay && existing === faintModalRefs.overlay){
    return faintModalRefs;
  }

  let overlay = existing;
  if (!overlay){
    overlay = document.createElement("div");
    overlay.id = "faintModalOverlay";
    overlay.className = "lootOverlay faintOverlay";
    overlay.hidden = true;

    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "14px";
    overlay.style.zIndex = "12000";
    overlay.style.pointerEvents = "auto";
    overlay.innerHTML = `
      <div class="lootBackdrop" data-faint-backdrop="1"></div>
      <div class="lootModal faintModal" role="dialog" aria-modal="true" aria-labelledby="faintModalTitle">
        <div class="lootHeader">
          <div class="lootHeaderText">
            <div id="faintModalTitle" class="lootTitle">Out of air</div>
            <div class="faintMsg muted"></div>
          </div>
          <button type="button" class="lootCloseBtn" aria-label="Close">×</button>
        </div>
        <div class="lootActions">
          <button type="button" class="faintLeaveBtn">Leave</button>
        </div>
      </div>
    `;

    const host = document.body;
    host.appendChild(overlay);
  } else {
    if (overlay.parentElement !== document.body){
      document.body.appendChild(overlay);
    }

    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.display = overlay.hidden ? "none" : "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "14px";
    overlay.style.zIndex = "12000";
    overlay.style.pointerEvents = "auto";
  }

  if (!overlay.dataset.wired){
    overlay.dataset.wired = "1";

    const leave = () => {
      try { deps.handlers?.onFaintLeave?.(); } catch (_) { /* ignore */ }
      try { if (!deps.state?.ui || typeof deps.state.ui !== "object") deps.state.ui = {}; } catch (_) { /* ignore */ }
      try { deps.state.ui.faintModal = { open:false }; } catch (_) { /* ignore */ }
      try { delete deps.state.ui.faintModal; } catch (_) { /* ignore */ }
      try { delete deps.state.ui.lootModal; } catch (_) { /* ignore */ }
      try { overlay.hidden = true; overlay.style.display = "none"; overlay.classList.remove("open"); } catch (_) { /* ignore */ }
      try { deps.saveGame?.(); } catch (_) { /* ignore */ }
      try { deps.renderAll?.(); } catch (_) { /* ignore */ }
    };

    const onAnyPointer = (e) => {
      if (e.target?.dataset?.faintBackdrop) return leave();
      if (!e.target?.closest?.(".faintModal")) return leave();
    };
    overlay.addEventListener("click", onAnyPointer, true);
    overlay.addEventListener("touchstart", onAnyPointer, true);

    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!deps.state?.ui?.faintModal?.open) return;
      leave();
    });

    overlay.querySelector(".lootCloseBtn")?.addEventListener("click", leave, true);
    overlay.querySelector(".faintLeaveBtn")?.addEventListener("click", leave, true);
  }

  faintModalRefs = faintModalRefs || {};
  faintModalRefs.overlay = overlay;
  faintModalRefs.msgEl = overlay.querySelector(".faintMsg");

  return faintModalRefs;
}

export function renderFaintModal(deps){
  const refs = ensureFaintModal(deps);
  if (!refs?.overlay) return;
  const fm = deps.state?.ui?.faintModal;

  if (!fm?.open){
    refs.overlay.hidden = true;
    refs.overlay.style.display = "none";
    refs.overlay.classList.remove("open");
    if (refs.msgEl) refs.msgEl.textContent = "";
    return;
  }

  refs.overlay.hidden = false;
  refs.overlay.style.display = "flex";
  refs.overlay.classList.add("open");
  if (refs.msgEl){
    refs.msgEl.textContent = fm?.message || "You ran out of air and fainted. You've been taken to a safe place to recover.";
  }
}
