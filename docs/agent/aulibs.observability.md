---
id: aulibs.observability
schema: aut-agent-module/1
repository: auto-pigeon-libraries
title: The observability doctrine binds, and a library does not log
authority:
  - aulibs-doctrine-application
  - aulibs-no-logging-transport
topics:
  - doctrine
  - observability
  - logging
  - transport
  - determinism
  - diagnosability
prerequisites:
  - aulibs.clock-table
---

# The observability doctrine binds, and a library does not log

<!-- Moved verbatim from AGENTS.md by NEW_246G_AUT_AUG_AUCOM_AUTEL_AULIBS_Remaining-Repository-Documentation-Modularization: line(s) 310-330 of the AGENTS.md at sha256 5431a0e7eea7acc0. This module is the ONE authoritative home for the rules below; the repository-root AGENTS.md routes to it and keeps no second copy. -->

## 10. The observability doctrine binds

`$MAPPER_ROOT/LLM/DOCTRINE.md` is this workspace's observability doctrine,
written out of `20260807_06` (AUP's manipulator flicker: four fixes proposed on
theory, all wrong; the fifth instrumented first and found the cause in the first
properly-read log). It is **binding here**, in full. Its seven pillars:
observation before theory; durations are evidence; log at transitions and
decisions, on change, with sequence counters, never per frame; the structured
observation request; the human's right to deny and the transfer of risk that
comes with recording the denial; artifacts flow both ways; handoffs are the case
law.

A library has a particular obligation under it. Code here runs inside somebody
else's timing budget, and when a consumer instruments a bug the trail may lead
into an AULIBS package — so a package that does anything with time, ordering, or
geometry must be diagnosable from the outside: deterministic, and honest about
what it did. **Do not add a logging transport to a library.** Each consumer
already has one (`DEV_MODE`, its own shape), and a library that logs on its own
lands lines in a file nobody attached. Return or expose what the consumer needs
in order to log it.
