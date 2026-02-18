const elements = {
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
  const total = races.length;
  const remaining = Math.max(total - completed, 0);
  const progress = total === 0 ? 0 : (completed / total) * 100;

  elements.completed.textContent = completed.toString();
  elements.remaining.textContent = remaining.toString();
  elements.total.textContent = total.toString();
  elements.progressBar.style.width = `${progress}%`;
  elements.seasonNote.textContent = completed === total
    ? "Season complete."
    : `${remaining} race${remaining === 1 ? "" : "s"} left after today.`;
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

function loadData() {
  const embedded = document.getElementById("race-data");
  if (!embedded || !embedded.textContent.trim()) {
    throw new Error("Embedded race data was not found.");
  }

  return JSON.parse(embedded.textContent);
}

function init() {
  if (typeof RaceLogic === "undefined") {
    throw new Error("race_logic.js is not loaded.");
  }

  const data = loadData();
  const races = Array.isArray(data.races)
    ? data.races.slice().sort((a, b) => new Date(a.startIso) - new Date(b.startIso))
    : [];
  const timeZone = typeof data.timezone === "string" && data.timezone
    ? data.timezone
    : "Europe/Vilnius";
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

try {
  init();
} catch (error) {
  elements.nextTitle.textContent = "Data load failed";
  elements.countdown.textContent = "Check embedded race data";
  console.error(error);
}
