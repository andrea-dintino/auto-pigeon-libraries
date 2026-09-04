// Three schemas that between them say one thing: a lighting rule is a MEASUREMENT with a
// vocabulary attached, and the two halves are separable. What is worth testing about a schema
// nobody generates code from is that it accepts what a correct producer publishes and refuses what
// a mistaken one publishes — and, here, that the generic half stays generic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(here, "..", "schema");
const gamesDir = join(here, "..", "..", "..", "games");

const schema = (name) => JSON.parse(readFileSync(join(schemaDir, name), "utf8"));

const ajv = new Ajv2020({ strict: false, allErrors: true });
const validateSemantics = ajv.compile(schema("lighting-semantics.schema.json"));
const validateAnalysis = ajv.compile(schema("lighting-analysis.schema.json"));
const validateValidation = ajv.compile(schema("lighting-validation.schema.json"));

const errors = (validator) => JSON.stringify(validator.errors);

// --------------------------------------------------------------- the shipped vocabularies

// Every game that ships a lighting vocabulary is validated here rather than only in the consumer.
// A document that reaches an extractor invalid has already cost a run.
const shippedVocabularies = readdirSync(gamesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    game: entry.name,
    path: join(gamesDir, entry.name, "lighting-semantics", "lighting.json"),
  }))
  .filter(({ path }) => {
    try {
      readFileSync(path);
      return true;
    } catch {
      return false;
    }
  });

test("at least one game ships a lighting vocabulary", () => {
  assert.ok(shippedVocabularies.length > 0, "no games/<game>/lighting-semantics/lighting.json found");
});

for (const { game, path } of shippedVocabularies) {
  test(`the ${game} lighting vocabulary validates`, () => {
    const document = JSON.parse(readFileSync(path, "utf8"));
    assert.ok(validateSemantics(document), errors(validateSemantics));
    assert.equal(document.game_id, game, "game_id must match the folder that carries it");
  });

  test(`the ${game} vocabulary says what it leaves out`, () => {
    const document = JSON.parse(readFileSync(path, "utf8"));
    // A vocabulary that lists no exclusions and declares no undeclared traits reads as complete,
    // and a consumer then treats every absent key as a value of zero rather than as unknown.
    assert.ok(document.provenance?.excludes, "provenance.excludes is how a vocabulary says what it is not");
  });
}

// --------------------------------------------------------------- the separation

// The whole reason there are two documents. A generic schema that named `light`, `_color` or
// `light_torch_small_walltorch` would be a Quake 1 schema wearing a general title, and the next
// game would need a second copy of it.
test("the generic schemas name no game's vocabulary", () => {
  const quake1Terms = [
    "light_torch",
    "light_flame",
    "light_fluoro",
    "light_globe",
    "_color",
    "quake",
    "worldspawn",
  ];
  for (const name of ["lighting-analysis.schema.json", "lighting-validation.schema.json"]) {
    const text = readFileSync(join(schemaDir, name), "utf8").toLowerCase();
    for (const term of quake1Terms) {
      assert.ok(!text.includes(term), `${name} names ${term}, which belongs in a per-game vocabulary`);
    }
  }
});

test("the analysis separates geometric traits from semantic ones, and requires both", () => {
  const required = schema("lighting-analysis.schema.json").properties.trait_vocabulary.required;
  assert.deepEqual([...required].sort(), ["geometric", "semantic"]);
});

// --------------------------------------------------------------- the analysis artifact

const analysisExample = () => ({
  schema: "auto-pigeon.lighting-analysis/1.0",
  kind: "recommendation",
  reviewed_by: "human",
  game_id: "quake1",
  semantics: {
    schema: "auto-pigeon.lighting-semantics/1.0",
    game_id: "quake1",
    source: "aulibs",
    digest: `sha256:${"a".repeat(64)}`,
    declared_traits: ["intensity", "style"],
    undeclared_traits: [{ trait: "colour", reason: "this game ships no per-light colour key" }],
  },
  settings: { min_samples: 8, min_maps: 2, region_cell: 128 },
  corpus: {
    maps_read: 2,
    maps_failed: 0,
    lights_seen: 40,
    lights_observed: 39,
    lights_excluded: 1,
    inputs: [{ logical: "a.map", sha256: "b".repeat(64), bytes: 1024, status: "read", lights: 20 }],
  },
  trait_vocabulary: {
    geometric: ["height_above_floor", "distance_to_nearest_wall"],
    semantic: ["intensity", "style_animated"],
  },
  distributions: {
    numeric: { height_above_floor: { samples: 39, min: 32, p10: 48, median: 64, p90: 96, max: 128 } },
    categorical: { fixture_family: { samples: 39, values: [{ value: "torch", count: 39 }] } },
  },
  templates: [
    {
      template_id: "quake1.torch.wall.corridor-like.0a1b2c3d",
      signature: {
        fixture_family: "torch",
        attachment: "wall",
        region_kind: "corridor_like",
        style_animated: false,
        switchable: false,
        height_band: 64,
      },
      samples: 12,
      maps: 2,
      support: 0.31,
      traits: { height_above_floor: { samples: 12, min: 56, p10: 64, median: 64, p90: 64, max: 72 } },
      uncertainty: { relative_spread: { height_above_floor: 0 }, map_concentration: 0.58, notes: [] },
      evidence: { maps: ["a.map", "b.map"] },
    },
  ],
  exclusions: [{ reason: "below_min_samples", observations: 27, groups: 9 }],
  uncertainty: {
    templates_published: 1,
    observations_covered: 12,
    coverage: 0.31,
    notes: ["one template carries most of its samples from a single map"],
  },
});

test("a complete analysis document is accepted", () => {
  assert.ok(validateAnalysis(analysisExample()), errors(validateAnalysis));
});

test("an analysis document is a recommendation and cannot say otherwise", () => {
  const instruction = analysisExample();
  instruction.kind = "instruction";
  assert.ok(!validateAnalysis(instruction));
});

test("an analysis document is closed: no model, no weights, no host path", () => {
  for (const extra of [
    { model_path: "/home/someone/models/lighting.pt" },
    { weights: [0.1, 0.2] },
    { corpus_root: "/home/someone/mapper/sources/quake1" },
  ]) {
    assert.ok(!validateAnalysis({ ...analysisExample(), ...extra }), `${JSON.stringify(extra)} was accepted`);
  }
});

test("an input names a logical file, never a path", () => {
  const document = analysisExample();
  document.corpus.inputs[0].logical = "/home/someone/mapper/sources/quake1/a.map";
  assert.ok(!validateAnalysis(document));
});

test("exclusions and uncertainty are required, because silence about them reads as none", () => {
  for (const member of ["exclusions", "uncertainty", "distributions", "corpus", "semantics"]) {
    const document = analysisExample();
    delete document[member];
    assert.ok(!validateAnalysis(document), `${member} was optional`);
  }
});

test("a template carries its own sample and map counts and its own evidence", () => {
  for (const member of ["samples", "maps", "support", "uncertainty", "evidence", "signature"]) {
    const document = analysisExample();
    delete document.templates[0][member];
    assert.ok(!validateAnalysis(document), `template.${member} was optional`);
  }
});

test("a template inferred from one occurrence is not expressible", () => {
  const document = analysisExample();
  document.templates[0].samples = 0;
  assert.ok(!validateAnalysis(document));
});

// --------------------------------------------------------------- the validation artifact

const validationExample = () => ({
  schema: "auto-pigeon.lighting-validation/1.0",
  analysis_digest: `sha256:${"c".repeat(64)}`,
  held_out: [{ logical: "holdout-hall.map", sha256: "d".repeat(64), regions: 3, authored_lights: 6 }],
  proposals: {
    total: 9,
    by_template: [
      { template_id: "quake1.torch.wall.corridor-like.0a1b2c3d", proposals: 9, valid: 8, collisions: 1 },
    ],
  },
  placement: {
    proposals: 9,
    valid: 8,
    validity: 0.888,
    collisions: 1,
    collision_rate: 0.111,
    refusals: [{ reason: "inside_solid", count: 1 }],
  },
  illumination_proxy: {
    method: "floor samples within the template intensity radius, unobstructed",
    sample_spacing: 64,
    floor_samples: 120,
    covered: 96,
    coverage: 0.8,
    authored_coverage: 0.92,
  },
  authored_agreement: { authored: 6, matched: 4, recall: 0.666, tolerance: 64 },
  false_semantic_assumptions: [
    {
      template_id: "quake1.torch.wall.corridor-like.0a1b2c3d",
      assumption: "wall_attachment",
      reason: "no wall within the attachment radius of the proposed position",
      occurrences: 1,
    },
  ],
  notes: [],
});

test("a complete validation document is accepted", () => {
  assert.ok(validateValidation(validationExample()), errors(validateValidation));
});

test("the illumination proxy must report the authored baseline beside its own figure", () => {
  const document = validationExample();
  delete document.illumination_proxy.authored_coverage;
  assert.ok(!validateValidation(document), "a proxy coverage with nothing to compare against is not a result");
});

test("the four measurements are each required, so none can be quietly dropped", () => {
  for (const member of [
    "placement",
    "illumination_proxy",
    "authored_agreement",
    "false_semantic_assumptions",
  ]) {
    const document = validationExample();
    delete document[member];
    assert.ok(!validateValidation(document), `${member} was optional`);
  }
});

test("a refusal is named, not scored", () => {
  const document = validationExample();
  document.placement.refusals = [{ reason: "Inside Solid", count: 1 }];
  assert.ok(!validateValidation(document), "a refusal reason must be a stable identifier");
});
