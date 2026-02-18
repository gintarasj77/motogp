const test = require("node:test");
const assert = require("node:assert/strict");

const RaceLogic = require("../race_logic.js");

test("formatCountdown returns d/h/m/s for positive durations", () => {
  const countdown = RaceLogic.formatCountdown((86400 + 7200 + 180 + 4) * 1000);
  assert.equal(countdown, "1d 2h 3m 4s");
});

test("formatCountdown returns underway for zero or negative durations", () => {
  assert.equal(RaceLogic.formatCountdown(0), "Race underway");
  assert.equal(RaceLogic.formatCountdown(-5000), "Race underway");
});

test("completed races are counted after finish, not at start", () => {
  const races = [
    { round: 1, startIso: "2026-03-01T10:00:00+02:00" },
    { round: 2, startIso: "2026-03-01T14:00:00+02:00" }
  ];

  const beforeFinish = new Date("2026-03-01T11:59:59+02:00");
  const atFinish = new Date("2026-03-01T12:00:00+02:00");

  assert.equal(RaceLogic.getCompletedCount(races, beforeFinish), 0);
  assert.equal(RaceLogic.getCompletedCount(races, atFinish), 1);
});

test("current or next race returns ongoing race before jumping to the next one", () => {
  const races = [
    { round: 1, startIso: "2026-03-01T10:00:00+02:00" },
    { round: 2, startIso: "2026-03-01T14:00:00+02:00" }
  ];

  const ongoingNow = new Date("2026-03-01T10:30:00+02:00");
  const betweenRacesNow = new Date("2026-03-01T12:30:00+02:00");

  assert.equal(RaceLogic.getCurrentOrNextRace(races, ongoingNow).round, 1);
  assert.equal(RaceLogic.getCurrentOrNextRace(races, betweenRacesNow).round, 2);
});

test("durationMinutes on race overrides default finish window", () => {
  const race = {
    round: 1,
    startIso: "2026-03-01T10:00:00+02:00",
    durationMinutes: 180
  };

  const afterTwoHours = new Date("2026-03-01T12:01:00+02:00");
  const afterThreeHours = new Date("2026-03-01T13:00:00+02:00");

  assert.equal(RaceLogic.isRaceFinished(race, afterTwoHours), false);
  assert.equal(RaceLogic.isRaceFinished(race, afterThreeHours), true);
});
