"use strict";

/**
 * Node wrapper around the C storage engine (c/engine.c).
 *
 * Each call starts the engine once, sends it one command on stdin and reads
 * the reply from stdout. Calls are queued so two requests can never
 * read-modify-write the data file at the same time.
 */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const ENGINE_FILE = process.platform === "win32" ? "student_engine.exe" : "student_engine";

const DEFAULT_ENGINE_PATH = process.env.STUDENT_ENGINE || path.join(ROOT, "bin", ENGINE_FILE);
const DEFAULT_DATA_FILE = process.env.STUDENT_DATA_FILE || path.join(ROOT, "data", "Students.dat");

const STATUS_BY_CODE = {
  INVALID: 400,
  NOT_FOUND: 404,
  DUPLICATE: 409,
  FULL: 409,
  IO: 500,
};

class EngineError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "EngineError";
    this.code = code;
    this.status = status || STATUS_BY_CODE[code] || 500;
  }
}

function parseStudentLine(line) {
  const parts = line.split("|");
  if (parts.length !== 8 || parts[0] !== "STUDENT") {
    throw new EngineError("BAD_REPLY", "The storage engine returned an unexpected reply.", 500);
  }
  return {
    id: Number(parts[1]),
    name: parts[2],
    age: Number(parts[3]),
    college: parts[4],
    year: Number(parts[5]),
    semester: Number(parts[6]),
    dept: parts[7],
  };
}

function studentToLines(student) {
  return [
    student.id,
    student.name,
    student.age,
    student.college,
    student.year,
    student.semester,
    student.dept,
  ];
}

function createEngine({
  enginePath = DEFAULT_ENGINE_PATH,
  dataFile = DEFAULT_DATA_FILE,
  timeoutMs = 5000,
} = {}) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });

  let queue = Promise.resolve();

  function exec(command, lines) {
    return new Promise((resolve, reject) => {
      const child = spawn(enginePath, [], {
        env: { ...process.env, STUDENT_DATA_FILE: dataFile },
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      const timer = setTimeout(() => {
        child.kill();
        reject(new EngineError("TIMEOUT", "The storage engine took too long to respond.", 504));
      }, timeoutMs);

      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.stdin.on("error", () => {}); // engine may exit before reading everything

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(
          new EngineError(
            "UNAVAILABLE",
            `Could not start the storage engine (${error.code || error.message}). Run "npm run build".`,
            503
          )
        );
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new EngineError("CRASHED", stderr.trim() || `Storage engine exited with code ${code}.`, 500));
        } else {
          resolve(stdout.trim());
        }
      });

      child.stdin.end([command, ...lines].join("\n") + "\n");
    });
  }

  async function run(command, lines = []) {
    const job = queue.then(() => exec(command, lines));
    queue = job.catch(() => {}); // a failed job must not block the queue

    const output = await job;
    const firstLine = output.split(/\r?\n/)[0];

    if (firstLine.startsWith("ERR|")) {
      const [, code, ...message] = firstLine.split("|");
      throw new EngineError(code, message.join("|"));
    }
    return output;
  }

  return {
    enginePath,
    dataFile,

    isBuilt: () => fs.existsSync(enginePath),

    async list() {
      const output = await run("LIST");
      return output
        .split(/\r?\n/)
        .filter((line) => line.startsWith("STUDENT|"))
        .map(parseStudentLine);
    },

    async get(id) {
      return parseStudentLine(await run("GET", [id]));
    },

    async add(student) {
      await run("ADD", studentToLines(student));
      return student;
    },

    async update(id, student) {
      const updated = { ...student, id };
      await run("UPDATE", studentToLines(updated));
      return updated;
    },

    async remove(id) {
      await run("DELETE", [id]);
    },
  };
}

module.exports = { createEngine, EngineError, DEFAULT_ENGINE_PATH, DEFAULT_DATA_FILE };
