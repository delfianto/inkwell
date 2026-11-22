import { type App, normalizePath, PluginSettingTab, Setting, TFile, TFolder } from "obsidian";
import {
  CHAPTER_TEMPLATE_PATH,
  prepareChapterTemplate,
  TEMPLATES_FOLDER,
} from "src/model/chapter-template";
import { get, type Unsubscriber } from "svelte/store";
import { pluginSettings, userScriptSteps } from "src/model/stores";
import { FileSuggest } from "./file-suggest";
import type InkwellPlugin from "../../main";
import { ProjectFolderPicker } from "../modals/ProjectFolderPicker";

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

    const writingFolder = new Setting(containerEl).setName("Writing projects folder");
    const setFolderDescription = (path: string | null) => {
      const folder =
        path === "/"
          ? this.app.vault.getRoot()
          : path && this.app.vault.getAbstractFileByPath(path);
      if (!path) {
        writingFolder.setDesc("Choose a default folder for new projects.");
      } else if (folder instanceof TFolder) {
        writingFolder.setDesc(
          `New projects go in ${path === "/" ? "the vault root" : path} by default.`,
        );
      } else {
        writingFolder.setDesc(`${path} is missing. Choose a new folder to set a default.`);
      }
    };
    const setFolder = (path: string | null) => {
      pluginSettings.update((current) => ({ ...current, writingProjectsFolder: path }));
      setFolderDescription(path);
    };
    setFolderDescription(settings.writingProjectsFolder);
    writingFolder
      .addButton((button) =>
        button.setButtonText("Choose folder").onClick(() => {
          new ProjectFolderPicker(this.app, (folder) =>
            setFolder(folder.isRoot() ? "/" : folder.path),
          ).open();
        }),
      )
      .addButton((button) => button.setButtonText("Clear").onClick(() => setFolder(null)));

    new Setting(containerEl).setName("Composition").setHeading();
    this.addSceneTemplateSetting(containerEl);

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

  private addSceneTemplateSetting(container: HTMLElement): void {
    const description =
      "Default for new scenes. Template notes live in the vault’s Templates folder.";
    const setting = new Setting(container).setName("Scene template").setDesc(description);
    setting.addSearch((search) => {
      const suggest = new FileSuggest(this.app, search.inputEl, TEMPLATES_FOLDER);
      this.unsubscribers.push(() => suggest.close());
      search
        .setPlaceholder(CHAPTER_TEMPLATE_PATH)
        .setValue(get(pluginSettings).sceneTemplate ?? "");

      const setTemplate = (path: string | null) => {
        pluginSettings.update((current) => ({ ...current, sceneTemplate: path }));
        search.setValue(path ?? "");
        setting.setDesc(description);
      };
      search.inputEl.addEventListener("blur", () => {
        const value = search.getValue().trim();
        if (value === (get(pluginSettings).sceneTemplate ?? "")) {
          setting.setDesc(description);
          return;
        }
        const path = value ? normalizePath(value) : null;
        if (
          path &&
          (!path.startsWith(`${TEMPLATES_FOLDER}/`) ||
            !(this.app.vault.getAbstractFileByPath(path) instanceof TFile) ||
            !path.endsWith(".md"))
        ) {
          setting.setDesc("Choose an existing Markdown note in Templates, or clear the field.");
          return;
        }
        setTemplate(path);
      });
      setting.addButton((button) =>
        button.setButtonText("Use Chapter preset").onClick(async () => {
          button.setDisabled(true);
          try {
            setTemplate(await prepareChapterTemplate(this.app));
          } catch (error) {
            console.error("[Inkwell] Could not set up Chapter template", error);
            setting.setDesc("Could not create the Chapter preset. Check the Templates folder.");
          } finally {
            button.setDisabled(false);
          }
        }),
      );
      setting.addExtraButton((button) =>
        button
          .setIcon("pencil")
          .setTooltip("Edit scene template")
          .onClick(() => {
            const path = get(pluginSettings).sceneTemplate;
            if (path && this.app.vault.getAbstractFileByPath(path) instanceof TFile) {
              void this.app.workspace.openLinkText(path, "/", false);
            } else {
              setting.setDesc("Choose a scene template to edit.");
            }
          }),
      );
    });
  }

  override hide(): void {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
  }
}
