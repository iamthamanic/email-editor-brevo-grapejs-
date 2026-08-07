/**
 * Shared id helper for normalized blocks/sections.
 * Location: packages/legacy-importer/src/ids.ts
 */

let seq = 0;

export function resetIds(): void {
  seq = 0;
}

export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}
