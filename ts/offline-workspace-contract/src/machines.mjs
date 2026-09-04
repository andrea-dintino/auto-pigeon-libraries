// The state machines, read from schema/offline-workspace-state-machines.json.
//
// The rule the file states and this module enforces: a transition that is not listed is not legal.
// `nextStates` returns an empty array for anything unlisted and `canTransition` returns false, so a
// server built on this refuses by default rather than by remembering to.
//
// Where one (from, event) pair has more than one target, the guards select between them and this
// module returns both. It does not evaluate guards — every guard here is a question about durable
// state inside a transaction, which is AUB's to answer and nobody else's. What this module owns is
// the shape: which moves exist, which refusal a blocked one carries, which timestamps a taken one
// writes, and what identity makes a retry a retry.

import { machinesDocument } from "./rules.mjs";

/** Every machine, in contract order. */
export const MACHINES = Object.freeze(
  machinesDocument.machines.map((entry) => Object.freeze(entry)),
);

/** Every machine id. */
export const MACHINE_IDS = Object.freeze(MACHINES.map((entry) => entry.id));

const BY_ID = new Map(MACHINES.map((entry) => [entry.id, entry]));

export function machine(id) {
  return BY_ID.get(id);
}

/** The states of a machine, in contract order. Empty for an unknown machine. */
export function statesOf(id) {
  return (BY_ID.get(id)?.states ?? []).map((state) => state.name);
}

/** The events of a machine, in contract order. */
export function eventsOf(id) {
  return BY_ID.get(id)?.events ?? [];
}

/** The initial state of a machine, or undefined. */
export function initialState(id) {
  return BY_ID.get(id)?.initial;
}

/** Is this a state from which the object never moves again? */
export function isTerminal(id, state) {
  return BY_ID.get(id)?.states.find((entry) => entry.name === state)?.terminal ?? false;
}

/** Every transition leaving a state. */
export function transitionsFrom(id, from) {
  return (BY_ID.get(id)?.transitions ?? []).filter((entry) => entry.from === from);
}

/** Every transition for one (from, event) pair — more than one where guards select the target. */
export function transitionsFor(id, from, event) {
  return (BY_ID.get(id)?.transitions ?? []).filter(
    (entry) => entry.from === from && entry.event === event,
  );
}

/** The states a (from, event) pair can reach. Empty means the move does not exist. */
export function nextStates(id, from, event) {
  return transitionsFor(id, from, event).map((entry) => entry.to);
}

/**
 * Is this exact move legal?
 *
 * With `to` omitted, the question is whether the event is legal from that state at all. With `to`
 * given, it is whether that specific triple is one the contract lists.
 */
export function canTransition(id, from, event, to) {
  const candidates = transitionsFor(id, from, event);
  if (candidates.length === 0) return false;
  if (to === undefined) return true;
  return candidates.some((entry) => entry.to === to);
}

/** The refusal codes a blocked attempt at this move may carry, deduplicated, in contract order. */
export function refusalsFor(id, from, event) {
  const seen = new Set();
  for (const entry of transitionsFor(id, from, event)) {
    for (const reason of entry.refusals ?? []) seen.add(reason);
  }
  return [...seen];
}

/** The timestamp and counter fields a taken transition writes. */
export function fieldsSetBy(id, from, event) {
  const seen = new Set();
  for (const entry of transitionsFor(id, from, event)) {
    for (const field of entry.sets ?? []) seen.add(field);
  }
  return [...seen];
}

/**
 * The identity tuple that makes a retry of this move recognisable as a retry, and what a replay
 * does: `return_current` for an idempotent move, `conflict` for one where a repeat is a genuinely
 * new attempt.
 *
 * The single `conflict` in the contract is accepting an invitation, and it is the interesting one:
 * a single-use token presented twice is precisely the replay the record exists to refuse, and
 * answering the second presentation with the membership the first created would make a replay
 * indistinguishable from a success.
 */
export function idempotencyFor(id, from, event) {
  const candidates = transitionsFor(id, from, event);
  if (candidates.length === 0) return undefined;
  const first = candidates[0];
  return { identity: first.identity ?? [], on_replay: first.on_replay ?? "return_current" };
}
