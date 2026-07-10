// Ambient declarations for the runtime environment (Vite bundling + the
// Obsidian/Electron desktop runtime) that aren't part of the standard TS lib.
//
// This file is intentionally a global script (no imports/exports) so the
// declarations register globally rather than as module-scoped augmentations.

// styles.css is bundled by Vite as a side effect; tsc only needs to know the
// module exists. TypeScript 7 flags an untyped side-effect import otherwise.
declare module "*.css";

// The Obsidian desktop app runs on Electron, which exposes Node's require() on
// the global window. Used by the user-script loader to sandbox user modules.
interface Window {
  require?: (module: string) => unknown;
}
