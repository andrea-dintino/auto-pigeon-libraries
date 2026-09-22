// Redaction, tested with fake secrets.
//
// Every credential-looking string below is invented for this file. None of them is, or ever was, a
// real value from any Auto-Pigeon deployment — the point of a redaction test is to prove the rules
// remove a secret, which does not require a real one, and a tracked file is a published file.

import test from "node:test";
import assert from "node:assert/strict";

import {
  redactText,
  redactValue,
  redactIncident,
  isDroppedKey,
  isDeniedKey,
  createIncident,
  validateIncident,
  toDiagnosticText,
  toSentryEvent,
} from "../src/index.mjs";

// Fake secrets. Shaped like the real thing, valid nowhere.
const FAKE = {
  jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZha2UtdXNlciIsImV4cCI6OTk5OTk5OTk5OX0.ZmFrZS1zaWduYXR1cmUtbm90LWEtcmVhbC1rZXk",
  bearer: "Bearer sk_test_FAKEfakeFAKEfake0123456789",
  cookie: "pb_auth=FAKEcookieVALUE0123456789; Path=/",
  email: "not-a-real-person@example.invalid",
  password: "hunter2-but-fake",
  invitation: "inv_FAKE0123456789abcdef",
  posixPath: "/home/somebody/mapper-code/auto-pigeon/src/editor/Brush.ts",
  windowsPath: "C:\\Users\\Somebody\\AppData\\auto-pigeon\\session.db",
  dsnUserInfo: "https://publickey:FAKEsecret@glitchtip.example.invalid/3",
};

test("free text loses e-mail addresses", () => {
  const out = redactText(`sign-in failed for ${FAKE.email}`);
  assert.ok(!out.includes(FAKE.email));
  assert.ok(!out.includes("example.invalid"));
  assert.match(out, /\[redacted-email\]/);
});

test("free text loses JWTs and Authorization values", () => {
  const jwt = redactText(`token was ${FAKE.jwt}`);
  assert.ok(!jwt.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
  assert.match(jwt, /\[redacted-token\]/);

  const bearer = redactText(`Authorization: ${FAKE.bearer}`);
  assert.ok(!bearer.includes("sk_test_FAKEfakeFAKEfake0123456789"));
  assert.match(bearer, /\[redacted-token\]/);
});

test("free text loses session cookies", () => {
  const out = redactText(`Cookie: ${FAKE.cookie}`);
  assert.ok(!out.includes("FAKEcookieVALUE0123456789"));
  assert.match(out, /\[redacted-cookie\]/);
});

test("free text loses absolute local paths, on both kinds of machine", () => {
  const posix = redactText(`failed while reading ${FAKE.posixPath}`);
  assert.ok(!posix.includes("/home/somebody"));
  assert.ok(!posix.includes("Brush.ts"));
  assert.match(posix, /\[redacted-path\]/);

  const windows = redactText(`failed while reading ${FAKE.windowsPath}`);
  assert.ok(!windows.includes("C:\\Users\\Somebody"));
  assert.match(windows, /\[redacted-path\]/);
});

test("free text loses credentials embedded in a URL — and, since 241, the whole URL", () => {
  const out = redactText(`configured DSN ${FAKE.dsnUserInfo}`);
  assert.ok(!out.includes("FAKEsecret"));
  assert.ok(!out.includes("glitchtip.example.invalid"));
  assert.equal(out, "configured DSN [redacted-url]");
});

test("a full URL goes: host, path ids and query tokens alike (241)", () => {
  const out = redactText("GET https://aub.example.invalid/api/maps/abc123?token=FAKEqueryTOKEN failed");
  assert.equal(out, "GET [redacted-url] failed");
  assert.equal(redactText("open file:///home/somebody/x.map"), "open [redacted-url]");
  assert.equal(redactText("ws://10.0.0.5:2567/room"), "[redacted-url]");
});

test("an IPv4 address goes, a release number does not (241)", () => {
  assert.equal(redactText("dial tcp 172.18.0.3:8666: refused"), "dial tcp [redacted-ip]:8666: refused");
  assert.equal(redactText("release 1.842"), "release 1.842");
  assert.equal(redactText("version 1.2.3"), "version 1.2.3");
});

test("well-known token prefixes go even without a scheme word in front (241)", () => {
  for (const token of ["ghp_FAKEfakeFAKEfake0123456789", "github_pat_FAKE_fake_FAKE_fake_0123", "glpat-FAKEfakeFAKEfake01234", "xoxb-FAKE-fake-0123", "sk-FAKEfakeFAKEfake01234567", "AKIAFAKEFAKEFAKE0123"]) {
    assert.equal(redactText(`key ${token} end`), "key [redacted-token] end", token);
  }
});

test("a home-relative path goes (241)", () => {
  assert.equal(redactText("saved to ~/private/maps/x.map"), "saved to [redacted-path]");
});

test("a key naming a secret loses its value however it is spelled", () => {
  for (const key of [
    "authorization",
    "Authorization",
    "authToken",
    "x_auth",
    "cookie",
    "Set-Cookie",
    "password",
    "user_password",
    "secret",
    "clientSecret",
    "api_key",
    "apiKey",
    "invitation_token",
    "inviteCode",
    "email",
    "userEmail",
    "dsn",
    "sessionId",
  ]) {
    assert.ok(isDeniedKey(key), `${key} should be a denied key`);
  }
  const out = redactValue({ authorization: FAKE.bearer, userEmail: FAKE.email, keep: "ok" });
  assert.equal(out.authorization, "[redacted]");
  assert.equal(out.userEmail, "[redacted]");
  assert.equal(out.keep, "ok");
});

test("private map, annotation and prefab content is DROPPED, not masked", () => {
  for (const key of [
    "geometry",
    "vertices",
    "planes",
    "brushes",
    "faces",
    "entities",
    "annotations",
    "annotation",
    "chat",
    "prefab",
    "apmap_document",
    "body",
    "headers",
    "request",
    "response",
  ]) {
    assert.ok(isDroppedKey(key), `${key} should be a dropped key`);
  }
  const out = redactValue({
    geometry: { planes: [[1, 2, 3]] },
    annotations: ["a private note about a private level"],
    prefab: { contents: "secret room" },
    headers: { cookie: FAKE.cookie },
    face_count: 31040,
  });
  assert.deepEqual(Object.keys(out), ["face_count"]);
  assert.equal(out.face_count, 31040);
});

test("a counter is evidence and an array is a map: face_count survives, faces does not", () => {
  assert.ok(isDroppedKey("faces"));
  assert.ok(!isDroppedKey("face_count"));
  assert.ok(!isDeniedKey("face_count"));
  assert.ok(!isDeniedKey("brush_count"));
  assert.ok(!isDeniedKey("entity_count"));
  assert.ok(!isDeniedKey("triangle_count"));
});

test("the two identifiers the whole story hangs on survive redaction", () => {
  const incident = createIncident({
    severity: "error",
    component: "AUP",
    code: "editor.operation.failed",
    message: "Paste failed.",
    recoverable: true,
    correlation_id: "0123456789abcdef0123456789abcdef",
  });
  const safe = redactIncident(incident);
  assert.equal(safe.correlation_id, incident.correlation_id);
  assert.equal(safe.incident_id, incident.incident_id);
  assert.match(safe.incident_id, /^[0-9a-f]{32}$/);
});

test("redaction leaves a still-valid envelope", () => {
  const incident = createIncident({
    severity: "error",
    component: "AUB",
    subsystem: "accounts",
    code: "aub.error",
    operation: "session.create",
    message: `refused for ${FAKE.email} at ${FAKE.posixPath}`,
    duration_ms: 812,
    correlation_id: "abcdefabcdefabcdefabcdefabcdefab",
    release: "1.517",
    environment: "production",
    recoverable: true,
    user_action: "Sign in again.",
    evidence: { http_status: 401, http_reason: "unauthorized" },
  });
  const safe = redactIncident(incident);
  assert.ok(!safe.message.includes("example.invalid"));
  assert.ok(!safe.message.includes("/home/somebody"));
  const verdict = validateIncident(safe);
  assert.ok(verdict.valid, JSON.stringify(verdict.errors));
});

test("the diagnostic text a user previews carries no secret", () => {
  const incident = createIncident({
    severity: "fatal",
    component: "AUP",
    code: "render.3d.fatal",
    message: `context died loading ${FAKE.posixPath} for ${FAKE.email}`,
    recoverable: false,
    release: "1.842",
    environment: "production",
    correlation_id: "11112222333344445555666677778888",
    evidence: { triangle_count: 4_100_000 },
  });
  const text = toDiagnosticText(incident);
  for (const secret of [FAKE.email, FAKE.posixPath, "somebody"]) {
    assert.ok(!text.includes(secret), `diagnostic text leaked ${secret}`);
  }
  assert.ok(text.includes("11112222333344445555666677778888"));
  assert.ok(text.includes("triangle_count"));
});

test("the GlitchTip event is redacted and carries release, environment and correlation id", () => {
  const incident = createIncident({
    severity: "error",
    component: "AUE",
    subsystem: "wad",
    code: "aue.job_failed",
    operation: "extract.textures",
    message: `worker died reading ${FAKE.posixPath}`,
    recoverable: true,
    release: "1.99",
    environment: "test",
    correlation_id: "deadbeefdeadbeefdeadbeefdeadbeef",
    evidence: { worker_attempt: 2, queue_depth: 7 },
  });
  const event = toSentryEvent(incident, { platform: "go" });
  assert.equal(event.release, "1.99");
  assert.equal(event.environment, "test");
  assert.equal(event.tags.correlation_id, "deadbeefdeadbeefdeadbeefdeadbeef");
  assert.equal(event.tags.incident_code, "aue.job_failed");
  assert.ok(!JSON.stringify(event).includes("/home/somebody"));
  assert.equal(event.contexts.incident.evidence.worker_attempt, 2);
});

test("redaction terminates on a cyclic object rather than hanging the reporter", () => {
  const node = { note: "fine" };
  node.self = node;
  const out = redactValue(node);
  assert.equal(out.note, "fine");
  assert.equal(out.self, "[redacted]");
});

test("a password nested three levels deep is still removed", () => {
  const out = redactValue({ a: { b: { c: { password: FAKE.password, invitation: FAKE.invitation } } } });
  assert.equal(out.a.b.c.password, "[redacted]");
  assert.equal(out.a.b.c.invitation, "[redacted]");
});
