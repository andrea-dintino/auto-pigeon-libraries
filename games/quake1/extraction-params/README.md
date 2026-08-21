# `games/quake1/extraction-params`

Canonical extraction parameters for Quake 1 — the values a geometry extractor
needs in order to decide what a *player* can do with a piece of geometry, as
opposed to what the geometry is.

## `walkability.json`

The player hull and the maximum step height, in world units.

```json
{
  "schema": "auto-pigeon.walkability-params/1.0",
  "game_id": "quake1",
  "units": "world_units",
  "player_hull": { "width": 32, "depth": 32, "standing_height": 56 },
  "max_step_height": 18
}
```

### Why this is here and not in the extractor

A stair is only a stair because a player can climb it, so an extractor has to
know how wide the player is, how tall they stand, and how high they can step.
Those are **game parameters**, not extractor constants: the same algorithm
applied to a different game — or to a mod with a different hull — needs
different numbers, and an extractor that compiles them in cannot be told
otherwise.

### Precedence, and why this file is a *fallback*

Auto-Pigeon Backend will eventually send the effective Game Profile values with
each extraction request. When it does, those win **whole**:

```text
request.extraction_params.walkability   >   this file
```

The override is atomic — whole object or fallback, never a field-by-field
merge — so a caller that sends a partial object gets a refusal rather than a
silent hybrid profile made half of its values and half of these.

This file is therefore **temporary product configuration**: it is what the
stack runs on until Game Profiles carry these values, and it is deliberately the
only place the numbers appear. A consumer that hard-codes `32` or `18` anywhere
else has reintroduced exactly the problem this file exists to remove.

### Slope

There is deliberately **no** walkable-normal or slope field here. Surface-normal
semantics already live in the consumers' own game-profile code, and duplicating
them would create two answers to one question. A later revision of the schema
can add one if product configuration needs it.

### Changing it

Read `used-by.json` first, and see the repository `AGENTS.md` §3 — the numbers
here change what downstream extractors accept as walkable, so a change is a
behavioural change in every consumer.
