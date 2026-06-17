import type { Command } from "obsidian";

import type InkwellPlugin from "src/main";

export type CommandBuilder = (plugin: InkwellPlugin) => Command;
