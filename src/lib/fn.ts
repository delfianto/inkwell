/**
 * Wraps `fn` so it runs at most once; later calls are no-ops. Replaces lodash's
 * `once` for fire-once side effects.
 */
export function once<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  let called = false;
  return (...args: A) => {
    if (called) return;
    called = true;
    fn(...args);
  };
}
