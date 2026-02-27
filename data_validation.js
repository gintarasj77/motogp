(function (globalScope) {
  "use strict";

  const DEFAULT_TIMEZONE = "Europe/Vilnius";
  const DEFAULT_RACE_DURATION_MINUTES = 120;
  const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const ISO_DATE_TIME_RE =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+\-]\d{2}:\d{2})$/;

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

  function parseDigits(value) {
    return Number.parseInt(value, 10);
  }

  function isValidCalendarDate(year, month, day) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return false;
    }
    if (month < 1 || month > 12 || day < 1) {
      return false;
    }
    const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day <= maxDay;
  }

  function isValidIsoDateString(value) {
    const match = ISO_DATE_RE.exec(value);
    if (!match) {
      return false;
    }
    const year = parseDigits(match[1]);
    const month = parseDigits(match[2]);
    const day = parseDigits(match[3]);
    return isValidCalendarDate(year, month, day);
  }

  function isValidIsoDateTimeString(value) {
    const match = ISO_DATE_TIME_RE.exec(value);
    if (!match) {
      return false;
    }

    const year = parseDigits(match[1]);
    const month = parseDigits(match[2]);
    const day = parseDigits(match[3]);
    const hour = parseDigits(match[4]);
    const minute = parseDigits(match[5]);
    const second = match[6] === undefined ? 0 : parseDigits(match[6]);
    const offset = match[8];

    if (!isValidCalendarDate(year, month, day)) {
      return false;
    }
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      return false;
    }

    if (offset !== "Z") {
      const [offsetHourText, offsetMinuteText] = offset.slice(1).split(":");
      const offsetHour = parseDigits(offsetHourText);
      const offsetMinute = parseDigits(offsetMinuteText);
      if (offsetHour < 0 || offsetHour > 23 || offsetMinute < 0 || offsetMinute > 59) {
        return false;
      }
    }

    return !Number.isNaN(new Date(value).getTime());
  }

  function isValidIsoDateOrDateTimeString(value) {
    return isValidIsoDateString(value) || isValidIsoDateTimeString(value);
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

    if (!isValidIsoDateTimeString(rawRace.startIso)) {
      throw new Error(`${path}.startIso is not a valid ISO date-time with timezone.`);
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

  function parseDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
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

    const sortedRounds = rawData.races
      .map((race) => race.round)
      .slice()
      .sort((a, b) => a - b);
    sortedRounds.forEach((round, index) => {
      const expectedRound = index + 1;
      if (round !== expectedRound) {
        throw new Error(
          `races.round must be contiguous from 1..${rawData.races.length}; expected ${expectedRound}, found ${round}.`
        );
      }
    });

    let previousStartMs = null;
    rawData.races.forEach((race, index) => {
      const startMs = new Date(race.startIso).getTime();
      if (previousStartMs !== null && startMs <= previousStartMs) {
        throw new Error(
          `races must be in strictly increasing startIso order; check races[${index - 1}] and races[${index}].`
        );
      }
      previousStartMs = startMs;
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
    if (!isNonEmptyString(rawData.lastUpdated)) {
      throw new Error("data.json.lastUpdated must be a non-empty ISO date or date-time string.");
    }
    if (!isValidIsoDateOrDateTimeString(rawData.lastUpdated)) {
      throw new Error("data.json.lastUpdated must be a valid ISO date or date-time string.");
    }

    return {
      season: Number.isInteger(rawData.season) && rawData.season > 0
        ? rawData.season
        : fallbackSeason,
      timezone,
      timezoneLabel: isNonEmptyString(rawData.timezoneLabel) ? rawData.timezoneLabel : "",
      lastUpdated: rawData.lastUpdated,
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
    parseDate,
    isPlainObject,
    isValidIsoDateOrDateTimeString,
    isValidIsoDateString,
    isValidIsoDateTimeString,
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
