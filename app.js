const TIMEZONE = "Europe/Vilnius";

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

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const todayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric"
});

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

function buildRaceList(races, now) {
  elements.raceList.innerHTML = "";
  races.forEach((race, index) => {
    const start = new Date(race.startIso);
    const isPast = start <= now;

    const card = document.createElement("div");
    card.className = "race-item";
    card.style.animationDelay = `${index * 0.04}s`;
    if (isPast) {
      card.style.opacity = "0.6";
    }

    card.innerHTML = `
      <span class="round">Round ${race.round}</span>
      <span class="race-name">${race.grandPrix}</span>
      <span class="race-meta">${dateFormatter.format(start)} • ${timeFormatter.format(start)}</span>
      <span class="race-meta">${race.location} • ${race.circuit}</span>
    `;

    elements.raceList.appendChild(card);
  });
}

function updateSeasonStats(races, now) {
  const completed = races.filter((race) => new Date(race.startIso) <= now).length;
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

function updateNextRace(races, now) {
  const nextRace = races.find((race) => new Date(race.startIso) > now);
  if (!nextRace) {
    elements.nextTitle.textContent = "Season Complete";
    elements.nextRound.textContent = "";
    elements.nextDate.textContent = "—";
    elements.nextTime.textContent = "—";
    elements.nextLocation.textContent = "—";
    elements.nextCircuit.textContent = "—";
    elements.countdown.textContent = "All races finished";
    elements.countdownNote.textContent = "See you next season.";
    return null;
  }

  const start = new Date(nextRace.startIso);
  elements.nextTitle.textContent = nextRace.grandPrix;
  elements.nextRound.textContent = `Round ${nextRace.round}`;
  elements.nextDate.textContent = dateFormatter.format(start);
  elements.nextTime.textContent = `${timeFormatter.format(start)}`;
  elements.nextLocation.textContent = nextRace.location;
  elements.nextCircuit.textContent = nextRace.circuit;
  elements.countdownNote.textContent = `Countdown to the MotoGP Grand Prix start.`;

  return start;
}

async function loadData() {
  const embedded = document.getElementById("race-data");
  if (embedded && embedded.textContent.trim()) {
    return JSON.parse(embedded.textContent);
  }

  const response = await fetch("data.json");
  return response.json();
}

async function init() {
  const data = await loadData();
  const races = data.races.slice().sort((a, b) => new Date(a.startIso) - new Date(b.startIso));

  elements.today.textContent = `Today: ${todayFormatter.format(new Date())}`;

  buildRaceList(races, new Date());

  let nextStart = updateNextRace(races, new Date());
  updateSeasonStats(races, new Date());

  const updateCountdown = () => {
    const now = new Date();
    if (nextStart && now > nextStart) {
      nextStart = updateNextRace(races, now);
      updateSeasonStats(races, now);
    }
    if (nextStart) {
      const diff = nextStart - now;
      elements.countdown.textContent = formatCountdown(diff);
    }
  };

  const refreshStats = () => {
    const now = new Date();
    updateSeasonStats(races, now);
  };

  updateCountdown();
  setInterval(updateCountdown, 1000);
  setInterval(refreshStats, 60 * 1000);
}

init().catch((error) => {
  elements.nextTitle.textContent = "Data load failed";
  elements.countdown.textContent = "Check data.json";
  console.error(error);
});
