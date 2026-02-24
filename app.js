const elements = {
  themeToggle: document.getElementById("theme-toggle"),
  themeToggleLabel: document.getElementById("theme-toggle-label"),
  seasonTag: document.getElementById("season-tag"),
  seasonHeading: document.getElementById("season-heading"),
  lastUpdated: document.getElementById("last-updated"),
  calendarTimezone: document.getElementById("calendar-timezone"),
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
  raceList: document.getElementById("race-list"),
  errorPanel: document.getElementById("error-panel"),
  errorMessage: document.getElementById("error-message"),
  errorRetry: document.getElementById("error-retry")
};

const THEME_KEY = "racepulse-theme";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";
const DATA_FILE = "data.json";
const DEFAULT_TIMEZONE = "Europe/Vilnius";
const DEFAULT_PAGE_TITLE = document.title || "MotoGP Countdown";
let countdownIntervalId = null;
let refreshIntervalId = null;
let isReloading = false;

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

  if (!elements.themeToggle || elements.themeToggle.dataset.bound === "true") {
    return;
  }
  elements.themeToggle.dataset.bound = "true";

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

function getTimezoneLabel(data) {
  if (typeof data.timezoneLabel === "string" && data.timezoneLabel.trim()) {
    return data.timezoneLabel.trim();
  }
  return data.timezone;
}

function formatLastUpdated(lastUpdatedValue, timeZone) {
  const parsed = new Date(lastUpdatedValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(parsed);
}

function applyHeaderLabels(data, timeZone) {
  const seasonLabel = Number.isInteger(data.season) && data.season > 0
    ? data.season.toString()
    : "";
  const timezoneLabel = getTimezoneLabel(data);

  if (elements.seasonTag) {
    const seasonPrefix = seasonLabel ? `${seasonLabel} MotoGP` : "MotoGP";
    elements.seasonTag.textContent = `${seasonPrefix} - ${timezoneLabel}`;
  }

  if (elements.seasonHeading) {
    elements.seasonHeading.textContent = seasonLabel
      ? `${seasonLabel} Season Dashboard`
      : "Season Dashboard";
  }

  if (elements.calendarTimezone) {
    elements.calendarTimezone.textContent = `All times in ${timezoneLabel}`;
  }

  const lastUpdatedLabel = formatLastUpdated(data.lastUpdated, timeZone);
  if (elements.lastUpdated) {
    elements.lastUpdated.textContent = lastUpdatedLabel
      ? `Last updated: ${lastUpdatedLabel}`
      : "Last updated: -";
  }

  if (seasonLabel) {
    document.title = `${seasonLabel} MotoGP Countdown - ${timezoneLabel}`;
  } else {
    document.title = `${DEFAULT_PAGE_TITLE} - ${timezoneLabel}`;
  }
}

function clearIntervals() {
  if (countdownIntervalId !== null) {
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }
  if (refreshIntervalId !== null) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}

function setLoadingState() {
  elements.nextTitle.textContent = "Loading...";
  elements.nextRound.textContent = "";
  elements.nextDate.textContent = "-";
  elements.nextTime.textContent = "-";
  elements.nextLocation.textContent = "-";
  elements.nextCircuit.textContent = "-";
  elements.countdown.textContent = "-";
  elements.countdownNote.textContent = "";
}

function hideLoadError() {
  if (!elements.errorPanel) {
    return;
  }
  elements.errorPanel.classList.remove("visible");
  elements.errorPanel.hidden = true;
}

function showLoadError(error) {
  const message = error instanceof Error
    ? error.message
    : "Unknown error while loading season data.";

  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
  }
  if (elements.errorPanel) {
    elements.errorPanel.hidden = false;
    elements.errorPanel.classList.add("visible");
  }

  elements.nextTitle.textContent = "Data load failed";
  elements.countdown.textContent = `Check ${DATA_FILE}`;
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

  return DataValidation.validateData(rawData, {
    defaultTimezone: DEFAULT_TIMEZONE,
    defaultRaceDurationMinutes: RaceLogic.DEFAULT_RACE_DURATION_MINUTES,
    fallbackSeason: new Date().getUTCFullYear()
  });
}

async function init() {
  if (typeof RaceLogic === "undefined") {
    throw new Error("race_logic.js is not loaded.");
  }
  if (typeof DataValidation === "undefined") {
    throw new Error("data_validation.js is not loaded.");
  }

  initThemeToggle();

  const data = await loadData();
  const races = Array.isArray(data.races)
    ? data.races.slice().sort((a, b) => new Date(a.startIso) - new Date(b.startIso))
    : [];
  const timeZone = typeof data.timezone === "string" && data.timezone
    ? data.timezone
    : DEFAULT_TIMEZONE;
  applyHeaderLabels(data, timeZone);
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
  countdownIntervalId = setInterval(updateCountdown, 1000);
  refreshIntervalId = setInterval(refreshCalendarAndStats, 60 * 1000);
}

async function reloadApp() {
  if (isReloading) {
    return;
  }

  isReloading = true;
  if (elements.errorRetry) {
    elements.errorRetry.disabled = true;
  }

  clearIntervals();
  hideLoadError();
  setLoadingState();

  try {
    await init();
  } catch (error) {
    showLoadError(error);
    console.error(error);
  } finally {
    if (elements.errorRetry) {
      elements.errorRetry.disabled = false;
    }
    isReloading = false;
  }
}

if (elements.errorRetry) {
  elements.errorRetry.addEventListener("click", () => {
    reloadApp();
  });
}

reloadApp();
