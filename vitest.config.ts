import { defineConfig } from "vite-plus";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      src: path.resolve("./src"),
      // `obsidian` ships only as a runtime module loaded by Obsidian itself;
      // unit tests stub it so files that pull in TFile/Vault/etc can still load.
      obsidian: path.resolve("./test/__mocks__/obsidian.ts"),
    },
  },
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    globals: true,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
