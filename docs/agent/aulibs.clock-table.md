---
id: aulibs.clock-table
schema: aut-agent-module/1
repository: auto-pigeon-libraries
title: The AULIBS clock table (doctrine pillar 2)
authority:
  - aulibs-clock-table
topics:
  - timing
  - budget
  - clock
  - benchmark
  - measurement
  - performance
  - cache
paths:
  - ts/offline-workspace-contract/**
---

# The AULIBS clock table (doctrine pillar 2)

<!-- Moved verbatim from AGENTS.md by NEW_246G_AUT_AUG_AUCOM_AUTEL_AULIBS_Remaining-Repository-Documentation-Modularization: line(s) 331-357 of the AGENTS.md at sha256 5431a0e7eea7acc0. This module is the ONE authoritative home for the rules below; the repository-root AGENTS.md routes to it and keeps no second copy. -->

### AULIBS clock table (doctrine pillar 2)

The first package with a characteristic time of its own is
`ts/offline-workspace-contract`, whose `validateEntity` is a validation sweep a
consumer may call on a save path. Measured on this machine under Node 24,
`node --test` warm, 20 000 iterations per case (`AULIBS`, `AUP 151`):

| operation | measured | what it is |
| --- | --- | --- |
| `can(role, capability)` | **0.02 µs** | one `Set.has` behind two map lookups. An authorization check is free; nothing needs to cache one. |
| `canTransition(machine, from, event)` | **0.17 µs** | a linear scan of one machine's transitions. Ten times `can`, still nothing. |
| `validateEntity("asset_edit_lease", …)` | **7.1 µs** | the reference validator over a 15-field entity — the number that matters, because it is the one a consumer might put on a save path. |
| `validateEntity("dependency_manifest", …)` | **9.8 µs** | the same, over a manifest with two dependency entries. |
| full 92-cell capability sweep | **57 µs** | every role against every capability, which is what rendering a whole permissions table costs. |
| full 199-cell transition sweep | **272 µs** | every machine, state and event. |
| module load, all six documents | **0.74 ms** | once, at import. |

Read as a budget: validating every entity in a 200-asset workspace listing is
about **2 ms**, and a consumer that finds validation expensive is validating in a
loop it did not mean to write rather than meeting a cost this package imposes.
None of these numbers justifies a cache, and a cache over a frozen contract would
be the wrong thing to add.

The next package with a time of its own — a codec pass, anything a consumer will
sit inside a frame budget for — records it here, in the task that introduces it,
alongside the consumer and map size it was measured against.
