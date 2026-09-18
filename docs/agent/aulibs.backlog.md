---
id: aulibs.backlog
schema: aut-agent-module/1
repository: auto-pigeon-libraries
title: The backlog — where deferred work lives
authority:
  - aulibs-backlog-duties
topics:
  - backlog
  - deferred-work
  - deferral
  - follow-up
  - next-task
---

# The backlog — where deferred work lives

<!-- Moved verbatim from AGENTS.md by NEW_246G_AUT_AUG_AUCOM_AUTEL_AULIBS_Remaining-Repository-Documentation-Modularization: line(s) 58-90 of the AGENTS.md at sha256 5431a0e7eea7acc0. This module is the ONE authoritative home for the rules below; the repository-root AGENTS.md routes to it and keeps no second copy. -->

## 0a. The backlog — where deferred work lives

`$MAPPER_ROOT/LLM/backlog/` holds deferred work. Unlike handoffs, which are
immutable case law (`DOCTRINE.md` pillar 7, see §10), the backlog is **mutable
by design**, and order within a file is priority: top = sooner. This repo's file
would be `backlog/auto-pigeon-libraries.md` — as of 2026-08-08 it does not exist
yet, because nothing has been deferred here; the first deferral creates it.
Items spanning repos live in `backlog/workspace.md`, and `backlog/README.md` is
the authority on the rules, deliberately not restated here.

- **Read it at task start, alongside the prompt.** An entry may be the very thing
  the current prompt supersedes — in which case see the deletion duty below — or
  context this task must not contradict. Read `backlog/workspace.md` too: a
  cross-repo item is more likely to concern a shared library than a
  single-consumer entry is. Before recommending follow-up work in a handoff,
  check the backlog so the recommendation extends an entry instead of duplicating
  it.
- **Duty: append on deferral.** A handoff that defers work adds the entry in the
  *same* task — a title, then one to three sentences, enough for a fresh agent
  with no conversational context to write the prompt from, ending with the
  originating handoff's filename as pointer. This extends the `Next Recommended
  Task` discipline rather than replacing it: that section names the next step,
  the backlog entry preserves it beyond the handoff's readership.
- **Duty: delete on adoption.** Whoever files a prompt covering an entry removes
  that entry in the same change — the prompt file becomes the tracker. An agent
  executing a prompt that plainly covers a still-present entry deletes it as part
  of the task and says so in the handoff.
- **What agents never do:** reorder entries, change priorities, or edit another
  repo's backlog file beyond those two duties. Ordering is HITL's. This matters
  more here than elsewhere: agents from every consumer repo have write access to
  this repository (§3, §5), but that access has never extended to writing another
  repo's backlog entries, and does not now.
