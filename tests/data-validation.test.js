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
  assert.doesNotThrow(() => DataValidation.validateData(projectData, validationOptions));
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
    contains: ".startIso is not a valid date-time"
  },
  {
    name: "invalid-empty-races.json",
    contains: "data.json.races must be a non-empty array"
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
