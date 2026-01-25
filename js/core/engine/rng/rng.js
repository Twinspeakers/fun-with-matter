
export function sampleGeometricTruncated(mean, max) {
  const p = 1 / mean;
  let k = 1;
  while (Math.random() > p && k < max) k++;
  return k;
}

export function sampleChunk(maxChunk, remaining) {
  return 1 + Math.floor(Math.random() * Math.min(maxChunk, remaining));
}

export function formatTimeMs(ms){
  const s = Math.max(0, Math.ceil(ms/1000));
  const m = Math.floor(s/60);
  const r = s%60;
  if (m<=0) return `${r}s`;
  return `${m}m ${String(r).padStart(2,"0")}s`;
}
