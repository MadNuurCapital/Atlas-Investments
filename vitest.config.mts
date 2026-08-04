import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Money and dates are the whole point of this application, so tests run
    // in a fixed timezone. Without this a suite that passes on a laptop in
    // Singapore could fail on a build server in UTC.
    env: { TZ: "Asia/Singapore" },
  },
});
