#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const {
  collectDiagnostics,
  formatTextWithIssues,
  validateGeometryValue
} = require("@moos-ivp/language-core");

const REPO_ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function assertNoSchemaDiagnostics(relativePath, language) {
  const diagnostics = collectDiagnostics(read(relativePath), language, {
    formattingEnabled: false
  });

  if (diagnostics.length) {
    const details = diagnostics.slice(0, 20).map((diagnostic) => {
      const line = diagnostic.range.start.line + 1;
      const column = diagnostic.range.start.character + 1;
      return `  ${line}:${column} ${diagnostic.message}`;
    }).join("\n");
    throw new Error(`${relativePath}: expected 0 diagnostics, got ${diagnostics.length}\n${details}`);
  }

  console.log(`${relativePath}: 0 diagnostics`);
}

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${name} failed\nExpected:\n${expected}\nActual:\n${actual}`);
  }
}

function assertCleanFormatting(name, text, language) {
  const result = formatTextWithIssues(text, language);
  if (result.issues.length) {
    const details = result.issues.map((issue) => issue.message).join("; ");
    throw new Error(`${name} expected 0 formatting issues, got ${result.issues.length}: ${details}`);
  }
}

function checkFormattingFixtures() {
  const moosInput = [
    "ProcessConfig=pHelmIvP {  ",
    "\tAppTick=4 // keep this comment",
    "   condition =  \"http://example.test/a//b\" // keep quoted slashes",
    "}",
    "   ",
    "",
    "ProcessConfig = pMarineViewer",
    "{",
    "  TIFF_FILE = viewer.tif   ",
    "}"
  ].join("\n");

  const moosExpected = [
    "ProcessConfig = pHelmIvP",
    "{",
    "  AppTick   = 4 // keep this comment",
    "  condition = \"http://example.test/a//b\" // keep quoted slashes",
    "}",
    "",
    "ProcessConfig = pMarineViewer",
    "{",
    "  TIFF_FILE = viewer.tif",
    "}"
  ].join("\n");

  assertEqual("MOOS formatting", formatTextWithIssues(moosInput, "moos").text, moosExpected);
  assertCleanFormatting("MOOS formatted output", moosExpected, "moos");

  const behaviorInput = [
    "initialize   DEPLOY = true",
    "Behavior=BHV_Waypoint {",
    " name=waypt_survey",
    " points = pts={0,0:50,0}",
    "}",
    "Behavior = BHV_Loiter",
    "{",
    "\tcondition = MODE=LOITERING",
    "}"
  ].join("\n");

  const behaviorExpected = [
    "initialize DEPLOY = true",
    "Behavior = BHV_Waypoint",
    "{",
    "  name   = waypt_survey",
    "  points = pts={0,0:50,0}",
    "}",
    "",
    "Behavior = BHV_Loiter",
    "{",
    "  condition = MODE=LOITERING",
    "}"
  ].join("\n");

  assertEqual("behavior formatting", formatTextWithIssues(behaviorInput, "ivp-behavior").text, behaviorExpected);
  assertCleanFormatting("behavior formatted output", behaviorExpected, "ivp-behavior");

  assertCleanFormatting("aligned behavior assignments", [
    "Behavior = BHV_Loiter",
    "{",
    "  name    = loiter_geometry_observe",
    "  pwt     = 100",
    "  polygon = pts={0,0:100,0:100,100:0,100}",
    "}"
  ].join("\n"), "ivp-behavior");

  console.log("formatting fixtures: 3 passed");
}

function assertGeometry(valueType, value, expectedStatus, expectedReason) {
  const result = validateGeometryValue(value, valueType);
  const label = `${valueType}: ${value}`;
  assert.equal(result.status, expectedStatus, `${label} status`);
  if (expectedReason) {
    assert.equal(result.reason, expectedReason, `${label} reason`);
  }
}

function checkGeometryFixtures() {
  const fixtures = [
    ["convex-polygon", "pts={0,0:100,0:100,100:0,100}", "valid"],
    ["convex-polygon", "0,0:100,0:100,100:0,100", "valid"],
    ["convex-polygon", "pts={0,0:100,0", "invalid", "malformed-standard-points"],
    ["convex-polygon", "pts={0,0:abc,0:100,100}", "invalid", "malformed-point-list"],
    ["convex-polygon", "pts={0,0:100,0}", "invalid", "too-few-polygon-points"],
    ["convex-polygon", "pts={0,0:100,100:0,100:100,0}", "invalid", "self-intersecting-polygon"],
    ["convex-polygon", "pts={0,0:100,0:50,50:100,100:0,100}", "invalid", "non-convex-polygon"],
    ["convex-polygon", "radial: x=0, y=0, radius=10, pts=8", "skipped", "unsupported-source-backed-syntax"],
    ["convex-polygon", "pts={0,0:100,0:100,100:0,100},label=alpha", "skipped", "unsupported-source-backed-syntax"],
    ["seglist", "pts={0,0:100,0}", "valid"],
    ["seglist", "0,0:100,0", "valid"],
    ["seglist", "pts={0,0:abc,0}", "invalid", "malformed-point-list"],
    ["seglist", "zigzag: x=0, y=0, height=20, width=50, swath=5", "skipped", "unsupported-source-backed-syntax"],
    ["seglist-or-polygon", "empty", "valid"],
    ["seglist-or-polygon", "start", "valid"],
    ["seglist-or-polygon", "0,0", "valid"],
    ["seglist-or-polygon", "0,0:100,0", "valid"],
    ["seglist-or-polygon", "pts={0,0:abc,0}", "invalid", "malformed-point-list"],
    ["contact-filter-region", "pts={0,0:100,0:100,100:0,100}", "valid"],
    ["contact-filter-region", "0,0:100,0:100,100:0,100", "valid"],
    ["contact-filter-region", "pts={0,0:100,0}", "invalid", "too-few-polygon-points"],
    ["contact-filter-region", "pts={0,0:100,100:0,100:100,0}", "invalid", "self-intersecting-polygon"],
    ["contact-filter-region", "pts={0,0:100,0:50,50:100,100:0,100}", "invalid", "non-convex-polygon"],
    ["contact-filter-region", "ellipse: x=0, y=0, major=10, minor=5, pts=16", "skipped", "unsupported-source-backed-syntax"]
  ];

  fixtures.forEach(([valueType, value, expectedStatus, expectedReason]) => {
    assertGeometry(valueType, value, expectedStatus, expectedReason);
  });

  console.log(`geometry parser fixtures: ${fixtures.length} passed`);
}

function main() {
  assertNoSchemaDiagnostics("examples/all_apps.moos", "moos");
  assertNoSchemaDiagnostics("examples/all_behaviors.bhv", "ivp-behavior");
  checkFormattingFixtures();
  checkGeometryFixtures();
}

main();

