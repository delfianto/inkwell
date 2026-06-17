import { last } from "lodash";
import { normalizePath, type Vault } from "obsidian";

export function fileNameFromPath(path: string): string {
  return last(path.split("/")).split(".md")[0];
}

/**
 * Vault-relative directory where Inkwell stores plugin data —
 * `workflows.json` and user compile-step `*.js` files both live here.
 */
export function inkwellDataDir(vault: Vault): string {
  return normalizePath(`${vault.configDir}/inkwell`);
}
