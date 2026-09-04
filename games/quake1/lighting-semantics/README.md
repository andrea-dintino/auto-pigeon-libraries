# `games/quake1/lighting-semantics`

What a Quake 1 light entity's properties **mean**. Not how bright a room should
be, and not where a light belongs — those are inferred by a consumer, from
geometry, and they are the same algorithm in every game.

This file is the other half: the part that is different in every game and that
an extractor must never guess.

## `lighting.json`

```json
{
  "schema": "auto-pigeon.lighting-semantics/1.0",
  "game_id": "quake1",
  "units": "world_units",
  "fixtures": [{ "classname": "light_torch_small_walltorch", "family": "torch",
                 "renders": true, "mount_declared_by_classname": "wall" }],
  "keys": { "intensity": { "key": "light", "kind": "number", "default": 300 } },
  "undeclared_traits": [{ "trait": "colour", "reason": "..." }]
}
```

It validates against
[`ts/lighting-rules/schema/lighting-semantics.schema.json`](../../../ts/lighting-rules/),
which is the game-independent shape. This file is the Quake 1 instance of it.

### Why the two are separate

*"A light 64 units above the floor, 16 from a wall, every 256 units along a
corridor"* is a **geometric** rule and it is true whatever engine reads the map.
*"`light` is the intensity key, its default is 300, and a `light_torch_small_walltorch`
is a wall torch"* is **Quake 1**, and none of it is derivable from the geometry.

An extractor that compiled the second half in could not be pointed at another
game, and — worse — could not be corrected when an operator's own project
disagrees. So the geometry lives in the consumer's algorithm, the vocabulary
lives here, and a Game Profile that carries its own lighting semantics overrides
this file **whole**:

```text
request lighting semantics   >   this file
```

The override is atomic, for the reason `extraction-params` gives: a
field-by-field merge produces a hybrid vocabulary that is half the operator's
and half id's, and nobody can tell which half answered.

## What is deliberately **not** here

Every light-compiler extension. Quake 1's shipped vocabulary has no `_color`, no
`delay`, no `wait`, no surface-light mechanism, and no attenuation formula — a
light compiler adds those, different compilers add different ones, and this file
is not the place they enter the stack. They arrive with the **Game Profile**, or
with an operator-supplied semantics document, or not at all.

`undeclared_traits` is how that is said out loud rather than by omission. A
consumer reading this file learns that colour is *unknown*, which is a different
statement from white, and it can report a template that claims a colour as a
false semantic assumption instead of publishing it.

## Provenance

The fixture table is the set of light classnames that appear in id Software's own
shipped `.map` sources — eight of them, over 8,127 light entities in 38 maps. The
`family` is the reading of the classname; `mount_declared_by_classname` is set
only where the classname itself says so, which is `walltorch` and nothing else.
Where a fixture stands is **measured** by the consumer, and a measurement that
disagrees with a declaration is evidence rather than an error.

## Changing it

Read `used-by.json` first, and see the repository `AGENTS.md` §3. A change here
changes what a consumer calls a light and what it thinks its properties mean, so
it is a behavioural change in every consumer.
