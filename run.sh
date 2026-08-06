#!/usr/bin/env bash
# Test entrypoint for auto-pigeon-libraries.
#
# `./run.sh test` is the contract, matching the siblings. This repository ships libraries and has
# no service to start, so `test` is the whole of it for now.
#
# With no packages present the command succeeds and says there is nothing to test. That is
# deliberate and is neither of the two easy wrong answers: it does not fail (an empty repository is
# a valid state, not a broken one), and it does not print a green summary implying a suite ran.
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$ROOT_DIR"

usage() {
    echo "Usage: ./run.sh test" >&2
}

run_ts_packages() {
    local found=0 status=0 pkg name
    for pkg in ts/*/; do
        [ -f "$pkg/package.json" ] || continue
        found=1
        name="${pkg%/}"
        echo "== ${name} =="
        # The package manager's own test script, run from the package directory, so each package
        # owns its runner choice rather than this launcher guessing at one.
        (cd "$pkg" && npm test) || status=$?
    done
    TS_FOUND="$found"
    return "$status"
}

run_go_packages() {
    local status=0
    # go.mod at the repository root is the signal that Go packages exist at all; `go test ./...`
    # from there covers every package under go/.
    if [ -f go.mod ]; then
        GO_FOUND=1
        echo "== go =="
        go test ./... || status=$?
    else
        GO_FOUND=0
    fi
    return "$status"
}

cmd="${1:-}"

case "$cmd" in
    test)
        shift
        if [ "$#" -gt 0 ]; then
            echo "run.sh: 'test' takes no arguments yet (got: $*)" >&2
            exit 2
        fi
        status=0
        TS_FOUND=0
        GO_FOUND=0
        run_ts_packages || status=$?
        run_go_packages || status=$?
        if [ "$TS_FOUND" -eq 0 ] && [ "$GO_FOUND" -eq 0 ]; then
            echo "run.sh: no packages yet — nothing to test."
            echo "run.sh: ts/ and go/ hold no package; this is the expected state until the first package lands."
            exit 0
        fi
        exit "$status"
        ;;
    ""|-h|--help|help)
        usage
        # No argument is a usage error; an explicit request for help is not.
        if [ -z "$cmd" ]; then exit 2; fi
        exit 0
        ;;
    *)
        echo "run.sh: unknown command '$cmd'" >&2
        usage
        exit 2
        ;;
esac
