import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import builtins from "builtin-modules";
import path from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// vite build always sets NODE_ENV=production, so use --watch presence to detect dev mode.
// Dev (watch): rebuilds into a live Obsidian plugins/inkwell/ directory so changes
//   land in the vault immediately. Prefers $PLUGINS_DIR (typically set via direnv
//   from .envrc — see .envrc.example) and falls back to the in-repo test vault.
// Prod: outputs to ./dist next to main.js + styles.css + a freshly-copied manifest.json,
//   ready to be zipped as a release artifact.
const isWatch = process.argv.includes("--watch");

function devOutDir(): string {
  const pluginsDir = process.env.PLUGINS_DIR?.trim();
  if (pluginsDir) {
    return path.join(pluginsDir, "inkwell");
  }
  return "test-vault-inkwell/.obsidian/plugins/inkwell";
}

const outDir = isWatch ? devOutDir() : "dist";

// Copy manifest.json alongside main.js / styles.css after every build so the
// output directory is a complete, loadable plugin. In watch mode this means
// the live vault (or the test vault fallback) stays loadable after every
// rebuild without manual intervention.
function copyManifest(): Plugin {
  return {
    name: "copy-manifest",
    apply: "build",
    closeBundle() {
      const src = path.resolve("manifest.json");
      const dest = path.resolve(outDir, "manifest.json");
      if (!existsSync(path.dirname(dest))) {
        mkdirSync(path.dirname(dest), { recursive: true });
      }
      copyFileSync(src, dest);
      if (isWatch) {
        console.log(`[inkwell] Deployed to ${outDir}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [svelte(), copyManifest()],

  resolve: {
    alias: {
      // Source files use `src/...` as bare imports (no leading ./)
      src: path.resolve("./src"),
    },
  },

  build: {
    lib: {
      entry: "src/main.ts",
      formats: ["cjs"],
      fileName: () => "main.js",
    },
    rollupOptions: {
      external: [
        "obsidian",
        "electron",
        "@codemirror/autocomplete",
        "@codemirror/collab",
        "@codemirror/commands",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/search",
        "@codemirror/state",
        "@codemirror/view",
        "@lezer/common",
        "@lezer/highlight",
        "@lezer/lr",
        ...builtins,
      ],
      output: {
        entryFileNames: "main.js",
        assetFileNames: (info) =>
          info.name?.endsWith(".css") ? "styles.css" : (info.name ?? "asset"),
      },
    },
    outDir,
    emptyOutDir: !isWatch,
    sourcemap: isWatch ? "inline" : false,
    minify: !isWatch,
    copyPublicDir: false,
  },
});
