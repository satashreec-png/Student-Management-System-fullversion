"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createEngine, EngineError } = require("../src/engine");
const { buildEngine, tempDataFile, sample } = require("./helpers");

function freshEngine() {
  return createEngine({ enginePath: buildEngine(), dataFile: tempDataFile() });
}

async function assertEngineError(promise, code, status) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof EngineError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

test("starts empty", async () => {
  assert.deepEqual(await freshEngine().list(), []);
});

test("add, get and list", async () => {
  const engine = freshEngine();
  await engine.add(sample({ id: 1 }));
  await engine.add(sample({ id: 2, name: "Bimal Das" }));

  assert.equal((await engine.get(2)).name, "Bimal Das");
  assert.deepEqual((await engine.list()).map((s) => s.id), [1, 2]);
});

test("keeps non-ASCII text intact", async () => {
  const engine = freshEngine();
  await engine.add(sample({ name: "Ananya Chatterjee ✓", dept: "বাংলা" }));
  const [student] = await engine.list();
  assert.equal(student.name, "Ananya Chatterjee ✓");
  assert.equal(student.dept, "বাংলা");
});

test("rejects duplicate IDs with 409", async () => {
  const engine = freshEngine();
  await engine.add(sample());
  await assertEngineError(engine.add(sample({ name: "Someone Else" })), "DUPLICATE", 409);
});

test("update changes a record, and 404s for a missing one", async () => {
  const engine = freshEngine();
  await engine.add(sample());

  const updated = await engine.update(1, sample({ name: "Asha R.", dept: "IT" }));
  assert.equal(updated.dept, "IT");
  assert.equal((await engine.get(1)).name, "Asha R.");

  await assertEngineError(engine.update(99, sample()), "NOT_FOUND", 404);
});

test("delete removes only the chosen record, and 404s for a missing one", async () => {
  const engine = freshEngine();
  for (const id of [1, 2, 3]) await engine.add(sample({ id }));

  await engine.remove(2);
  assert.deepEqual((await engine.list()).map((s) => s.id), [1, 3]);
  await assertEngineError(engine.remove(2), "NOT_FOUND", 404);
  await assertEngineError(engine.get(2), "NOT_FOUND", 404);
});

test("the C engine re-validates input even if Node is bypassed", async () => {
  const engine = freshEngine();
  await assertEngineError(engine.add(sample({ age: 3 })), "INVALID", 400);
  await assertEngineError(engine.add(sample({ name: "Bad|Name" })), "INVALID", 400);
});

test("concurrent adds are serialised and none are lost", async () => {
  const engine = freshEngine();
  const ids = Array.from({ length: 25 }, (_, i) => i + 1);

  await Promise.all(ids.map((id) => engine.add(sample({ id, name: `Student ${id}` }))));

  assert.deepEqual((await engine.list()).map((s) => s.id).sort((a, b) => a - b), ids);
});

test("reports a clear error when the engine binary is missing", async () => {
  const engine = createEngine({ enginePath: "/no/such/engine", dataFile: tempDataFile() });
  assert.equal(engine.isBuilt(), false);
  await assertEngineError(engine.list(), "UNAVAILABLE", 503);
});
