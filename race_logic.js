(function (globalScope) {
  "use strict";

  const DEFAULT_RACE_DURATION_MINUTES = 120;
  const MS_PER_MINUTE = 60 * 1000;

  function getRaceDurationMinutes(race, fallbackMinutes = DEFAULT_RACE_DURATION_MINUTES) {
    if (race && Number.isFinite(race.durationMinutes) && race.durationMinutes > 0) {
      return race.durationMinutes;
    }
    return fallbackMinutes;
  }

  function getRaceStart(race) {
    return new Date(race.startIso);
  }

  function getRaceEnd(race, fallbackMinutes = DEFAULT_RACE_DURATION_MINUTES) {
    const start = getRaceStart(race);
    const durationMinutes = getRaceDurationMinutes(race, fallbackMinutes);
    return new Date(start.getTime() + durationMinutes * MS_PER_MINUTE);
  }

  function isRaceUnderway(race, now = new Date(), fallbackMinutes = DEFAULT_RACE_DURATION_MINUTES) {
    const start = getRaceStart(race);
    const end = getRaceEnd(race, fallbackMinutes);
    return start <= now && now < end;
  }

  function isRaceFinished(race, now = new Date(), fallbackMinutes = DEFAULT_RACE_DURATION_MINUTES) {
    return getRaceEnd(race, fallbackMinutes) <= now;
  }

  function getCompletedCount(races, now = new Date(), fallbackMinutes = DEFAULT_RACE_DURATION_MINUTES) {
    return races.filter((race) => isRaceFinished(race, now, fallbackMinutes)).length;
  }

  function getCurrentOrNextRace(races, now = new Date(), fallbackMinutes = DEFAULT_RACE_DURATION_MINUTES) {
    return races.find((race) => getRaceEnd(race, fallbackMinutes) > now) || null;
  }

  function formatCountdown(ms) {
    if (ms <= 0) {
      return "Race underway";
    }

    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }

  const RaceLogic = {
    DEFAULT_RACE_DURATION_MINUTES,
    formatCountdown,
    getCompletedCount,
    getCurrentOrNextRace,
    getRaceDurationMinutes,
    getRaceEnd,
    getRaceStart,
    isRaceFinished,
    isRaceUnderway
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = RaceLogic;
  }

  globalScope.RaceLogic = RaceLogic;
})(typeof window !== "undefined" ? window : globalThis);
