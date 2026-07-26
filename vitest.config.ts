import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts", "tests/controllers/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/helpers/testDb.ts"],
          poolOptions: { forks: { singleFork: true } },
          hookTimeout: 120_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
