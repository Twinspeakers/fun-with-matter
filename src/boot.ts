let booted = false;

function showBootError(err: unknown) {
  try {
    const existing = document.getElementById("bootErrorOverlay");
    if (existing) {
      existing.remove();
    }

    const wrap = document.createElement("div");
    wrap.id = "bootErrorOverlay";
    wrap.style.position = "fixed";
    wrap.style.left = "14px";
    wrap.style.right = "14px";
    wrap.style.bottom = "14px";
    wrap.style.zIndex = "99999";
    wrap.style.maxHeight = "50vh";
    wrap.style.overflow = "auto";
    wrap.style.background = "rgba(0,0,0,.88)";
    wrap.style.color = "#fff";
    wrap.style.borderRadius = "12px";
    wrap.style.padding = "12px";
    wrap.style.fontFamily =
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
    wrap.style.fontSize = "12px";
    wrap.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
        <div><span class="label">Boot error</span> (JS failed to start)</div>
        <button id="bootErrorClose" style="padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;cursor:pointer">Close</button>
      </div>
      <pre style="white-space:pre-wrap;margin:10px 0 0">${String(
        (err as Error)?.stack ?? err
      )}</pre>`;
    document.body.appendChild(wrap);
    wrap
      .querySelector("#bootErrorClose")
      ?.addEventListener("click", () => wrap.remove());
  } catch {
    // Ignore boot error UI failures.
  }
}

function initWorldTimeButton() {
  const OVERRIDE_KEYS = ["fwm_tod_override", "todOverride"];
  const ORDER = ["", "dawn", "day", "dusk", "night"];
  const TOD_CLASSES = ["tod-day", "tod-dawn", "tod-dusk", "tod-night"];

  function getOverride() {
    try {
      for (const key of OVERRIDE_KEYS) {
        const value = localStorage.getItem(key);
        if (value && String(value).trim()) {
          return String(value).trim().toLowerCase();
        }
      }
    } catch {
      // Ignore storage errors.
    }
    return "";
  }

  function setOverride(value: string) {
    try {
      for (const key of OVERRIDE_KEYS) {
        if (!value) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, value);
        }
      }
    } catch {
      // Ignore storage errors.
    }
  }

  function computeBand(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 8) return "dawn";
    if (hour >= 8 && hour < 17) return "day";
    if (hour >= 17 && hour < 20) return "dusk";
    return "night";
  }

  function iconFor(mode: string) {
    switch (mode) {
      case "day":
        return "\uD83C\uDF1E";
      case "dawn":
        return "\uD83C\uDF05";
      case "dusk":
        return "\uD83C\uDF06";
      case "night":
        return "\uD83C\uDF19";
      default:
        return "\uD83C\uDF13";
    }
  }

  function labelFor(mode: string) {
    switch (mode) {
      case "day":
        return "Day";
      case "dawn":
        return "Dawn";
      case "dusk":
        return "Dusk";
      case "night":
        return "Night";
      default:
        return "Auto";
    }
  }

  function applyBodyClass(mode: string) {
    const body = document.body;
    if (!body) return;
    TOD_CLASSES.forEach((className) => body.classList.remove(className));
    const resolved = mode || computeBand();
    body.classList.add(`tod-${resolved}`);
    body.dataset.tod = resolved;
  }

  function sync(btn: HTMLButtonElement) {
    const override = getOverride();
    const band = override || computeBand();
    btn.textContent = iconFor(override || "");
    btn.title = override
      ? `World Time: ${labelFor(override)} (override)`
      : `World Time: Auto (currently ${labelFor(band)})`;
    btn.setAttribute("aria-label", btn.title);
  }

  function mount() {
    const btn = document.getElementById("todBtn") as HTMLButtonElement | null;
    if (!btn) return;

    sync(btn);
    setInterval(() => sync(btn), 60_000);

    btn.addEventListener("click", (event) => {
      event.preventDefault();
      const current = getOverride();
      const index = Math.max(0, ORDER.indexOf(current));
      const next = ORDER[(index + 1) % ORDER.length];
      setOverride(next);
      applyBodyClass(next);
      sync(btn);
      try {
        window.dispatchEvent(
          new CustomEvent("fwm:tod-override-changed", {
            detail: { mode: next || null },
          })
        );
      } catch {
        // Ignore event failures.
      }
    });
  }

  requestAnimationFrame(mount);
}

export function boot() {
  if (booted) return;
  booted = true;

  document.body.classList.add("fwm");

  window.addEventListener("error", (event) =>
    showBootError(event.error || event.message || event)
  );
  window.addEventListener("unhandledrejection", (event) =>
    showBootError(event.reason || event)
  );

  initWorldTimeButton();
  import("../js/main.js").catch(showBootError);
}
