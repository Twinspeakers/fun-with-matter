// Fun With Matter - Wiki filesystem loader
// Loads wiki/index.json + markdown pages under /wiki/pages.
// The UI layer can fall back to the legacy in-code wiki if this fails.



// Base-aware URL helper (GitHub Pages subpath-safe)
// NOTE: When GH Pages base config regresses (e.g., merge overwrote vite.config.ts),
// import.meta.env.BASE_URL can fall back to '/'. This helper also detects the repo
// subpath at runtime to prevent requests accidentally hitting https://<user>.github.io/wiki/...
function __fwmBase__(){
  const base = (import.meta?.env?.BASE_URL) || "/";
  if (base && base !== "/") return base;

  // Runtime fallback: detect GH Pages project path.
  try {
    const p = window?.location?.pathname || "/";
    if (p.startsWith("/fun-with-matter/")) return "/fun-with-matter/";
  } catch {
    // ignore
  }

  return "/";
}

function __fwmWithBase__(p){
  const s = String(p || "");
  if (!s) return s;
  // Leave absolute URLs / data / blob untouched
  if (/^(?:[a-z]+:)?\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) return s;
  let out = s.replace(/^\.\//, "");
  if (out.startsWith("/")) out = out.slice(1);
  const base = __fwmBase__();
  // Use URL to avoid subtle path concatenation issues.
  return new URL(out, `${window.location.origin}${base}`).toString();
}
let _state = {
  status: "idle", // idle | loading | ready | error
  error: null,
  index: null,
  nav: [],
  pages: [],
  pageMap: new Map(),
  aliases: new Map(),
  pageCache: new Map() // id -> { meta, md }
};

// Prevent infinite retry loops if the FS fails to load (e.g., 404 while deploying).
let _attempted = false;

function buildAliases(){
  // Back-compat with older in-code ids
  const pairs = [
    ["home", "start_reference"],
    ["elements", "items_elements"],
    ["findability_tiers", "systems_tiers"],
    ["lootpool_minions", "systems_minion_loot_pool"],
    ["mu", "systems_general_store"],
    ["gadget_overview", "items_gadgets"],
    // Some common shorthand a writer might use
    ["tiers", "systems_tiers"],
    ["store", "systems_general_store"],
    ["reference", "start_reference"],
    ["gadgets", "items_gadgets"],
    ["minion_loot_pool", "systems_minion_loot_pool"],
  ];
  _state.aliases = new Map(pairs);
}

export function resolveWikiId(id){
  const key = String(id || "").trim();
  if (!key) return "";
  return _state.aliases.get(key) || key;
}

function flattenNav(nav, sectionTitle, parents = []){
  const out = [];
  (nav || []).forEach(node => {
    const id = String(node.id || "").trim();
    const title = String(node.title || id);
    const file = node.file ? String(node.file) : null;
    const children = Array.isArray(node.children) ? node.children : [];
    const row = {
      id,
      title,
      section: sectionTitle,
      file,
      devOnly: !!node.devOnly,
      parents: parents.slice(),
      children: children.map(c => c.id),
      hasChildren: children.length > 0
    };
    out.push(row);
    if (children.length){
      out.push(...flattenNav(children, sectionTitle, [...parents, id]));
    }
  });
  return out;
}

async function loadIndex(){
  const res = await fetch(__fwmWithBase__("wiki/index.json"), { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load wiki/index.json (${res.status})`);
  const json = await res.json();

  _state.index = json;
  _state.nav = Array.isArray(json.nav) ? json.nav : [];

  // Flatten pages
  const flat = [];
  const map = new Map();
  (_state.nav || []).forEach(top => {
    const section = String(top.title || top.id || "Section");
    const nodes = flattenNav(top.children || [], section, []);
    nodes.forEach(n => {
      flat.push(n);
      map.set(n.id, n);
    });
  });
  _state.pages = flat;
  _state.pageMap = map;
}

export function ensureWikiFSLoaded(){
  if (_state.status === "ready" || _state.status === "loading") return _state;
  if (_attempted && _state.status === "error") return _state;
  _attempted = true;
  buildAliases();
  _state.status = "loading";
  _state.error = null;

  loadIndex().then(() => {
    _state.status = "ready";
  }).catch(err => {
    _state.status = "error";
    _state.error = err;
    console.warn("Wiki FS failed; falling back to legacy wiki.", err);
  });

  return _state;
}

export function getWikiFSState(){
  return _state;
}

export function wikiFSGetSections(){
  if (_state.status !== "ready") return ["Start", "Systems", "World", "Items"]; // safe default
  const titles = (_state.nav || []).map(n => String(n.title || n.id)).filter(Boolean);
  // If someone edits index.json, keep pills stable: Start/Systems/World/Items first if present.
  const preferred = ["Start", "Systems", "World", "Items"];
  const out = [];
  preferred.forEach(p => { if (titles.includes(p)) out.push(p); });
  titles.forEach(t => { if (!out.includes(t)) out.push(t); });
  return out;
}

export function wikiFSListPages(){
  return _state.pages || [];
}

export function wikiFSGetPageMeta(id){
  const rid = resolveWikiId(id);
  return _state.pageMap.get(rid) || null;
}

export function wikiFSHas(id){
  const rid = resolveWikiId(id);
  return _state.pageMap.has(rid);
}

function parseFrontmatter(md){
  const text = String(md || "");
  if (!text.startsWith("---")) return { meta: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: text };

  const fmRaw = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\r?\n/, "");
  const meta = {};

  // YAML-ish frontmatter parser
  // Supports:
  // - key: value
  // - key: [a, b]
  // - key:\n  - item\n  - item
  // - booleans: true/false
  const lines = fmRaw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++){
    const line = lines[i];
    const m = line.match(/^\s*([A-Za-z0-9_\-]+)\s*:\s*(.*)\s*$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2] ?? "";

    // Multiline list
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

    // Inline list
    if (v.startsWith("[") && v.endsWith("]")){
      v = v.slice(1, -1).split(",").map(s => s.trim()).filter(Boolean);
      meta[k] = v;
      continue;
    }

    // Booleans
    if (v === "true" || v === "false"){
      meta[k] = (v === "true");
      continue;
    }

    meta[k] = v;
  }

  return { meta, body };
}

export async function wikiFSLoadPage(id){
  const rid = resolveWikiId(id);
  if (_state.pageCache.has(rid)) return _state.pageCache.get(rid);
  const meta = wikiFSGetPageMeta(rid);
  if (!meta?.file) throw new Error(`Wiki page missing file: ${rid}`);

  const res = await fetch(__fwmWithBase__(meta.file), { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${meta.file} (${res.status})`);
  const md = await res.text();
  const { meta: fm, body } = parseFrontmatter(md);
  const pack = {
    id: rid,
    title: meta.title,
    section: meta.section,
    file: meta.file,
    meta: fm,
    raw: md,
    md: body
  };
  _state.pageCache.set(rid, pack);
  return pack;
}
