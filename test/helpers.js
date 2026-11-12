"use strict";

// Shared test helpers. (node --test also loads this file; it defines no tests.)

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
let builtEngine = null;

/** Compiles the C engine once per test run into a temp folder. */
function buildEngine() {
  if (!builtEngine) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sms-engine-"));
    builtEngine = path.join(dir, process.platform === "win32" ? "engine.exe" : "engine");
    execFileSync("gcc", ["-std=c11", "-Wall", "-Wextra", "-O2", "-o", builtEngine,
      path.join(ROOT, "c", "engine.c"), path.join(ROOT, "c", "student.c")]);
  }
  return builtEngine;
}

function tempDataFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sms-data-"));
  return path.join(dir, "Students.dat");
}

const sample = (overrides = {}) => ({
  id: 1,
  name: "Asha Rao",
  age: 20,
  college: "Jadavpur University",
  year: 2,
  semester: 3,
  dept: "CSE",
  ...overrides,
});

module.exports = { buildEngine, tempDataFile, sample };
