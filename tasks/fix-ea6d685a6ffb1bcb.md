# fix-ea6d685a6ffb1bcb — Session `reminderCadence` not synced with persistent storage in `/reminders` handler

**Weight:** 0.0000 (share of project budget)
**Reward:** 0 ENSTAR

The `/reminders` command handler in `src/bot.ts:212-246` sets `ctx.session.awaitingReminderTime = true` but never sets or clears `ctx.session.reminderCadence`. The callback handlers (`reminders:cadence:*` at line 356) set `ctx.session.reminderCadence` to the button's cadence. The text-input handler (line 412-429) then uses `ctx.session.reminderCadence ?? "daily"` to determine the cadence for scheduling.

If a user clicks a cadence button (e.g. "Every other day") but does NOT type a time, then sends `/reminders` again (which reads and displays the cadence from persistent storage, not session), and THEN types a time, the stale session cadence from the prior button press is used — silently overriding the displayed cadence. The storage write and scheduler get a different cadence than what the `/reminders` prompt showed.

## Dialog tests

If this task adds or changes user-facing bot behavior, author its dialog tests as a `BotSpec` JSON array in its OWN file `tests/specs/fix-ea6d685a6ffb1bcb.json`. NEVER edit or append to a shared `tests/specs.json` — concurrent feature PRs would conflict on it. The tests-gate globs and merges all `tests/specs/*.json`.

If this task adds a bot command, declare it in its OWN file `tests/commands/fix-ea6d685a6ffb1bcb.json` (a JSON array of command strings, e.g. `["/start"]`). NEVER edit or append to a shared `tests/commands.json` — same conflict reason. The tests-gate globs, merges + de-duplicates all `tests/commands/*.json`.


## Implementation contract

Ship a COMPLETE, working implementation — not a stub. A task is INCOMPLETE (and will be rejected) even if it compiles and the dialog tests pass when it does any of these:
- **Stubbed code:** empty bodies, `TODO`/`FIXME`, commented-out logic, or `throw new Error("not implemented")`.
- **Fabricated data:** `Math.random()`, hardcoded sample arrays, or canned responses standing in for real computed or fetched values.
- **No in-memory data store:** a `Map`/array/module-level variable used as a database is a defect. Anything that must survive a restart (records, subscriptions, balances, schedules, settings) MUST use the toolkit's persistent storage (Redis-backed), not process memory. (The toolkit's auto-selected session storage is only for ephemeral conversation state.)
- **Broken integrations:** call external APIs against their real contract — correct endpoints, ids and params (e.g. a coin *id* like `the-open-network`, not a ticker like `TON`) — with credentials read from env. Do not invent endpoints or fake responses.
- **Dead code:** new commands/handlers must be registered and reachable from the bot's command surface.
If the spec is genuinely under-specified, implement the smallest REAL slice you can verify and note the gap — never fake behavior to make the PR look complete.
