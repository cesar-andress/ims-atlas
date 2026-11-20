import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    // The UI defaults to Spanish; the English assertions in these specs opt in via the
    // saved language preference (the same key the ES/EN switch writes). Specs that test
    // the default or the switch override storageState.
    storageState: {
      cookies: [],
      origins: [
        { origin: baseURL, localStorage: [{ name: "ims-atlas.lang", value: "en" }] },
      ],
    },
  },
  webServer: {
    command: "pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
