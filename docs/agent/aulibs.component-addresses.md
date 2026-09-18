---
id: aulibs.component-addresses
schema: aut-agent-module/1
repository: auto-pigeon-libraries
title: Component addresses live in .env, never in code
authority:
  - aulibs.component-addresses
topics:
  - addresses
  - env
  - configuration
  - ports
  - localhost
  - port-contract
  - public-repository
authority_elsewhere:
  - component-addresses-in-env
  - port-contract-9190
---

# Component addresses live in .env, never in code

<!-- REPLACES AGENTS.md line(s) 265-309 (sha256 5431a0e7eea7acc0) by NEW_246G_AUT_AUG_AUCOM_AUTEL_AULIBS_Remaining-Repository-Documentation-Modularization. Not moved verbatim, deliberately: those forty-five lines were a BYTE-IDENTICAL second copy of a workspace-root section, and this module is a POINTER at that authority — with the one thing that is genuinely different here, which is that a public library has no .env to move an address into. -->

This rule is **not restated here**, and that is the repair rather than an omission.

`AGENTS.md` §9 held it as a second copy of the workspace-root `mapper-code/AGENTS.md` section of
the same name. Measured by `NEW_246G_AULIBS`: `diff` of §9 against that section reported **no
difference at all** — forty-five identical lines. Every word of the prohibition, the `20260807_02`
incident it came from, the `.env` remedy, the stop-and-ask, the one permitted derivation and what a
missing address must say was already in the authority, unchanged.

The authority is:

```text
mapper-code/AGENTS.md  ##  Component addresses live in `.env`, never in code
mapper-code/AGENTS.md  ##  The AUB port contract — 9190
```

**Every AULIBS session already loads both.** Claude Code resolves `CLAUDE.md` up the directory
hierarchy, `mapper-code/CLAUDE.md` is `@AGENTS.md` on line 1, and `AUT 246A` proved both edges for
this repository. Codex discovers the same ancestor `AGENTS.md` by its own documented rule. So the
rule is in front of every agent working here whether or not this repository repeats it, and the
only thing repeating it bought was a second place for it to drift.

What binds an AULIBS change is stricter than the workspace rule rather than looser, and the reason
is §1: **this repository is public.** A library has no `.env` of its own — it is not a service, it
has no runtime and it owns no data — so an address in a package here could only ever be a compiled
one. There is nowhere for it to be configuration. No `localhost`, no `127.0.0.1`, no `192.168.*`,
no port, no internal hostname and no reference to private infrastructure goes into committed
content, in source, in a fixture, in a test or in a README; a consumer passes in what it already
knows. `ts/incident-contract` is the case to keep in mind: it defines the envelope and the
redaction rules and holds **no DSN and no transport**, exactly because where events go is the
consumer's configuration and never a library's constant.

The **AUB port contract** is in the same workspace-root file: `9190` is the host-facing AUB
endpoint, `8666` is AUB's container port, and `8090` is **PocketBase's** framework default and
never Auto-Pigeon's. A package here has no business asserting any of the three.

**Do not copy either section back into this repository.**
`../auto-pigeon-tools/scripts/agent_context_router.py gate --repo-root "$PWD"` fails a change that
declares one stable rule id authoritative in two live files, and this pointer is what keeps that
check honest for this rule.
