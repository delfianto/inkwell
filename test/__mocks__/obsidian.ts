// Minimal stub of the obsidian runtime API for use in vitest.
// Only the symbols imported by code-under-test need to exist; nothing more.
// If a test ever invokes one of these, we want a loud failure rather than a
// silent no-op, hence the throw.

const notImplemented = (name: string) => () => {
  throw new Error(`[obsidian mock] ${name} is not implemented for unit tests`);
};

export class App {}
export class TFile {}
export class Vault {}
export class TFolder {}
export class TAbstractFile {}
export class Plugin {}
export class PluginSettingTab {}
export class Modal {}
export class FileView {}
export class WorkspaceLeaf {}
export class Notice {
  constructor(_message: string) {}
}
export const normalizePath = (p: string) => p.replaceAll(/\/+/gu, "/").replace(/^\/+/u, "");
export const addIcon = notImplemented("addIcon");
export const Keymap = {
  isModEvent: notImplemented("Keymap.isModEvent"),
};
export const Platform = {
  isMobile: false,
  isMobileApp: false,
};
