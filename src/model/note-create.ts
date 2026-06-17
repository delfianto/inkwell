import type { App, TFile } from "obsidian";

/**
 * Creates a note at `path` with a given `template` if a templating plugin is enabled.
 * Prefers Templater, then the core Templates plugin, then a plain note without using the template.
 * @param path Path to note to create.
 * @param template Path to template to use.
 *
 * @returns `null` if it fails to create the note.  `TFile` for the new note, if successful.
 */
export async function createNoteWithPotentialTemplate(
  app: App,
  path: string,
  template: string | null,
): Promise<TFile | null> {
  const file = await createNote(app, path);
  if (!file) return null;
  if (template) {
    let contents: string | null = null;
    let pluginUsed = "";
    try {
      if (isTemplaterEnabled(app)) {
        pluginUsed = "Templater";
        contents = await createWithTemplater(app, file, template);
      } else if (isTemplatesEnabled(app)) {
        pluginUsed = "Core Templates";
        contents = await createWithTemplates(app, template);
      }
    } catch (error) {
      console.error(`[Inkwell] Error using plugin [${pluginUsed}]:`, error);
    }
    if (contents) {
      await app.vault.adapter.write(path, contents);
    }
  }
  return file;
}

/**
 * Creates a note at `path` with the given `initialContent`.
 * @param path
 * @param initialContent
 * @returns `null` if it fails to create the note.  `TFile` for the new note, if successful.
 */
export async function createNote(
  app: App,
  path: string,
  initialContent = "",
): Promise<TFile | null> {
  const pathComponents = path.split("/");
  pathComponents.pop();

  if (!(await app.vault.adapter.exists(pathComponents.join("/")))) {
    try {
      await app.vault.createFolder(pathComponents.join("/"));
    } catch (e) {
      console.error(`[Inkwell] Failed to create new note at "${path}"`, e);
      return null;
    }
  }

  try {
    // as of obsidian 1.4.4, vault.create will successfully create a file, and
    // its parent folder, but will throw an error anyway, if the parent folder
    // didn't initially exist.  By creating the parent folder above, we avoid
    // that situation.  This may change in later versions of obsidian.
    return await app.vault.create(path, initialContent);
  } catch (e: unknown) {
    console.error(`[Inkwell] Failed to create new note at "${path}"`, e);
    return null;
  }
}

function isTemplaterEnabled(app: App): boolean {
  return !!app.plugins.getPlugin("templater-obsidian");
}

function isTemplatesEnabled(app: App): boolean {
  return !!app.internalPlugins.getEnabledPluginById("templates");
}

async function createWithTemplater(
  app: App,
  file: TFile,
  templatePath: string,
): Promise<string | null> {
  const templaterPlugin = app.plugins.getPlugin("templater-obsidian");
  if (!templaterPlugin) {
    console.error("[Inkwell] Attempted to use Templater plugin while disabled.");
    return null;
  }
  const template = app.vault.getAbstractFileByPath(templatePath);

  const runningConfig = templaterPlugin.templater.create_running_config(template, file, 0);
  return await templaterPlugin.templater.read_and_parse_template(runningConfig);
}

async function createWithTemplates(app: App, templatePath: string): Promise<string | null> {
  const corePlugin = app.internalPlugins.getEnabledPluginById("templates");
  if (!corePlugin) {
    console.error("[Inkwell] Attempted to use core template plugin while disabled.");
    return null;
  }
  // Get template body
  let contents = await app.vault.adapter.read(templatePath);

  // Replace {{date}} and {{time}}
  const dateFormat = corePlugin.options["dateFormat"] || "YYYY-MM-DD";
  const timeFormat = corePlugin.options["timeFormat"] || "HH:mm";

  contents = contents.replace(`{{date}}`, window.moment().format(dateFormat));
  contents = contents.replace(`{{time}}`, window.moment().format(timeFormat));

  return contents;
}
