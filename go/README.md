# Go packages

**Empty by design.** No Go package exists here yet, and none is scheduled. The
folder is present so that the first Go package has an obvious home and does not
land somewhere improvised.

When the first one arrives it follows the same rules as `ts/` — one folder per
package, each with its own `README.md` and its own `used-by.json` validating
against `../meta/used-by.schema.json`, and **no package without tests**.

Tests run through `go test ./...` from the repository root, which is what
`./run.sh test` invokes once a `go.mod` exists at the root. Until then the
launcher correctly reports that there is nothing to test.

`AGENTS.md` is the authority: §2 for the two product rules (validation is
on-demand only; every package declares its consumers), §3 for the `used-by.json`
protocol, §5 for how consumers depend on a package.
