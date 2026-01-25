// Fun With Matter - Dev Story Overrides (dev-only)
//
// Lets you write a scene as plain text/markdown in the Wiki, then preview it
// inside the Story frame *without* touching canonical story nodes.
//
// Storage key: fwm_dev_scene:<nodeId>
//
// Draft parsing rules (simple + forgiving):
// - Lines like "Name: dialogue" become {speaker:"Name", text:"dialogue"}
// - Lines without "Name:" become narrator lines (speaker null)
// - Optional meta directives (single line):
//    ::chapter=Monster Brawl
//    ::bg=./assets/...png
//    ::cg=./assets/...png
//

import { isDevMode } from "./devMode.js";

const KEY_PREFIX = "fwm_dev_scene:";

export function devSceneKey(nodeId){
  return `${KEY_PREFIX}${String(nodeId || "").trim()}`;
}

export function hasDevStoryOverride(nodeId){
  if (!isDevMode()) return false;
  try{
    const k = devSceneKey(nodeId);
    return !!localStorage.getItem(k);
  }catch(_){
    return false;
  }
}

export function saveDevStoryOverride(nodeId, md){
  if (!isDevMode()) return { ok:false, reason:"dev_off" };
  const id = String(nodeId || "").trim();
  if (!id) return { ok:false, reason:"missing_id" };
  try{
    localStorage.setItem(devSceneKey(id), String(md ?? ""));
    return { ok:true };
  }catch(e){
    return { ok:false, reason:String(e?.message || e) };
  }
}

export function clearDevStoryOverride(nodeId){
  if (!isDevMode()) return { ok:false, reason:"dev_off" };
  try{
    localStorage.removeItem(devSceneKey(nodeId));
    return { ok:true };
  }catch(e){
    return { ok:false, reason:String(e?.message || e) };
  }
}

export function getDevStoryNode(nodeId){
  if (!isDevMode()) return null;
  const id = String(nodeId || "").trim();
  if (!id) return null;

  let md = "";
  try{
    md = localStorage.getItem(devSceneKey(id)) || "";
  }catch(_){
    md = "";
  }
  if (!md) return null;

  const parsed = parseDraftToNode(md);
  return {
    // Must mimic the shape of a regular node as used by legacyRenderer
    id,
    chapter: parsed.chapter || "DEV DRAFT",
    speaker: null,
    beats: parsed.beats,
    text: parsed.beats && parsed.beats.length ? parsed.beats : parsed.text,
    bg: parsed.bg || null,
    cg: parsed.cg || null,
    chars: parsed.chars || [],
    // No choices yet; can be expanded later.
    choices: [],
  };
}

function parseDraftToNode(md){
  let text = String(md || "").replace(/\r/g, "");
  // Strip YAML frontmatter if present.
  if (text.startsWith("---\n")){
    const end = text.indexOf("\n---", 4);
    if (end !== -1){
      const after = text.indexOf("\n", end + 1);
      text = after !== -1 ? text.slice(after + 1) : "";
    }
  }
  const lines = text.split("\n");

  let chapter = "";
  let bg = "";
  let cg = "";

  const beats = [];

  const pushLine = (speaker, text) => {
    const t = String(text ?? "").trim();
    if (!t) return;
    let sp = speaker ? String(speaker).trim() : null;
    if (sp && sp.toLowerCase() === "narrator") sp = null;
    beats.push({ speaker: sp, text: t });
  };

  for (const raw of lines){
    const line = String(raw ?? "").trimEnd();
    const t = line.trim();
    if (!t) continue;

    // Meta directives
    if (t.startsWith("::")){
      const m = t.slice(2).match(/^([a-zA-Z0-9_-]+)\s*=\s*(.+)$/);
      if (m){
        const k = m[1].toLowerCase();
        const v = String(m[2] || "").trim();
        if (k === "chapter") chapter = v;
        if (k === "bg") bg = v;
        if (k === "cg") cg = v;
      }
      continue;
    }

    // Dialogue: Name: text
    const d = t.match(/^([^:]{1,40}):\s+(.+)$/);
    if (d){
      const speaker = d[1];
      const text = d[2];
      pushLine(speaker, text);
      continue;
    }

    // Narrator line
    pushLine(null, t);
  }

  return { chapter, bg, cg, beats, text: beats.map(b => b.text).join("\n") };
}
