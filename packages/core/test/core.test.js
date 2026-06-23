"use strict";

const assert = require("node:assert/strict");
const {
  collectDiagnostics,
  formatText,
  hoverAtPosition,
  languageIdForUri
} = require("../src");

assert.equal(languageIdForUri("file:///tmp/meta_vehicle.moos"), "moos");
assert.equal(languageIdForUri("/tmp/meta_vehicle.bhv"), "ivp-behavior");
assert.equal(languageIdForUri("/tmp/README.md"), null);

assert.deepEqual(collectDiagnostics("ProcessConfig = pHelmIvP\n{\n}\n", "moos"), []);
assert.equal(collectDiagnostics("}\n", "moos")[0].code, "moos-ivp.unmatched-closing-brace");
assert.equal(collectDiagnostics("{\n", "moos")[0].code, "moos-ivp.unmatched-opening-brace");

const hover = hoverAtPosition("AppTick = 4\n", "moos", { line: 0, character: 2 });
assert.equal(hover.contents, "MOOS app iterate frequency, in hertz.");

assert.equal(formatText("AppTick = 4   \nCommsTick = 4"), "AppTick = 4\nCommsTick = 4\n");

console.log("core tests passed");

