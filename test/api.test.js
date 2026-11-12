"use strict";

// End-to-end tests of the REST API. They need Express, so they are skipped
// until you run `npm install`.

const test = require("node:test");
const assert = require("node:assert/strict");
const { createEngine } = require("../src/engine");
const { buildEngine, tempDataFile, sample } = require("./helpers");

let hasExpress = true;
try {
  require.resolve("express");
} catch {
  hasExpress = false;
}

test("REST API", { skip: !hasExpress && 'run "npm install" to enable' }, async (t) => {
  const { createApp } = require("../src/app");
  const engine = createEngine({ enginePath: buildEngine(), dataFile: tempDataFile() });
  const server = createApp({ engine }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => server.close());

  const call = async (method, path, body) => {
    const response = await fetch(base + path, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  await t.test("health check", async () => {
    assert.equal((await call("GET", "/health")).status, 200);
  });

  await t.test("POST creates a student (201)", async () => {
    const { status, body } = await call("POST", "/students", sample({ id: 10 }));
    assert.equal(status, 201);
    assert.equal(body.student.id, 10);
  });

  await t.test("POST with bad data returns field errors (400)", async () => {
    const { status, body } = await call("POST", "/students", sample({ id: 11, age: 2, name: "" }));
    assert.equal(status, 400);
    assert.deepEqual(Object.keys(body.errors).sort(), ["age", "name"]);
  });

  await t.test("POST with a duplicate ID returns 409", async () => {
    assert.equal((await call("POST", "/students", sample({ id: 10 }))).status, 409);
  });

  await t.test("POST with malformed JSON returns 400", async () => {
    assert.equal((await call("POST", "/students", "{not json")).status, 400);
  });

  await t.test("GET one, 404 for missing, 400 for a bad id", async () => {
    assert.equal((await call("GET", "/students/10")).body.student.name, "Asha Rao");
    assert.equal((await call("GET", "/students/999")).status, 404);
    assert.equal((await call("GET", "/students/abc")).status, 400);
  });

  await t.test("GET list supports search, filter and sort", async () => {
    await call("POST", "/students", sample({ id: 12, name: "Bimal Das", dept: "ECE", age: 30 }));
    assert.equal((await call("GET", "/students?q=bimal")).body.count, 1);
    assert.equal((await call("GET", "/students?dept=ece")).body.count, 1);
    assert.deepEqual((await call("GET", "/students?sort=age&order=desc")).body.students.map((s) => s.id), [12, 10]);
  });

  await t.test("PUT updates, 404 for missing", async () => {
    const { id, ...changes } = sample({ name: "Asha R.", dept: "IT" });
    assert.equal((await call("PUT", "/students/10", changes)).status, 200);
    assert.equal((await call("GET", "/students/10")).body.student.dept, "IT");
    assert.equal((await call("PUT", "/students/999", changes)).status, 404);
  });

  await t.test("GET stats", async () => {
    const { body } = await call("GET", "/stats");
    assert.equal(body.stats.total, 2);
  });

  await t.test("DELETE removes, then 404", async () => {
    assert.equal((await call("DELETE", "/students/10")).status, 200);
    assert.equal((await call("DELETE", "/students/10")).status, 404);
  });

  await t.test("unknown API route returns JSON 404", async () => {
    assert.equal((await call("GET", "/nope")).status, 404);
  });
});
