---
id: aulibs.incidents
schema: aut-agent-module/1
repository: auto-pigeon-libraries
title: Incident observability — AULIBS owns the contract and nothing else
authority:
  - aulibs-incident-contract-ownership
  - aulibs-incident-change-rules
topics:
  - incidents
  - glitchtip
  - correlation
  - redaction
  - envelope
  - taxonomy
  - codes
  - schema
  - ajv
paths:
  - ts/incident-contract/**
---

# Incident observability — AULIBS owns the contract and nothing else

<!-- Moved verbatim from AGENTS.md by NEW_246G_AUT_AUG_AUCOM_AUTEL_AULIBS_Remaining-Repository-Documentation-Modularization: line(s) 358-427 of the AGENTS.md at sha256 5431a0e7eea7acc0. This module is the ONE authoritative home for the rules below; the repository-root AGENTS.md routes to it and keeps no second copy. -->

## Incident observability

Every user-impacting failure in this workspace is reported in **one shape**, with **one taxonomy of
codes**, carrying **one correlation id**, cleaned by **one set of redaction rules**. All four live
in `auto-pigeon-libraries/ts/incident-contract`, and none of them is restated here on purpose: a
contract copied into seven files is seven contracts that agree until the day they do not.

| what | where |
| --- | --- |
| the envelope, the codes, the correlation convention, redaction | `auto-pigeon-libraries/ts/incident-contract/` (schema + `README.md`) |
| the backend | self-hosted **GlitchTip** (MIT), pinned by tag AND digest in `auto-pigeon-tools/docker-compose.glitchtip.yml` |
| its lifecycle | `auto-pigeon-tools/launch-aup.sh` starts and stops it in every mode, offset-namespaced like everything else |
| the DSN this stack issued | `<mapper-root>/runtime/auto-pigeon-observability/stack[-N]/instance.env`, and `./launch-aup.sh --print-config` |
| the acceptance | `auto-pigeon-tools/scripts/aup/observability-smoke.sh` |
| the public bug target | `https://github.com/auto-pigeon/bug-reports/issues` — nothing auto-files there |

**GlitchTip does not replace Gatus and must not duplicate it.** PREPROD-05 gave uptime and health
to Gatus, and that stands. Gatus answers *is this component up, and is it serving the version it
should be*; GlitchTip answers *what went wrong for a person, and what was true when it did*.

**Sentry-compatible SDKs point at the self-hosted GlitchTip and never at sentry.io.** The SDKs
themselves (`@sentry/node`, `sentry-go`, `sentry-sdk`) are MIT and are used as clients; the server
is ours.

### What binds every change here

1. **A new user-impacting error path maps to a canonical incident code, or ADDS one to
   `incident-codes.json`.** A failure string invented at a call site is exactly what the taxonomy
   exists to prevent — it makes *"which errors does this product have"* a question you answer by
   reading six repositories.
2. **Propagate the correlation id.** Read it from the request, put it on every outbound request,
   job and message, and put it on every incident raised along the way.
   `X-Auto-Pigeon-Correlation-Id` over HTTP; `correlationId` on a Colyseus message and on an AUB
   job record. A malformed value is treated as absent, never forwarded — a component that forwards
   whatever it was sent turns one client's typo into a value three services then record.
3. **Say something true to the user.** A real reason, and a real action where one exists. Never a
   generic *"something went wrong"*, never an invented suggestion, and — when the honest answer is
   that the cause is unknown — say that instead of guessing.
4. **Emit telemetry when it is available, and carry on when it is not.** The backend being down is
   `reporting.telemetry_unavailable`: recorded locally, never escalated to the user, and never able
   to fail a request, a render or a launch. **Nothing in the product may depend on the incident
   backend.** An error backend that can break the thing it observes is a component that causes
   outages instead of explaining them.
5. **Never leak.** No auth headers, cookies, passwords, invitation tokens, e-mail addresses,
   private APMap geometry, annotation or chat text, private prefab contents, or absolute local
   paths. The envelope is closed and central redaction runs on the way out — but the usual way this
   gets undone is an SDK's DEFAULT INTEGRATIONS, which attach environment variables, argv, hostnames
   and local file paths. Turn them off deliberately and say why.
6. **Do not swallow an error into a console-only log.** If a person is affected, it is an incident.
7. **A new expensive operation is TIMED**, and the duration goes in `duration_ms`. Doctrine pillar
   2: a message without a duration is an opinion.
8. **A critical new path gets failure-injection and stress coverage in the same task.** Reports go
   to `$MAPPER_ROOT/LLM/stress-reports/<run-id>/`; the scaffold and the machine-fact capture are
   `auto-pigeon-tools/scripts/stress_report.py`.

### In this repository

AULIBS **owns** the contract — `ts/incident-contract/` — and owns nothing else about incidents. It
has no DSN, no SDK, no transport and no opinion about where events go, exactly as §1 requires: this
repository ships libraries and is not a service.

Two rules apply with full force to any change there. `used-by.json` protocol (§3): read it, inspect
every listed consumer, grep the siblings for consumers it missed, and report what was checked.
Validation on demand (§2.1): `validateIncident` returns `{ valid, errors }` and never throws, because
an incident is usually reported from a path that is already failing and a validator that threw would
turn a report about a bug into a second bug.

Widening the envelope, the taxonomy or the redaction rules means editing the JSON *and* its tests.
`src/validate.mjs` is allowed to exist beside a real schema engine only because `test/contract.test.mjs`
runs **ajv** over the same cases and fails if the two disagree.
