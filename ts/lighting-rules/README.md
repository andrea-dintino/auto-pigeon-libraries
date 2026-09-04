# `@auto-pigeon/lighting-rules`

The contract for **inferred lighting rules**: three schemas, no code.

| schema | what it describes |
| --- | --- |
| [`lighting-semantics`](schema/lighting-semantics.schema.json) | the shape of one game's lighting vocabulary — which classnames are lights, which key carries which trait, and which traits the game has no key for at all. The per-game instances live at `games/<game>/lighting-semantics/lighting.json`. |
| [`lighting-analysis`](schema/lighting-analysis.schema.json) | the versioned analysis a producer publishes: corpus provenance, trait distributions, inferred templates with sample counts, exclusions, and uncertainty. |
| [`lighting-validation`](schema/lighting-validation.schema.json) | what happened when those templates were applied to maps the inference never saw. |

## The separation this package exists for

> *"A wall torch 64 units above the floor, 16 out from the wall, roughly every
> 256 units along a corridor."*

Half of that sentence is geometry and half of it is Quake 1.

The geometry — **height above floor, distance to a wall, spacing along a
region** — is measured from the map, means the same thing in every engine, and
is the producer's algorithm. The vocabulary — **`light_torch_small_walltorch` is
a wall torch, `light` is the intensity key, its default is 300** — is not
derivable from any map and is different in every game.

So `lighting-analysis` carries `trait_vocabulary.geometric` and
`trait_vocabulary.semantic` as two required lists, and the vocabulary itself is
a separate document under `games/`. A test in this package asserts the generic
schemas name no game's classnames or keys, because the easy failure is a
"general" schema that is quietly one game's schema with a general title.

See [`SEMANTICS.md`](SEMANTICS.md) for the normative statement.

## Three things the analysis schema refuses on purpose

- **`kind` is the constant `recommendation`.** The document is read by a human
  who decides what to do with it. A schema that could also express an
  instruction would eventually be handed to something that applied one.
- **No model, no weights, no host path.** The document is closed
  (`additionalProperties: false` throughout), `logical` filenames are patterned
  to reject a path, and there is nowhere to put a checkpoint. This is an
  explainable analysis or it is nothing.
- **`exclusions` and `uncertainty` are required.** A run that published four
  confident templates and said nothing about the ninety groups it refused has
  published a filtered view and called it a finding.

## Using it

```js
import Ajv2020 from "ajv/dist/2020.js";
import analysisSchema from "@auto-pigeon/lighting-rules/analysis" with { type: "json" };

const validate = new Ajv2020({ strict: false }).compile(analysisSchema);
if (!validate(document)) console.error(validate.errors);
```

Go consumers read the same files off disk — `auto-pigeon-extractor` validates
both the vocabulary it loads and the artifacts it writes against these schemas
in its own test suite, which is what keeps the shipped documents and this
contract from drifting apart.

## Tests

```bash
npm test          # from this folder
./run.sh test     # from the repository root, every package
```

They validate every `games/<game>/lighting-semantics/lighting.json` this
repository ships, so a vocabulary added later is checked here and not only in
whatever consumed it first.
