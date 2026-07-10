import { normalizePath, type Vault } from "obsidian";

export function fileNameFromPath(path: string): string {
  return (path.split("/").at(-1) ?? "").split(".md")[0];
}

/**
 * Vault-relative directory where Inkwell stores plugin data —
 * `workflows.json` and user compile-step `*.js` files both live here.
 */
export function inkwellDataDir(vault: Vault): string {
  return normalizePath(`${vault.configDir}/inkwell`);
}
