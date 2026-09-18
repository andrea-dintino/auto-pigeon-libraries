---
id: aulibs.used-by
schema: aut-agent-module/1
repository: auto-pigeon-libraries
title: Every package declares its consumers, and the used-by.json protocol has two halves
authority:
  - aulibs-used-by-declaration
  - aulibs-used-by-protocol
  - aulibs-consumer-audit
topics:
  - used-by
  - consumers
  - protocol
  - adoption
  - audit
  - cross-repository
  - manifest
  - breaking-change
paths:
  - meta/used-by.schema.json
  - ts/**
  - go/**
---

# Every package declares its consumers, and the used-by.json protocol has two halves

<!-- Moved verbatim from AGENTS.md by NEW_246G_AUT_AUG_AUCOM_AUTEL_AULIBS_Remaining-Repository-Documentation-Modularization: line(s) 136-140, 141-177 of the AGENTS.md at sha256 5431a0e7eea7acc0. This module is the ONE authoritative home for the rules below; the repository-root AGENTS.md routes to it and keeps no second copy. -->

### 2.2 Every package declares its consumers

Each package folder carries a `used-by.json` naming the repositories that use
it. See §3 for the protocol that makes the file worth having.


## 3. The `used-by.json` protocol

Both halves are obligatory. The file is worthless if either is skipped: half (b)
is what keeps it accurate, half (a) is what makes it useful.

### (a) Changing a package here

An agent that adds to or changes a package in this repository must, **before**
making the change:

1. Read that package's `used-by.json`.
2. Inspect every listed consumer. Sibling repositories are readable; go and look
   at how they actually call the thing being changed.
3. Grep the siblings for usage the manifest may have missed — a consumer that
   adopted the package without updating the file, or a call site added after the
   entry was written. The manifest is a starting point, not an authority.
4. State in the handoff **which consumers were checked and how** — the repos
   inspected, the greps run, and what was found. "Checked the consumers" is not
   a handoff entry; the commands and their results are.

A change that breaks a listed consumer is not forbidden — it is *reportable*.
Say what breaks and where, so the consuming repo's next prompt can be written.

### (b) Adopting a package from a consumer repo

An agent working in a consumer repository that starts using an AULIBS package
must add its repository to that package's `used-by.json`:

```json
{ "repo": "auto-pigeon", "usage": "one line on what it uses this for", "added": "2026-08-06" }
```

**This is the one sanctioned cross-repository write into AULIBS from
elsewhere, and it is limited to that single file.** It does not extend to any
other file in this repository, and it does not turn AULIBS into a mutation
target for the rest of that task.
