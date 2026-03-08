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
const DEFAULT_SEASON_TAG = "MotoGP Season - Local Time";
const DEFAULT_SEASON_HEADING = "Season Dashboard";
const DEFAULT_CALENDAR_TIMEZONE = "All times local";

function invalidDataPayload() {
  return JSON.stringify({
    timezone: "Europe/Vilnius",
    races: []
  });
}

async function routeData(page, data) {
  await page.route("**/data.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data)
    });
  });
}

test("renders dashboard from valid data", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: expectedHeading })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Remaining Rounds" })).toBeVisible();
  await expect(page.getByText(`All times in ${expectedTimezoneLabel}`)).toBeVisible();
  await expect(page.locator("#error-panel")).toBeHidden();
  await expect(page.locator("#last-updated")).toHaveCount(0);
  await expect(page.locator(".race-item").first()).toBeVisible();
});

test("theme toggle persists across reloads", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
});

test("announces race state changes for assistive technology", async ({ page }) => {
  const transitionData = {
    season: 2026,
    timezone: "Europe/Vilnius",
    timezoneLabel: "LT (EET/EEST)",
    defaultRaceDurationMinutes: 120,
    races: [
      {
        round: 1,
        grandPrix: "Timing GP",
        startIso: "2026-03-01T10:00:00+02:00",
        location: "Buriram",
        circuit: "Timing Circuit"
      },
      {
        round: 2,
        grandPrix: "Next GP",
        startIso: "2026-03-01T14:00:00+02:00",
        location: "Austin",
        circuit: "Next Circuit"
      }
    ]
  };

  await page.clock.install({ time: new Date("2026-03-01T09:59:58+02:00") });
  await routeData(page, transitionData);
  await page.goto("/");

  await expect(page.locator("#status-message")).toHaveText("Timing GP is next on 01 Mar 2026 at 10:00.");

  await page.clock.runFor(3000);

  await expect(page.locator("#status-message")).toHaveText("Timing GP is underway.");
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
  await expect(page.locator(".race-item")).toHaveCount(0);
  await expect(page.locator("#completed")).toHaveText("0");
  await expect(page.locator("#remaining")).toHaveText("0");
  await expect(page.locator("#total")).toHaveText("0");
  await expect(page.locator("#season-heading")).toHaveText(DEFAULT_SEASON_HEADING);
  await expect(page.locator("#season-tag")).toHaveText(DEFAULT_SEASON_TAG);
  await expect(page.locator("#calendar-timezone")).toHaveText(DEFAULT_CALENDAR_TIMEZONE);
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("shows a load error when data.json returns a non-ok response", async ({ page }) => {
  await page.route("**/data.json", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "text/plain; charset=utf-8",
      body: "Not Found"
    });
  });

  await page.goto("/");

  await expect(page.locator("#error-panel")).toBeVisible();
  await expect(page.locator("#error-message")).toContainText("Failed to load data.json: 404");
  await expect(page.locator("#status-message")).toHaveText("Unable to load season data.");
  await expect(page.locator(".race-item")).toHaveCount(0);
});

test("shows a load error when fetching data.json fails", async ({ page }) => {
  await page.route("**/data.json", async (route) => {
    await route.abort("failed");
  });

  await page.goto("/");

  await expect(page.locator("#error-panel")).toBeVisible();
  await expect(page.locator("#error-message")).toContainText(
    "Failed to fetch data.json. Serve the project over HTTP instead of file://."
  );
  await expect(page.locator("#status-message")).toHaveText("Unable to load season data.");
  await expect(page.locator(".race-item")).toHaveCount(0);
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

test("manual reload clears stale stats when a later fetch is invalid", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/data.json", async (route) => {
    requestCount += 1;
    const body = requestCount === 1 ? validDataText : invalidDataPayload();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body
    });
  });

  await page.goto("/");
  await expect(page.locator(".race-item").first()).toBeVisible();

  await page.evaluate(() => {
    const retry = document.getElementById("error-retry");
    if (retry) {
      retry.click();
    }
  });

  await expect.poll(() => requestCount).toBeGreaterThanOrEqual(2);
  await expect(page.locator("#error-panel")).toBeVisible();
  await expect(page.locator(".race-item")).toHaveCount(0);
  await expect(page.locator("#completed")).toHaveText("0");
  await expect(page.locator("#remaining")).toHaveText("0");
  await expect(page.locator("#total")).toHaveText("0");
  await expect(page.locator("#season-heading")).toHaveText(DEFAULT_SEASON_HEADING);
  await expect(page.locator("#season-tag")).toHaveText(DEFAULT_SEASON_TAG);
  await expect(page.locator("#calendar-timezone")).toHaveText(DEFAULT_CALENDAR_TIMEZONE);
});

test("hides finished rounds from the calendar while keeping current and future rounds", async ({ page }) => {
  const filteredCalendarData = {
    season: 2026,
    timezone: "Europe/Vilnius",
    timezoneLabel: "LT (EET/EEST)",
    defaultRaceDurationMinutes: 120,
    races: [
      {
        round: 1,
        grandPrix: "Past GP",
        startIso: "2026-03-01T07:00:00+02:00",
        location: "Buriram",
        circuit: "Past Circuit"
      },
      {
        round: 2,
        grandPrix: "Live GP",
        startIso: "2026-03-01T10:00:00+02:00",
        location: "Austin",
        circuit: "Live Circuit"
      },
      {
        round: 3,
        grandPrix: "Future GP",
        startIso: "2026-03-01T14:00:00+02:00",
        location: "Lusail",
        circuit: "Future Circuit"
      }
    ]
  };

  await page.clock.install({ time: new Date("2026-03-01T10:30:00+02:00") });
  await routeData(page, filteredCalendarData);
  await page.goto("/");

  await expect(page.locator(".race-item")).toHaveCount(2);
  await expect(page.locator(".race-item .race-name")).toHaveText(["Live GP", "Future GP"]);
  await expect(page.locator(".race-item.underway")).toHaveCount(1);
  await expect(page.locator("#calendar-empty")).toBeHidden();
});

test("switches the next race card to live state as soon as the race starts", async ({ page }) => {
  const transitionData = {
    season: 2026,
    timezone: "Europe/Vilnius",
    timezoneLabel: "LT (EET/EEST)",
    defaultRaceDurationMinutes: 120,
    races: [
      {
        round: 1,
        grandPrix: "Timing GP",
        startIso: "2026-03-01T10:00:00+02:00",
        location: "Buriram",
        circuit: "Timing Circuit"
      },
      {
        round: 2,
        grandPrix: "Next GP",
        startIso: "2026-03-01T14:00:00+02:00",
        location: "Austin",
        circuit: "Next Circuit"
      }
    ]
  };

  await page.clock.install({ time: new Date("2026-03-01T09:59:58+02:00") });
  await routeData(page, transitionData);
  await page.goto("/");

  await expect(page.locator("#next-title")).toHaveText("Timing GP");
  await expect(page.locator("#countdown-note")).toHaveText("Countdown to the MotoGP Grand Prix start.");

  await page.clock.runFor(3000);

  await expect(page.locator("#next-title")).toHaveText("Timing GP (Live)");
  await expect(page.locator("#countdown")).toHaveText("Race underway");
  await expect(page.locator("#countdown-note")).toHaveText("Race is underway. Countdown switches after finish.");
  await expect(page.locator("#status-message")).toHaveText("Timing GP is underway.");
});

test("shows season-complete state and an empty calendar after the last round finishes", async ({ page }) => {
  const completedSeasonData = {
    season: 2026,
    timezone: "Europe/Vilnius",
    timezoneLabel: "LT (EET/EEST)",
    defaultRaceDurationMinutes: 120,
    races: [
      {
        round: 1,
        grandPrix: "Final GP",
        startIso: "2026-03-01T08:00:00+02:00",
        location: "Valencia",
        circuit: "Final Circuit"
      }
    ]
  };

  await page.clock.install({ time: new Date("2026-03-01T11:30:00+02:00") });
  await routeData(page, completedSeasonData);
  await page.goto("/");

  await expect(page.locator("#next-title")).toHaveText("Season Complete");
  await expect(page.locator("#countdown")).toHaveText("All races finished");
  await expect(page.locator("#season-note")).toHaveText("Season complete.");
  await expect(page.locator(".race-item")).toHaveCount(0);
  await expect(page.locator("#calendar-empty")).toBeVisible();
  await expect(page.locator("#status-message")).toHaveText("Season complete. All races finished.");
});
