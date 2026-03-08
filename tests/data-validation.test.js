const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const DataValidation = require("../data_validation.js");

const FIXTURE_DIR = path.join(__dirname, "fixtures", "data");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readFixture(name) {
  return readJson(path.join(FIXTURE_DIR, name));
}

const validationOptions = {
  defaultTimezone: DataValidation.DEFAULT_TIMEZONE,
  defaultRaceDurationMinutes: 120,
  fallbackSeason: 2026
};

test("valid fixture passes validation", () => {
  const valid = readFixture("valid-calendar.json");
  const parsed = DataValidation.validateData(valid, validationOptions);

  assert.equal(parsed.timezone, "Europe/Vilnius");
  assert.equal(parsed.defaultRaceDurationMinutes, 120);
  assert.equal(parsed.races.length, 2);
});

test("valid minimal fixture applies defaults", () => {
  const minimal = readFixture("valid-minimal.json");
  const parsed = DataValidation.validateData(minimal, validationOptions);

  assert.equal(parsed.season, 2026);
  assert.equal(parsed.timezone, "Europe/Vilnius");
  assert.equal(parsed.defaultRaceDurationMinutes, 120);
  assert.equal(parsed.races.length, 1);
});

test("project data.json passes validation", () => {
  const projectData = readJson(path.join(__dirname, "..", "data.json"));
  const parsed = DataValidation.validateData(projectData, validationOptions);

  assert.deepEqual(
    Object.keys(parsed).sort(),
    ["defaultRaceDurationMinutes", "races", "season", "timezone", "timezoneLabel"]
  );
  assert.equal(parsed.defaultRaceDurationMinutes, projectData.defaultRaceDurationMinutes);
  assert.equal(parsed.races.length, projectData.races.length);
});

test("rejects default race durations that exceed the maximum", () => {
  const invalid = readFixture("valid-minimal.json");
  invalid.defaultRaceDurationMinutes = DataValidation.MAX_RACE_DURATION_MINUTES + 1;

  assert.throws(
    () => DataValidation.validateData(invalid, validationOptions),
    (error) => error instanceof Error
      && error.message.includes("data.json.defaultRaceDurationMinutes must be a positive number not greater")
  );
});

test("rejects per-race durations that exceed the maximum", () => {
  const invalid = readFixture("valid-minimal.json");
  invalid.races[0].durationMinutes = DataValidation.MAX_RACE_DURATION_MINUTES + 1;

  assert.throws(
    () => DataValidation.validateData(invalid, validationOptions),
    (error) => error instanceof Error
      && error.message.includes("races[0].durationMinutes must be a positive number not greater")
  );
});

const invalidFixtures = [
  {
    name: "invalid-duplicate-round.json",
    contains: "duplicates round"
  },
  {
    name: "invalid-missing-grandprix.json",
    contains: ".grandPrix must be a non-empty string"
  },
  {
    name: "invalid-invalid-timezone.json",
    contains: "is not a valid IANA timezone"
  },
  {
    name: "invalid-invalid-start-iso.json",
    contains: ".startIso is not a valid ISO date-time with timezone"
  },
  {
    name: "invalid-start-missing-timezone.json",
    contains: ".startIso is not a valid ISO date-time with timezone"
  },
  {
    name: "invalid-empty-races.json",
    contains: "data.json.races must be a non-empty array"
  },
  {
    name: "invalid-non-contiguous-rounds.json",
    contains: "races.round must be contiguous"
  },
  {
    name: "invalid-non-increasing-dates.json",
    contains: "strictly increasing startIso order"
  }
];

invalidFixtures.forEach(({ name, contains }) => {
  test(`invalid fixture ${name} fails validation`, () => {
    const invalid = readFixture(name);
    assert.throws(
      () => DataValidation.validateData(invalid, validationOptions),
      (error) => error instanceof Error && error.message.includes(contains)
    );
  });
});
