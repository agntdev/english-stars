# fix-7b449de0e2e3a09a — E1T3: PostgreSQL storage not implemented — spec violation

**Weight:** 0.0000 (share of project budget)
**Reward:** 0 ENSTAR

The E1T3 task spec explicitly requires: "mark user as 'unlocked' in PostgreSQL and credit their account." The implementation in `src/bot.ts:159-164` uses `getUserDataStorage()` which stores user data via the toolkit's `RedisSessionStorage` (when `REDIS_URL` is set) or falls back to `MemorySessionStorage` (an in-memory `Map`). No PostgreSQL client dependency exists in `package.json`, no PostgreSQL connection string in `.env.example`, and no PostgreSQL storage adapter exists in the toolkit. The E1T3 dialog tests in `tests/specs/E1T3.json` only assert outgoing messages and would pass despite the wrong storage backend — the functional behavior (unlock + credit stars) is correct, but the persistence layer does not match the spec.

## Dialog tests

If this task adds or changes user-facing bot behavior, author its dialog tests as a `BotSpec` JSON array in its OWN file `tests/specs/fix-7b449de0e2e3a09a.json`. NEVER edit or append to a shared `tests/specs.json` — concurrent feature PRs would conflict on it. The tests-gate globs and merges all `tests/specs/*.json`.

If this task adds a bot command, declare it in its OWN file `tests/commands/fix-7b449de0e2e3a09a.json` (a JSON array of command strings, e.g. `["/start"]`). NEVER edit or append to a shared `tests/commands.json` — same conflict reason. The tests-gate globs, merges + de-duplicates all `tests/commands/*.json`.


## Implementation contract

Ship a COMPLETE, working implementation — not a stub. A task is INCOMPLETE (and will be rejected) even if it compiles and the dialog tests pass when it does any of these:
- **Stubbed code:** empty bodies, `TODO`/`FIXME`, commented-out logic, or `throw new Error("not implemented")`.
- **Fabricated data:** `Math.random()`, hardcoded sample arrays, or canned responses standing in for real computed or fetched values.
- **No in-memory data store:** a `Map`/array/module-level variable used as a database is a defect. Anything that must survive a restart (records, subscriptions, balances, schedules, settings) MUST use the toolkit's persistent storage (Redis-backed), not process memory. (The toolkit's auto-selected session storage is only for ephemeral conversation state.)
- **Broken integrations:** call external APIs against their real contract — correct endpoints, ids and params (e.g. a coin *id* like `the-open-network`, not a ticker like `TON`) — with credentials read from env. Do not invent endpoints or fake responses.
- **Dead code:** new commands/handlers must be registered and reachable from the bot's command surface.
If the spec is genuinely under-specified, implement the smallest REAL slice you can verify and note the gap — never fake behavior to make the PR look complete.
