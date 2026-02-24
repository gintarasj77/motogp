(function (globalScope) {
  "use strict";

  const DEFAULT_TIMEZONE = "Europe/Vilnius";
  const DEFAULT_RACE_DURATION_MINUTES = 120;

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function validateTimeZone(timeZone) {
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone });
      return true;
    } catch (error) {
      return false;
    }
  }

  function readPositiveNumber(value, fallback) {
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
    return fallback;
  }

  function validateRace(rawRace, index) {
    const path = `races[${index}]`;
    if (!isPlainObject(rawRace)) {
      throw new Error(`${path} must be an object.`);
    }

    if (!Number.isInteger(rawRace.round) || rawRace.round <= 0) {
      throw new Error(`${path}.round must be a positive integer.`);
    }

    if (!isNonEmptyString(rawRace.grandPrix)) {
      throw new Error(`${path}.grandPrix must be a non-empty string.`);
    }

    if (!isNonEmptyString(rawRace.startIso)) {
      throw new Error(`${path}.startIso must be a non-empty ISO date-time string.`);
    }

    const start = new Date(rawRace.startIso);
    if (Number.isNaN(start.getTime())) {
      throw new Error(`${path}.startIso is not a valid date-time.`);
    }

    if (!isNonEmptyString(rawRace.location)) {
      throw new Error(`${path}.location must be a non-empty string.`);
    }

    if (!isNonEmptyString(rawRace.circuit)) {
      throw new Error(`${path}.circuit must be a non-empty string.`);
    }

    if (rawRace.durationMinutes !== undefined
      && (!Number.isFinite(rawRace.durationMinutes) || rawRace.durationMinutes <= 0)) {
      throw new Error(`${path}.durationMinutes must be a positive number when provided.`);
    }
  }

  function validateData(rawData, options = {}) {
    if (!isPlainObject(rawData)) {
      throw new Error("data.json must contain a JSON object.");
    }

    if (!Array.isArray(rawData.races) || rawData.races.length === 0) {
      throw new Error("data.json.races must be a non-empty array.");
    }

    rawData.races.forEach((race, index) => validateRace(race, index));

    const seenRounds = new Set();
    rawData.races.forEach((race, index) => {
      if (seenRounds.has(race.round)) {
        throw new Error(`races[${index}].round duplicates round ${race.round}.`);
      }
      seenRounds.add(race.round);
    });

    const defaultTimezone = isNonEmptyString(options.defaultTimezone)
      ? options.defaultTimezone
      : DEFAULT_TIMEZONE;
    const timezone = isNonEmptyString(rawData.timezone) ? rawData.timezone : defaultTimezone;
    if (!validateTimeZone(timezone)) {
      throw new Error(`data.json.timezone "${timezone}" is not a valid IANA timezone.`);
    }

    const fallbackSeason = Number.isInteger(options.fallbackSeason) && options.fallbackSeason > 0
      ? options.fallbackSeason
      : new Date().getUTCFullYear();
    const fallbackDuration = readPositiveNumber(
      options.defaultRaceDurationMinutes,
      DEFAULT_RACE_DURATION_MINUTES
    );

    return {
      season: Number.isInteger(rawData.season) && rawData.season > 0
        ? rawData.season
        : fallbackSeason,
      timezone,
      timezoneLabel: isNonEmptyString(rawData.timezoneLabel) ? rawData.timezoneLabel : "",
      defaultRaceDurationMinutes: readPositiveNumber(
        rawData.defaultRaceDurationMinutes,
        fallbackDuration
      ),
      races: rawData.races
    };
  }

  const DataValidation = {
    DEFAULT_TIMEZONE,
    isNonEmptyString,
    isPlainObject,
    readPositiveNumber,
    validateData,
    validateRace,
    validateTimeZone
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = DataValidation;
  }

  globalScope.DataValidation = DataValidation;
})(typeof window !== "undefined" ? window : globalThis);
