// Source-map frames: only the application's own bundle, never a host, a query or a foreign script.

import test from "node:test";
import assert from "node:assert/strict";
import { createIncident, stackFrames, exceptionType, toSentryEvent } from "../src/index.mjs";

const ORIGIN = "https://192.168.0.33:5173";
const CHROME = `TypeError: Cannot read properties of undefined (reading 'faces') at /home/somebody/x
    at Ye (https://192.168.0.33:5173/assets/index-C9-gY1nI.js:14:25)
    at async Hn (https://192.168.0.33:5173/assets/worker-Ab12.js?v=3:2:100)
    at https://192.168.0.33:5173/assets/vendor-9x.mjs#frag:1:7
    at chrome-extension://abcdef/content.js:1:1
    at https://evil.example.invalid/assets/x.js:1:1
    at eval (eval at run (https://192.168.0.33:5173/assets/index-C9-gY1nI.js:1:1), <anonymous>:1:1)
    at blob:https://192.168.0.33:5173/1234:1:1`;
const FIREFOX = `Ye@https://192.168.0.33:5173/assets/index-C9-gY1nI.js:14:25
@https://192.168.0.33:5173/assets/index-C9-gY1nI.js:20:3
weird name!@https://192.168.0.33:5173/assets/index-C9-gY1nI.js:30:1`;

test("Chromium frames: own-origin bundle only, origin replaced by app://, innermost last", () => {
  const frames = stackFrames(CHROME, { origin: ORIGIN });
  assert.deepEqual(frames.map((f) => f.abs_path), [
    "app:///assets/vendor-9x.mjs",
    "app:///assets/worker-Ab12.js",
    "app:///assets/index-C9-gY1nI.js",
  ]);
  assert.deepEqual(frames.at(-1), { abs_path: "app:///assets/index-C9-gY1nI.js", filename: "app:///assets/index-C9-gY1nI.js", function: "Ye", lineno: 14, colno: 25, in_app: true });
  assert.equal(frames[1].function, "Hn");
  const text = JSON.stringify(frames);
  for (const leak of ["192.168", "5173", "?v=", "#frag", "evil", "chrome-extension", "blob:", "somebody"]) assert.ok(!text.includes(leak), leak);
});

test("Firefox frames parse too, and an odd function name becomes ?", () => {
  const frames = stackFrames(FIREFOX, { origin: ORIGIN });
  assert.deepEqual(frames.map((f) => f.function), ["?", "?", "Ye"]);
});

test("no origin, no frames", () => {
  assert.deepEqual(stackFrames(CHROME, {}), []);
  assert.deepEqual(stackFrames(undefined, { origin: ORIGIN }), []);
});

test("toSentryEvent carries the frames after redaction, with the CODE as the exception value", () => {
  const incident = createIncident({ severity: "fatal", component: "AUP", subsystem: "render.3d", code: "render.3d.fatal", message: "renderer threw at https://192.168.0.33:5173/x", release: "1.9", environment: "production", recoverable: false });
  const frames = stackFrames(CHROME, { origin: ORIGIN });
  const event = toSentryEvent(incident, { exception: { type: exceptionType(new TypeError("x")), frames } });
  assert.equal(event.exception.values[0].type, "TypeError");
  assert.equal(event.exception.values[0].value, "render.3d.fatal");
  assert.deepEqual(event.exception.values[0].stacktrace.frames, frames);
  assert.ok(!JSON.stringify(event).includes("192.168"));
});

test("a hand-made frame that is not in the sanitised shape is dropped", () => {
  const incident = createIncident({ severity: "error", component: "AUG", code: "aug.error", message: "x", recoverable: true });
  const bad = [
    { abs_path: "https://host/assets/a.js", filename: "https://host/assets/a.js", function: "f", lineno: 1, colno: 1, in_app: true },
    { abs_path: "app:///assets/a.js", filename: "app:///assets/a.js", function: "f", lineno: 1, colno: 1, in_app: true, vars: { token: "x" } },
  ];
  assert.equal(toSentryEvent(incident, { exception: { frames: bad } }).exception, undefined);
});
