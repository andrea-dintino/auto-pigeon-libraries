# Fixtures

Shared test fixtures for the packages in this repository. There are none yet —
these conventions were agreed before the first fixture arrived, precisely so
they hold from the first one rather than being retrofitted onto a pile.

## apmap only

Fixtures here are **apmap documents and nothing else**.

Other formats — `.map`, `.rmf`, and anything else the project reads or writes —
are import/export concerns. Their fixtures belong with their converters, in the
repository that owns the conversion, not here. A `.map` file in this folder
would be a fixture for code that does not live in this repository.

## Minimal and complete

A fixture is a **minimal, complete** apmap document: a handful of brushes in a
worldspawn, not a full level.

Both halves matter. *Minimal*, because a fixture is read by a human diagnosing a
failure, and a twenty-thousand-brush map cannot be read. *Complete*, because a
fragment that is not a valid document tests the library against something no
caller will ever hand it.

## CSG fixtures are named cases

Each CSG fixture is a **folder**, named for the case it exercises, holding
inputs plus the expected outputs for:

- **carve**, both directions — `A−B` and `B−A`; and
- **merge** — `A+B`.

Both for **single brushes** and for **brush groups**. A case covering only one
of those is a case that will pass while the other stays broken.

### Operand labeling — decision pending

Which brush is `A` and which is `B` has to be recorded somehow, and two
candidate conventions are on the table:

1. **Separate files per operand.** `a.apmap` and `b.apmap` in the case folder,
   with the expectations alongside. Unambiguous, and the operands are separable
   without parsing anything; costs one file per operand and makes "these two
   brushes in one scene" a thing you assemble rather than a thing you look at.
2. **Texture-coded markers.** One document holding both operands, with the role
   carried by each brush's texture. Reads as a single scene, which is how a user
   would actually build it; couples the fixture format to a texture convention
   the library then has to know about.

**This is being decided by HITL, empirically** — by building a case each way and
seeing which is more workable in practice, not by argument in advance. Until
that decision lands, do not standardise on either one silently. Both are
recorded here so the decision is made once and visibly.

## Expected-output comparison is geometric equivalence

Comparing a CSG result against its expected output means **geometric
equivalence, not identical decomposition**.

Two brush sets that describe the same solid are equal even when they are split
differently. A carve that produces three brushes where the fixture records four,
occupying exactly the same space, is a correct carve — not a failure, and not a
reason to re-record the fixture.

The comparison function itself is future AULIBS code and does not exist yet.
The convention is written down now anyway, because fixtures built against the
stricter bar — byte equality, or brush-count-and-order equality — would encode
one particular decomposition as the right answer and be wrong in a way that is
expensive to unpick later.
