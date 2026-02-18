# MotoGP 2026 Countdown

Small static site that shows the next MotoGP race in Lithuania time, a live countdown, season progress, and the full 2026 calendar.

## How to run

Open `index.html` in a browser (no build step).

Use the top-right theme toggle to switch between light and dark Material themes. The preference is saved in `localStorage`.

## Data

Edit the embedded JSON block in `index.html` (`<script id="race-data" type="application/json">`).

- `timezone` controls formatting (defaults to `Europe/Vilnius` if missing).
- `defaultRaceDurationMinutes` controls when a race is treated as finished (default `120`).

## Tests

Run:

`node --test tests/race-logic.test.js`
