import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: ["src/state/projectLibrary.ts", "src/state/projectTeamApi.ts"],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
      },
    },
  },
});
