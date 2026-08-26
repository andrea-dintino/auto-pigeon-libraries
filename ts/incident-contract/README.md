# `@auto-pigeon/incident-contract`

The cross-stack incident contract: **one envelope**, **one taxonomy of codes**, **one
correlation-id convention**, and **one set of redaction rules**, shared by every Auto-Pigeon
component that can fail in a way a person notices.

It ships contract data plus a dependency-free reference implementation of the rules that data
needs. It has **no transport**: no SDK, no DSN, no HTTP client, nothing that starts. Which error
backend a component reports to, and how, is that component's decision — this package decides what a
report *is*.

## Why the package exists

Six components can each be the reason an editor session goes wrong, and a user only ever sees one
of them. Without a shared shape, "the paste froze" is a browser console line in one repository, a
Go log line in another and a Colyseus disconnect reason in a third — three vocabularies for one
event, and no way to tell they are the same event. The envelope and the correlation id are what
turn those into one story; the code taxonomy is what makes *"which errors does this product have"*
answerable without reading six repositories.

## The envelope is CLOSED, and that is the design

`schema/incident-envelope-1.0.schema.json` sets `additionalProperties: false` at every level, and
`evidence` is a fixed set of typed counters — face counts, an HTTP status, a queue depth, a worker
attempt. There is **no field a map document, a request body, an annotation or a prefab can legally
occupy**. That is deliberate: an incident may end up in a public bug report, and a bound that a
reviewer has to enforce by reading every call site is not a bound. Something the schema cannot
express is a schema change, reviewed here.

```js
import { createIncident, validateIncident, redactIncident, toSentryEvent } from "@auto-pigeon/incident-contract";

const incident = createIncident({
  severity: "warning",
  component: "AUP",
  subsystem: "render.3d",
  code: "render.3d.slow",
  operation: "Paste",
  message: "3D redraw is still running after Paste.",
  duration_ms: 3100,
  correlation_id: correlationId,      // the one this user action has carried all along
  release: "1.842",                   // PREPROD-05's 1.<commit-count>, or "unknown"
  environment: "production",
  recoverable: true,
  user_action: "You can wait longer or reload the page.",
  evidence: { face_count: 31040 },
});

validateIncident(incident);           // { valid, errors } — returns, never throws
const event = toSentryEvent(incident);  // redacted on the way out
```

`createIncident` fills in only what a caller cannot reasonably repeat at every call site — the
schema version, an id, a timestamp. It invents **no** component, **no** severity and **no** release:
a made-up release is the placeholder-version failure PREPROD-05 settled, and `"unknown"` is a legal,
meaningful value here.

## The correlation id

**128 random bits, 32 lowercase hex characters**, minted where a *person* does something and then
carried unchanged for as far as that action reaches:

```text
AUP  mints it at the interaction boundary
 |    HTTP:  X-Auto-Pigeon-Correlation-Id: <id>
 v
AUB  reads the header, puts it on the job it schedules and on its own incidents
 |    job record: correlation_id
 v
AUE  reads it from the job it was handed

AUP  ---- Colyseus message field `correlationId` ---->  AUC
```

Every incident along that path carries it, and so does the GlitchTip event, as the tag
`correlation_id`. It encodes **nothing** — no user, no account, no map, no host, no timestamp —
because it is an unauthenticated value that will appear in public bug reports.

`correlationIdFromHeaders` reads it from a `Headers`, a plain object or node's `IncomingMessage`
headers, and treats a malformed value as absent rather than forwarding it.

## Redaction

`schema/redaction-rules.json` is the authority and `src/redact.mjs` is the reference reader, so a Go
implementation in AUB/AUE and a Python one in the tooling are *the same rules* rather than three
sincere transcriptions. Every pattern avoids lookaround and backreferences, so it compiles unchanged
in JavaScript, Go's RE2 and Python's `re`.

Three kinds of rule, applied in order:

| | rule | example |
| --- | --- | --- |
| 1 | **dropped keys** — exact key name, whole value gone, at any depth | `geometry`, `annotations`, `prefab`, `body`, `headers` |
| 2 | **denied key substrings** — value replaced | `auth`, `cookie`, `token`, `password`, `email`, `invite` |
| 3 | **value patterns** — over every surviving string | e-mail, JWT, `Bearer …`, `pb_auth=…`, URL user-info, absolute paths |

Two consequences worth stating outright, because both are load-bearing:

- `face_count` survives and `faces` does not. Dropped keys match **exactly** for that reason: the
  counter is evidence, the array is a map.
- **Nothing matches a bare 32-character hex string.** `incident_id` and `correlation_id` are exactly
  that shape, and a redacted record nobody can correlate is a record nobody can act on.

Order is part of the contract: `url-userinfo` runs before `email`, because
`https://key:secret@host/3` contains something the e-mail rule matches, and a credential removed by
the wrong rule is indistinguishable from correct until the day a URL has no password in it.

`test/redaction.test.mjs` proves all of it with **fake secrets** — invented for that file, valid
nowhere.

## Validation is on demand, and it returns

AULIBS rule 2.1. Nothing here runs on import, on construction or on a timer, and `validateIncident`
answers `{ valid, errors }` rather than throwing: an incident is usually reported from a path that
is *already* failing, and a validator that threw would turn a report about a bug into a second bug.

`src/validate.mjs` is a reader for the subset of JSON Schema the envelope uses, driven by the schema
file itself — adding a field needs no edit there. It is allowed to exist beside a real schema engine
only because `test/contract.test.mjs` runs **ajv** over the same 25 cases and fails if the two
disagree.

## The public bug target

`BUG_REPORT_URL` is `https://github.com/auto-pigeon/bug-reports/issues`, recorded once, here.
Nothing in this package opens it, submits to it or creates an issue: a report is something a person
chooses to send after reading exactly what it contains — which is what `toDiagnosticText` renders,
redacted, so the preview and the payload are the same string.

## Layout

```text
ts/incident-contract/
├── schema/
│   ├── incident-envelope-1.0.schema.json   the closed envelope — the authority
│   ├── incident-codes.json                 the canonical taxonomy
│   └── redaction-rules.json                the central redaction rules
├── src/
│   ├── index.mjs        the public surface
│   ├── index.d.ts       hand-written types (there is no build step)
│   ├── rules.mjs        loads the contract data; SCHEMA_VERSION, BUG_REPORT_URL
│   ├── codes.mjs        taxonomy lookups
│   ├── correlation.mjs  the correlation-id convention
│   ├── redact.mjs       central redaction
│   ├── validate.mjs     on-demand validation
│   └── envelope.mjs     createIncident, toSentryEvent, toDiagnosticText
└── test/
    ├── contract.test.mjs   schema, taxonomy, correlation, ajv parity
    └── redaction.test.mjs  fake secrets in, nothing out
```

Run it with `./run.sh test` from the repository root, or `npm test` here.
