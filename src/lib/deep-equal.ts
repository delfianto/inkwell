/**
 * Structural deep-equality for JSON-like values (primitives, arrays, and plain
 * objects) — the shape Inkwell's project/scene data takes. Replaces lodash's
 * `isEqual` for store-sync change detection. Does not handle Map/Set/Date or
 * other exotic types, which this data never contains.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // Treat NaN as equal to itself, matching lodash `isEqual`.
  if (typeof a === "number" && Number.isNaN(a) && typeof b === "number" && Number.isNaN(b)) {
    return true;
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }

  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;

  if (aIsArray) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    return arrA.every((value, index) => deepEqual(value, arrB[index]));
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => Object.hasOwn(objB, key) && deepEqual(objA[key], objB[key]));
}
