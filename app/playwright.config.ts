import { defineConfig, devices } from "@playwright/test";

const liveBase = process.env.ATLAS_E2E_BASE_URL?.replace(/\/$/, "");
const port = 4173;
const localBase = `http://127.0.0.1:${port}`;
const baseURL = liveBase || localBase;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    // Local preview defaults to English via saved preference. Live host keeps
    // the app default (Spanish) — do not inject localhost storageState there.
    storageState: liveBase
      ? { cookies: [], origins: [] }
      : {
          cookies: [],
          origins: [
            {
              origin: localBase,
              localStorage: [{ name: "ims-atlas.lang", value: "en" }],
            },
          ],
        },
  },
  ...(liveBase
    ? {}
    : {
        webServer: {
          command: "pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort",
          url: localBase,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
