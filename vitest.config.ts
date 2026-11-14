import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Every story is rendered headless in Chromium and checked with axe (research R9).
export default defineConfig({
  test: {
    projects: [
      // Plain unit tests: no browser, no story. The token contrast checks live here, because a
      // ratio is a number, not a rendered page — and because `storybookTest` narrows `include` to
      // story files, so without this project a `.test.ts` would be collected by nothing.
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      // Once per theme, so axe checks contrast in both.
      ...(["dark", "light"] as const).map((theme) => ({
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
            initialGlobals: { theme },
          }),
        ],
        test: {
          name: theme,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" as const }],
          },
        },
      })),
    ],
  },
});
