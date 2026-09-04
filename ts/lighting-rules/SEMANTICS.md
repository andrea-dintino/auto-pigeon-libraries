# Lighting rules — normative semantics

What each document means, and which half of it belongs to whom.

## 1. Two kinds of trait, and the line between them

A **geometric trait** is measured from the map's solids and the light's
position. It requires no vocabulary, means the same in every engine, and a
producer computes it with the same code for every game:

```text
height_above_floor        distance_to_ceiling      distance_to_nearest_wall
attachment_surface        nearest_sibling_distance region_kind
enclosure                 region_extent
```

A **semantic trait** is read through the game's own lighting vocabulary. It is
a property key with a meaning, and no amount of geometry produces it:

```text
intensity   style / style_animated   switchable   targeted   yaw
fixture_family   renders   colour   surface_intent
```

**A producer must not invent a semantic trait from geometry.** Whether a light
is "surface-like" is a question about the engine's light model, not about the
brush it sits near; a game whose vocabulary declares no surface mechanism has
no surface-like lights, and a rule that claims otherwise is a false semantic
assumption — which is a named, counted outcome in `lighting-validation`, not a
silent one.

## 2. Absent is unknown, never zero

A vocabulary that declares no `colour` key does not mean every light is white.
It means colour is **unknown**, and the two are different in the one way that
matters: a producer may publish a rule about a trait it measured, and may not
publish one about a trait it never had access to.

`undeclared_traits` is how a vocabulary says this out loud. Omission would say
it too, but silently, and silence is what a later reader interprets as a
default.

## 3. Defaults are recorded as defaults

Where a vocabulary declares a `default`, a light with no such key still has the
trait — but a `numeric_distribution` splits `declared` from `defaulted`. A
median intensity of 300 over a corpus where four fifths of the entities never
declared one is a fact about the default, not about the authors.

## 4. Evidence, and what makes a template

A **template** is a group of observations that share a signature, published only
when the group is large enough and spread over enough maps for the producer's
own declared thresholds — both of which appear in `settings`, beside the
templates they produced. A threshold that decided a membership and is not
serialized is a magic number.

Every template carries:

- `samples` and `maps` — how much evidence, and how concentrated;
- `traits` — a distribution per trait, never a single value, because a rule
  quoted as one number cannot be told from a rule with no spread;
- `uncertainty.map_concentration` — the share of the samples from the single
  commonest map. Near 1 means one level by one author, and a reader should
  treat it as an observation rather than a pattern;
- `evidence.maps` — which maps, by logical name.

There is deliberately **no single score**. Five sub-scores collapsed into one
number is a threshold nobody can decompose and therefore nobody can tune; the
same reasoning as the extractor's own comparison layers.

## 5. Exclusions are part of the result

A group that failed a threshold is reported by reason and count. A candidate
that disappears is indistinguishable from one the producer never found, and the
difference is exactly what a reviewer needs in order to decide whether a
threshold is set correctly.

## 6. Validation is four measurements that fail separately

`placement`, `illumination_proxy`, `authored_agreement` and
`false_semantic_assumptions`. Pooling them into one score would report "placement
perfect, nothing lit" as "mostly working".

The illumination figure is a **proxy** and is named one: a distance-and-occlusion
test over floor samples. It is not a light compile, and it is comparable only
against the same proxy run over the map's own authored lights — which is why
`authored_coverage` sits beside it and is required.

## 7. The producer is not this repository

Nothing here infers anything. These are schemas; the inference, the corpus and
the thresholds belong to the consumer, and the consumer names its own
thresholds in `settings`. That is what lets a second producer — a different
extractor, a different game — publish a document a reader can compare against
the first.

## 8. Nothing here is training material

`kind` is the constant `recommendation` and the document is closed. There is no
member for a model, a weight, a checkpoint or an upload target, and the schema
refuses one if it is added. A lighting analysis is read by a person who decides
what to do with it.
