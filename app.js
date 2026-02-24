const elements = {
  themeToggle: document.getElementById("theme-toggle"),
  themeToggleLabel: document.getElementById("theme-toggle-label"),
  today: document.getElementById("today"),
  nextTitle: document.getElementById("next-title"),
  nextRound: document.getElementById("next-round"),
  nextDate: document.getElementById("next-date"),
  nextTime: document.getElementById("next-time"),
  nextLocation: document.getElementById("next-location"),
  nextCircuit: document.getElementById("next-circuit"),
  countdown: document.getElementById("countdown"),
  countdownNote: document.getElementById("countdown-note"),
  completed: document.getElementById("completed"),
  remaining: document.getElementById("remaining"),
  total: document.getElementById("total"),
  progressBar: document.getElementById("progress-bar"),
  seasonNote: document.getElementById("season-note"),
  raceList: document.getElementById("race-list")
};

const THEME_KEY = "racepulse-theme";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";
const DATA_FILE = "data.json";
const DEFAULT_TIMEZONE = "Europe/Vilnius";

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

function validateData(rawData) {
  if (!isPlainObject(rawData)) {
    throw new Error(`${DATA_FILE} must contain a JSON object.`);
  }

  if (!Array.isArray(rawData.races) || rawData.races.length === 0) {
    throw new Error(`${DATA_FILE}.races must be a non-empty array.`);
  }

  rawData.races.forEach((race, index) => validateRace(race, index));

  const seenRounds = new Set();
  rawData.races.forEach((race, index) => {
    if (seenRounds.has(race.round)) {
      throw new Error(`races[${index}].round duplicates round ${race.round}.`);
    }
    seenRounds.add(race.round);
  });

  const timezone = isNonEmptyString(rawData.timezone) ? rawData.timezone : DEFAULT_TIMEZONE;
  if (!validateTimeZone(timezone)) {
    throw new Error(`${DATA_FILE}.timezone "${timezone}" is not a valid IANA timezone.`);
  }

  return {
    season: Number.isInteger(rawData.season) && rawData.season > 0
      ? rawData.season
      : new Date().getUTCFullYear(),
    timezone,
    timezoneLabel: isNonEmptyString(rawData.timezoneLabel) ? rawData.timezoneLabel : "",
    defaultRaceDurationMinutes: readPositiveNumber(
      rawData.defaultRaceDurationMinutes,
      RaceLogic.DEFAULT_RACE_DURATION_MINUTES
    ),
    races: rawData.races
  };
}

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === THEME_LIGHT || stored === THEME_DARK) {
      return stored;
    }
  } catch (error) {
  }
  return null;
}

function getSystemTheme() {
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return THEME_DARK;
  }
  return THEME_LIGHT;
}

function updateThemeToggleUi(theme) {
  if (!elements.themeToggle) {
    return;
  }

  const isDark = theme === THEME_DARK;
  elements.themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
  elements.themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");

  if (elements.themeToggleLabel) {
    elements.themeToggleLabel.textContent = isDark ? "Light" : "Dark";
  }
}

function applyTheme(theme, persist = true) {
  const resolvedTheme = theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
  document.documentElement.setAttribute("data-theme", resolvedTheme);
  updateThemeToggleUi(resolvedTheme);

  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, resolvedTheme);
    } catch (error) {
    }
  }
}

function initThemeToggle() {
  const storedTheme = getStoredTheme();
  const initialTheme = storedTheme || getSystemTheme();
  applyTheme(initialTheme, false);

  if (!elements.themeToggle) {
    return;
  }

  elements.themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") === THEME_DARK
      ? THEME_DARK
      : THEME_LIGHT;
    const nextTheme = currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
    applyTheme(nextTheme, true);
  });
}

function createFormatters(timeZone) {
  return {
    date: new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "2-digit",
      month: "short",
      year: "numeric"
    }),
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }),
    today: new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    })
  };
}

function appendTextSpan(parent, className, text) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  parent.appendChild(span);
}

function clearChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function buildRaceList(races, now, formatters, defaultRaceDurationMinutes) {
  clearChildren(elements.raceList);

  races.forEach((race, index) => {
    const start = RaceLogic.getRaceStart(race);
    const isFinished = RaceLogic.isRaceFinished(race, now, defaultRaceDurationMinutes);
    const isUnderway = RaceLogic.isRaceUnderway(race, now, defaultRaceDurationMinutes);

    const card = document.createElement("div");
    card.className = "race-item";
    card.style.animationDelay = `${index * 0.04}s`;

    if (isFinished) {
      card.classList.add("finished");
    }
    if (isUnderway) {
      card.classList.add("underway");
    }

    appendTextSpan(card, "round", `Round ${race.round}`);
    appendTextSpan(card, "race-name", race.grandPrix);
    appendTextSpan(card, "race-meta", `${formatters.date.format(start)} - ${formatters.time.format(start)}`);
    appendTextSpan(card, "race-meta", `${race.location} - ${race.circuit}`);

    elements.raceList.appendChild(card);
  });
}

function updateSeasonStats(races, now, defaultRaceDurationMinutes) {
  const completed = RaceLogic.getCompletedCount(races, now, defaultRaceDurationMinutes);
  const underway = races.filter((race) => RaceLogic.isRaceUnderway(race, now, defaultRaceDurationMinutes)).length;
  const total = races.length;
  const remaining = Math.max(total - completed, 0);
  const upcoming = Math.max(remaining - underway, 0);
  const progress = total === 0 ? 0 : (completed / total) * 100;

  elements.completed.textContent = completed.toString();
  elements.remaining.textContent = remaining.toString();
  elements.total.textContent = total.toString();
  elements.progressBar.style.width = `${progress}%`;
  if (completed === total) {
    elements.seasonNote.textContent = "Season complete.";
    return;
  }

  if (underway > 0) {
    const underwayLabel = underway === 1 ? "race" : "races";
    const upcomingLabel = upcoming === 1 ? "race" : "races";
    elements.seasonNote.textContent = `${underway} ${underwayLabel} in progress, ${upcoming} ${upcomingLabel} after this one.`;
    return;
  }

  elements.seasonNote.textContent = `${remaining} race${remaining === 1 ? "" : "s"} left in season.`;
}

function updateCurrentOrNextRace(races, now, formatters, defaultRaceDurationMinutes) {
  const race = RaceLogic.getCurrentOrNextRace(races, now, defaultRaceDurationMinutes);

  if (!race) {
    elements.nextTitle.textContent = "Season Complete";
    elements.nextRound.textContent = "";
    elements.nextDate.textContent = "-";
    elements.nextTime.textContent = "-";
    elements.nextLocation.textContent = "-";
    elements.nextCircuit.textContent = "-";
    elements.countdown.textContent = "All races finished";
    elements.countdownNote.textContent = "See you next season.";
    return null;
  }

  const start = RaceLogic.getRaceStart(race);
  const end = RaceLogic.getRaceEnd(race, defaultRaceDurationMinutes);
  const isUnderway = RaceLogic.isRaceUnderway(race, now, defaultRaceDurationMinutes);

  elements.nextTitle.textContent = isUnderway ? `${race.grandPrix} (Live)` : race.grandPrix;
  elements.nextRound.textContent = `Round ${race.round}`;
  elements.nextDate.textContent = formatters.date.format(start);
  elements.nextTime.textContent = `${formatters.time.format(start)}`;
  elements.nextLocation.textContent = race.location;
  elements.nextCircuit.textContent = race.circuit;
  elements.countdownNote.textContent = isUnderway
    ? "Race is underway. Countdown switches after finish."
    : "Countdown to the MotoGP Grand Prix start.";

  if (isUnderway) {
    elements.countdown.textContent = "Race underway";
  }

  return { race, start, end };
}

async function loadData() {
  let response;
  try {
    response = await fetch(DATA_FILE, { cache: "no-store" });
  } catch (error) {
    throw new Error(`Failed to fetch ${DATA_FILE}. Serve the project over HTTP instead of file://.`);
  }

  if (!response.ok) {
    throw new Error(`Failed to load ${DATA_FILE}: ${response.status} ${response.statusText}`.trim());
  }

  let rawData;
  try {
    rawData = await response.json();
  } catch (error) {
    throw new Error(`${DATA_FILE} is not valid JSON.`);
  }

  return validateData(rawData);
}

async function init() {
  if (typeof RaceLogic === "undefined") {
    throw new Error("race_logic.js is not loaded.");
  }

  initThemeToggle();

  const data = await loadData();
  const races = Array.isArray(data.races)
    ? data.races.slice().sort((a, b) => new Date(a.startIso) - new Date(b.startIso))
    : [];
  const timeZone = typeof data.timezone === "string" && data.timezone
    ? data.timezone
    : DEFAULT_TIMEZONE;
  const defaultRaceDurationMinutes = Number.isFinite(data.defaultRaceDurationMinutes)
    && data.defaultRaceDurationMinutes > 0
    ? data.defaultRaceDurationMinutes
    : RaceLogic.DEFAULT_RACE_DURATION_MINUTES;
  const formatters = createFormatters(timeZone);

  let trackedRace = null;
  let trackedStart = null;
  let trackedEnd = null;

  const refreshCalendarAndStats = () => {
    const now = new Date();
    const eventInfo = updateCurrentOrNextRace(races, now, formatters, defaultRaceDurationMinutes);

    trackedRace = eventInfo ? eventInfo.race : null;
    trackedStart = eventInfo ? eventInfo.start : null;
    trackedEnd = eventInfo ? eventInfo.end : null;

    elements.today.textContent = `Today: ${formatters.today.format(now)}`;
    buildRaceList(races, now, formatters, defaultRaceDurationMinutes);
    updateSeasonStats(races, now, defaultRaceDurationMinutes);
  };

  const updateCountdown = () => {
    if (!trackedRace || !trackedStart || !trackedEnd) {
      return;
    }

    const now = new Date();
    if (now >= trackedEnd) {
      refreshCalendarAndStats();
      return;
    }
    elements.countdown.textContent = RaceLogic.formatCountdown(trackedStart - now);
  };

  refreshCalendarAndStats();
  updateCountdown();
  setInterval(updateCountdown, 1000);
  setInterval(refreshCalendarAndStats, 60 * 1000);
}

init().catch((error) => {
  elements.nextTitle.textContent = "Data load failed";
  elements.countdown.textContent = `Check ${DATA_FILE}`;
  console.error(error);
});
