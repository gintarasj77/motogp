const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const validDataPath = path.resolve(__dirname, "..", "..", "data.json");
const validDataText = fs.readFileSync(validDataPath, "utf8");
const validData = JSON.parse(validDataText);
const expectedHeading = Number.isInteger(validData.season) && validData.season > 0
  ? `${validData.season} Season Dashboard`
  : "Season Dashboard";
const expectedTimezoneLabel = typeof validData.timezoneLabel === "string" && validData.timezoneLabel.trim()
  ? validData.timezoneLabel.trim()
  : validData.timezone;
const expectedLastUpdated = new Intl.DateTimeFormat("en-GB", {
  timeZone: validData.timezone,
  day: "2-digit",
  month: "short",
  year: "numeric"
}).format(new Date(validData.lastUpdated));

function invalidDataPayload() {
  return JSON.stringify({
    timezone: "Europe/Vilnius",
    lastUpdated: "2026-02-24",
    races: []
  });
}

test("renders dashboard from valid data", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: expectedHeading })).toBeVisible();
  await expect(page.getByText(`Last updated: ${expectedLastUpdated}`)).toBeVisible();
  await expect(page.getByText(`All times in ${expectedTimezoneLabel}`)).toBeVisible();
  await expect(page.locator("#error-panel")).toBeHidden();
  await expect(page.locator(".race-item").first()).toBeVisible();
});

test("shows error panel when data.json is invalid", async ({ page }) => {
  await page.route("**/data.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: invalidDataPayload()
    });
  });

  await page.goto("/");

  await expect(page.locator("#error-panel")).toBeVisible();
  await expect(page.locator("#error-message")).toContainText("data.json.races must be a non-empty array");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("retry recovers after data becomes valid", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/data.json", async (route) => {
    requestCount += 1;
    const body = requestCount === 1 ? invalidDataPayload() : validDataText;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body
    });
  });

  await page.goto("/");

  const errorPanel = page.locator("#error-panel");
  await expect(errorPanel).toBeVisible();

  await page.getByRole("button", { name: "Retry" }).click();

  await expect(errorPanel).toBeHidden();
  await expect(page.getByRole("heading", { name: expectedHeading })).toBeVisible();
  await expect(page.locator(".race-item").first()).toBeVisible();
  await expect.poll(() => requestCount).toBeGreaterThanOrEqual(2);
});
