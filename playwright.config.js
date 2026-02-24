const { defineConfig } = require("@playwright/test");

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";

module.exports = defineConfig({
  testDir: "./tests/ui",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  use: {
    baseURL,
    headless: true
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" }
    }
  ],
  webServer: {
    command: "node tests/ui/static-server.js",
    url: baseURL,
    timeout: 20_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: "4173"
    }
  }
});
