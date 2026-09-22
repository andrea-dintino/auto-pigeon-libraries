# `@auto-pigeon/operational-notice-contract`

One bounded contract for **operational notices** — scheduled maintenance and similar statements an
operator publishes once, in AUB, and that AUP, AUG and AUCOM each render in their own idiom.

It ships contract data plus a dependency-free reference implementation. No transport, no UI, no
storage: AUB owns the `operational_notices` collection and its read route; each client fetches
through its own AUB client and renders the result.

| file | what it is |
| --- | --- |
| `schema/operational-notices-response-1.0.schema.json` | the CLOSED read response of `GET /api/operational-notices?surface=…` |
| `schema/notice-rules.json` | severities, surfaces, visibilities, text/schedule bounds, poll cadence, telemetry names, operator time rules |
| `src/index.mjs` | the reference implementation every client runs, and the server selection AUB mirrors in Go |
| `fixtures/notice-vectors.json` | generated cross-language vectors (`npm run vectors`) |
| `fixtures/operator-time-vectors.json` | hand-written IANA zone / DST cases for the operator CLI |

## The policy, in one place

- **Phase is derived, never stored.** `pending → upcoming (show_from) → active (starts_at) →
  expired (ends_at)`, computed from **server time**: `serverNow = Date.now() + offset`, where the
  offset comes from `clockOffsetMs(server_time, requestStart, responseEnd)`. A wrong local clock
  neither hides nor prolongs a notice.
- **Visibility.** `public` notices are for everyone; `authenticated` ones only for a signed-in
  caller. Signing out re-evaluates at once, and an authenticated notice is **never cached**.
- **Dismissal** is local, keyed `account:id:revision` — an edit (new revision) resurfaces the
  notice, a dismissal on one account does not hide it on another. A **critical** notice is never
  dismissible, whatever the data says.
- **Polling**: at start-up, then every `poll_after_seconds` (clamped to 60–120 s, ±10 % jitter,
  clamped again), one request in flight, conditional (`If-None-Match`). On failure, exponential
  backoff from 60 s to 15 min.
- **Cache**: only the last valid public response plus the clock offset. A cached notice stays
  visible during planned AUB downtime and disappears at its server-derived end.
- **Telemetry**: only `notices.fetch_failed`, `notices.response_invalid`,
  `notices.stale_cache_used` — never an id, a title, a body, an account or a dismissal.
- **Text is plain text.** Clients render it as text nodes. The store refuses control, bidi and
  zero-width characters and anything that looks like markup.

## The limit every client states

This can announce **planned** downtime and keep showing a notice already fetched while AUB is down.
It **cannot** tell a first-time or offline client about an **unplanned** AUB outage: that needs a
status channel independent of AUB, which is backlog, not this package.

## Operator time

An operator may type a local time in an IANA region zone (`Europe/Copenhagen`) or `UTC`; the tool
shows the resulting UTC instants. `CET`/`CEST`/`EST5EDT` are refused — `CET` is not Copenhagen for
half the year. A spring-forward gap is refused (`nonexistent_local_time`); a fall-back hour is
refused (`ambiguous_local_time`) unless the operator chooses fold 0 or 1.

```sh
npm test          # node --test test/*.test.mjs
npm run vectors   # regenerate fixtures/notice-vectors.json, then review the diff
```
