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
assert.equal(collectDiagnostics("}\n", "moos")[0].code, "unmatched-closing-brace");
assert.equal(collectDiagnostics("{\n", "moos")[0].code, "unmatched-opening-brace");
assert.equal(
  collectDiagnostics("Behavior = BHV_AbortToPoint\n{\n  speed = fast\n}\n", "ivp-behavior")
    .some((item) => item.message.includes("speed")),
  true
);

const hover = hoverAtPosition(
  "ProcessConfig = pHelmIvP\n{\n  AppTick = 4\n}\n",
  "moos",
  { line: 2, character: 4 }
);
assert.match(hover.contents, /AppTick/);

assert.equal(formatText("AppTick=4   \nCommsTick = 4", "moos"), "AppTick = 4\nCommsTick = 4");

console.log("core tests passed");
