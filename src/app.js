"use strict";

const path = require("node:path");
const express = require("express");

const { EngineError } = require("./engine");
const { filterStudents, computeStats } = require("./students");
const { validateStudent, parseId } = require("./validation");

/**
 * Builds the Express app. The storage engine is passed in so tests
 * can use a temporary data file.
 */
function createApp({ engine }) {
  const app = express();
  const api = express.Router();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(path.join(__dirname, "..", "public")));

  /** Reads :id from the URL and responds with 400 if it isn't valid. */
  function requireId(req, res) {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: "The student ID in the URL must be a positive whole number." });
    }
    return id;
  }

  api.get("/health", async (req, res) => {
    try {
      await engine.list();
      res.json({ success: true, status: "ok" });
    } catch (error) {
      res.status(503).json({ success: false, status: "engine unavailable", message: error.message });
    }
  });

  api.get("/students", async (req, res) => {
    const students = filterStudents(await engine.list(), req.query);
    res.json({ success: true, count: students.length, students });
  });

  api.get("/stats", async (req, res) => {
    res.json({ success: true, stats: computeStats(await engine.list()) });
  });

  api.get("/students/:id", async (req, res) => {
    const id = requireId(req, res);
    if (id === null) return;
    res.json({ success: true, student: await engine.get(id) });
  });

  api.post("/students", async (req, res) => {
    const { value, errors } = validateStudent(req.body, { requireId: true });
    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, message: "Please fix the highlighted fields.", errors });
    }
    const student = await engine.add(value);
    res.status(201).json({ success: true, message: "Student added successfully.", student });
  });

  api.put("/students/:id", async (req, res) => {
    const id = requireId(req, res);
    if (id === null) return;

    const { value, errors } = validateStudent(req.body, { requireId: false });
    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, message: "Please fix the highlighted fields.", errors });
    }
    const student = await engine.update(id, value);
    res.json({ success: true, message: "Student updated successfully.", student });
  });

  api.delete("/students/:id", async (req, res) => {
    const id = requireId(req, res);
    if (id === null) return;
    await engine.remove(id);
    res.json({ success: true, message: "Student deleted successfully." });
  });

  app.use("/api", api);
  app.use("/api", (req, res) => {
    res.status(404).json({ success: false, message: "That API route doesn't exist." });
  });

  // Express 5 forwards errors from async handlers here automatically.
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ success: false, message: "The request body isn't valid JSON." });
    }
    if (error instanceof EngineError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Something went wrong on the server." });
  });

  return app;
}

module.exports = { createApp };
