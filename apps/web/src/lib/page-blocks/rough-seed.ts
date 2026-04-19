/**
 * Deterministic seed for Rough.js so each block’s sketch is stable across
 * resizes, re-renders, and reloads (same id → same wobble).
 */
export function stableRoughSeedFromId(id: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
