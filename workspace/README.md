# The Auto-Pigeon workspace manifest

`auto-pigeon-workspace.json` names the repositories that make up an Auto-Pigeon workspace: their
aliases, their directory names, and where to clone them from. It validates against
`auto-pigeon-workspace.schema.json` beside it, and the `ts/apmap-schema` test run checks it.

## Why it lives here

The repository list used to exist three times: in `clone-auto-pigeon-stack.sh`, in
`pull-auto-pigeon-stack.sh`, and in a `workspace.json` at the workspace root. The root file was
removed because it had gone stale in the worst possible way — it listed `ai-mapcopilot`, which is
legacy, and omitted `auto-pigeon-gallery` and `auto-pigeon-extractor`, two repositories the launcher
actually needs. A list that names the wrong repositories is worse than no list, because it certifies
a layout nobody checked.

So the list lives in a repository that is cloned, reviewed and tested like any other. It is here
rather than at the workspace root because a workspace root is a directory on somebody's disk: it has
no git history, no review, and no test. **Do not reintroduce a loose root-level workspace metadata
file.**

## Membership is a product decision, not a directory listing

This file answers **what this project is made of**, never **what happens to be checked out on this
machine**. The two are different questions and the agent tooling asks both, so it keeps them apart:

- `auto-pigeon-tools/scripts/repo_registry.py` discovers every local checkout carrying an
  `.agent-repo.json`, and that is what an **explicitly named** queue resolves through — including a
  repository this manifest has never named.
- This manifest, in its order, is what an **unfiltered** report and a bare whole-workspace drain
  mean. A repository is in the default set because it was added here on purpose.

`AUCOM` (`auto-pigeon-companion`) joined at `20260906_120V`. `auto-pigeon-launcher` (AUL) is being
merged into and superseded by it, and `ai-mapcopilot` (AIM) is legacy: both stay OUT of this list
while remaining addressable by alias for as long as their checkouts exist. Adding a retiring
repository here would put it into every clone, every pull and every drain.

Order is presentational and the schema says so — but it is stable, and the tests assert it, because
a generated alias table and a drain plan have to read the same on every machine.

## What it deliberately does not contain

- **Machine paths.** No `/home/...`, no absolute anything. `directory` is a bare name.
- **`$MAPPER_ROOT`.** The data root is per-machine and is not a repository.
- **The APMap schema path.** That is derived from this manifest by `auto-pigeon-tools`
  (`<workspace>/auto-pigeon-libraries/ts/apmap-schema/schema`) and passed to each service
  explicitly. Services never search for it.
- **Ports, hostnames, addresses, secrets.** Per-component `.env`; this repository is public.

`additionalProperties` is `false` at every level, so a well-meaning addition fails validation rather
than quietly becoming a contract.

## Consumers

| consumer | what it reads |
| --- | --- |
| `auto-pigeon-tools/scripts/agent_task.py` | workspace topology — where each repository is, and its alias |
| `auto-pigeon-tools/scripts/workspace_paths.py` | the same, plus the derived AULIBS schema directory |
| `auto-pigeon-tools/clone-auto-pigeon-stack.sh` | what to clone, after bootstrapping this repository |
| `auto-pigeon-tools/pull-auto-pigeon-stack.sh` | what to pull |

The clone script hard-codes exactly one URL — this repository's — because the manifest cannot be
read before the repository holding it exists. That single bootstrap constant is the whole of the
duplication that remains.

## Changing it

Adding or removing a repository is a change to this file and nothing else. The AUT tests prove it:
they point the tools at a fixture manifest and assert clone and pull follow it, with the shell
scripts asserted byte-identical throughout.
