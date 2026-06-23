#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const emacs = process.env.EMACS || "emacs";

const probe = spawnSync(emacs, ["--version"], {
  encoding: "utf8"
});

if (probe.status !== 0) {
  console.log("emacs not found; skipping Emacs mode check");
  process.exit(0);
}

const result = spawnSync(emacs, [
  "--batch",
  "-Q",
  "-L",
  "editors/emacs",
  "-l",
  "moos-ivp-mode",
  "--eval",
  "(progn (moos-ivp-mode) (unless (eq major-mode 'moos-ivp-mode) (error \"mode did not activate\")) (message \"moos-ivp-mode loaded\"))"
], {
  cwd: REPO_ROOT,
  encoding: "utf8"
});

process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
process.exit(result.status || 0);

