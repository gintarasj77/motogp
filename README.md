# MotoGP 2026 Countdown

Small static site that shows the next MotoGP race in Lithuania time, a live countdown, season progress, and the remaining 2026 rounds.

## Live App

https://motogp-asce.onrender.com/

## How to run

Serve the folder with a local static server, then open it in a browser.

Example:

`python -m http.server 8000`

Then open:

`http://localhost:8000`

Use the top-right theme toggle to switch between light and dark Material themes. The preference is saved in `localStorage`.
Finished rounds are hidden from the calendar automatically.

## Data

Edit `data.json`.

- `timezone` controls formatting (defaults to `Europe/Vilnius` if missing).
- `defaultRaceDurationMinutes` controls when a race is treated as finished (default `120`).
- Validation is enforced at runtime:
  - `races` must be a non-empty array.
  - Each race needs valid `round`, `grandPrix`, `startIso`, `location`, and `circuit`.
  - `durationMinutes` values must be positive and no greater than `360` when provided.
  - `defaultRaceDurationMinutes` must be positive and no greater than `360` when provided.
  - `round` values must be unique.
  - `round` values must be contiguous from `1..N`.
  - Race `startIso` values must be strictly increasing in list order.
  - `timezone` must be a valid IANA timezone.

## Tests

Run:

`node --test tests/race-logic.test.js`

`node --test tests/data-validation.test.js`

Browser smoke tests:

`npm ci`

`npx playwright install chromium`

`npx playwright test tests/ui/smoke.spec.js --project=chromium`
