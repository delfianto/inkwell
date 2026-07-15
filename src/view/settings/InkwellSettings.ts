import { type App, PluginSettingTab, Setting } from "obsidian";
import { get, type Unsubscriber } from "svelte/store";
import { pluginSettings, userScriptSteps } from "src/model/stores";
import { FileSuggest } from "./file-suggest";
import type InkwellPlugin from "../../main";

export class InkwellSettingsTab extends PluginSettingTab {
  plugin: InkwellPlugin;
  private unsubscribers: Unsubscriber[] = [];
  private stepsSummary!: HTMLElement;
  private stepsList!: HTMLUListElement;

  constructor(app: App, plugin: InkwellPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  override display(): void {
    const settings = get(pluginSettings);

    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl).setName("Composition").setHeading();
    new Setting(containerEl).setName("New scene template").addSearch((search) => {
      new FileSuggest(this.app, search.inputEl);
      search
        .setPlaceholder("templates/Scene.md")
        .setValue(settings.sceneTemplate ?? "")
        .onChange((v) => {
          pluginSettings.update((s) => ({
            ...s,
            sceneTemplate: v,
          }));
        });
    });
    containerEl.createEl("p", { cls: "setting-item-description" }, (el) => {
      el.innerHTML =
        "This file will be used as a template when creating new scenes via the New Scene… field. If you use a templating plugin (Templater or the core plugin) it will be used to process this template. This setting applies to all projects and can be overridden per-project in the Project > Project Metadata settings in the Inkwell pane.";
    });

    new Setting(containerEl)
      .setName("Show scene numbers in Scenes tab")
      .setDesc(
        "If on, shows numbers for scenes with subscenes separated by periods, e.g. 1.1.2. Create subscenes by dragging a scene to an indent under an existing scene, or us an indent command.",
      )
      .addToggle((toggle) => {
        toggle.setValue(settings.numberScenes);
        toggle.onChange((value) => {
          pluginSettings.update((s) => ({
            ...s,
            numberScenes: value,
          }));
        });
      });

    new Setting(containerEl).setName("Compile").setHeading();

    this.stepsSummary = containerEl.createSpan();
    this.stepsList = containerEl.createEl("ul", {
      cls: "inkwell-settings-user-steps",
    });
    this.unsubscribers.push(
      userScriptSteps.subscribe((steps) => {
        this.stepsSummary.textContent =
          steps && steps.length > 0
            ? `Loaded ${steps.length} step${steps.length === 1 ? "" : "s"}:`
            : "No steps loaded.";
        if (this.stepsList) {
          this.stepsList.empty();
          if (steps) {
            steps.forEach((s) => {
              const stepEl = this.stepsList.createEl("li");
              stepEl.createSpan({
                text: s.description.name,
                cls: "inkwell-settings-user-step-name",
              });
              stepEl.createSpan({
                text: `(${s.description.canonicalID})`,
                cls: "inkwell-settings-user-step-id",
              });
            });
          }
        }
      }),
    );
    containerEl.createEl("p", { cls: "setting-item-description" }, (el) => {
      el.innerHTML =
        "User Script Steps are loaded from <code>&lt;vault&gt;/.obsidian/inkwell/*.js</code>. Changes are picked up automatically after a short debounce. If your script does not appear here or in the Compile tab, you may have an error in your script — check the dev console.";
    });

    new Setting(containerEl).setName("Troubleshooting").setHeading();

    new Setting(containerEl)
      .setName("Wait for Obsidian Sync")
      .setDesc(
        "Prevent Inkwell from running until Obsidian Sync completes its first sync. If you are using Sync, you may want to enable this if you experience issues with scenes disappearing or falsely being shown as new.",
      )
      .addToggle((toggle) => {
        toggle.setValue(settings.waitForSync);
        toggle.onChange((value) => {
          pluginSettings.update((s) => ({
            ...s,
            waitForSync: value,
          }));
        });
      });

    new Setting(containerEl)
      .setName("Enable fallback wait")
      .setDesc(
        "If sync status cannot be detected, wait for the time specified below before looking for scenes.",
      )
      .addToggle((toggle) => {
        toggle.setValue(settings.fallbackWaitEnabled);
        toggle.onChange((value) => {
          pluginSettings.update((s) => ({
            ...s,
            fallbackWaitEnabled: value,
          }));
        });
      });

    new Setting(containerEl)
      .setName("Fallback wait time")
      .setDesc("Time to wait in seconds if sync status cannot be detected.")
      .addText((text) => {
        text.setValue(settings.fallbackWaitTime.toString());
        text.onChange((value) => {
          const numberValue = Math.trunc(Number(value));
          if (!isNaN(numberValue) && numberValue > 0) {
            pluginSettings.update((s) => ({
              ...s,
              fallbackWaitTime: numberValue,
            }));
          }
        });
      });

    new Setting(containerEl).setName("Credits").setHeading();

    containerEl.createEl("p", {}, (el) => {
      el.innerHTML =
        'Inkwell by <a href="https://github.com/delfianto">Dwi Elfianto</a>, based on <a href="https://github.com/kevboh/longform">Longform</a> by Kevin Barrett.';
    });
    containerEl.createEl("p", {}, (el) => {
      el.innerHTML =
        'Read the source code and report issues at <a href="https://github.com/delfianto/inkwell">https://github.com/delfianto/inkwell</a>.';
    });
    containerEl.createEl("p", {}, (el) => {
      el.innerHTML =
        'Icon made by <a href="https://www.flaticon.com/authors/zlatko-najdenovski" title="Zlatko Najdenovski">Zlatko Najdenovski</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a>.';
    });
  }

  override hide(): void {
    this.unsubscribers.forEach((u) => u());
  }
}
