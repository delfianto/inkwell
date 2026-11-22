import { normalizePath, type Vault } from "obsidian";

export function fileNameFromPath(path: string): string {
  return (path.split("/").at(-1) ?? "").split(".md")[0];
}

export function vaultParentPath(path: string): string {
  return path.slice(0, Math.max(0, path.lastIndexOf("/"))) || "/";
}

/** Resolve a path from a vault directory without permitting traversal above the vault root. */
export function resolveRelativeVaultPath(directory: string, path: string): string | null {
  const segments = directory.split("/").filter(Boolean);
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(part);
    }
  }
  return segments.join("/") || "/";
}

export function relativeVaultPath(directory: string, target: string): string {
  const from = directory.split("/").filter(Boolean);
  const to = target.split("/").filter(Boolean);
  let common = 0;
  while (common < from.length && common < to.length && from[common] === to[common]) {
    common += 1;
  }
  return [...from.slice(common).map(() => ".."), ...to.slice(common)].join("/") || ".";
}

/**
 * Vault-relative directory where Inkwell stores plugin data —
 * `workflows.json` and user compile-step `*.js` files both live here.
 */
export function inkwellDataDir(vault: Vault): string {
  return normalizePath(`${vault.configDir}/inkwell`);
}
