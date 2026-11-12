"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateStudent, parseId } = require("../src/validation");
const { sample } = require("./helpers");

test("accepts a valid student and trims text", () => {
  const { value, errors } = validateStudent(sample({ name: "  Asha Rao  " }));
  assert.deepEqual(errors, {});
  assert.equal(value.name, "Asha Rao");
});

test("accepts numbers sent as strings", () => {
  const { value, errors } = validateStudent(sample({ id: "7", age: "21" }));
  assert.deepEqual(errors, {});
  assert.equal(value.id, 7);
  assert.equal(value.age, 21);
});

test("reports every invalid field at once", () => {
  const { errors } = validateStudent({});
  assert.deepEqual(Object.keys(errors).sort(), ["age", "college", "dept", "id", "name", "semester", "year"]);
});

test("rejects out-of-range and non-integer numbers", () => {
  for (const bad of [{ age: 4 }, { age: 101 }, { age: 20.5 }, { year: 0 }, { year: 7 }, { semester: 13 }, { id: 0 }, { id: -3 }, { id: "abc" }]) {
    const { errors } = validateStudent(sample(bad));
    assert.equal(Object.keys(errors).length, 1, JSON.stringify(bad));
  }
});

test("rejects the pipe character and control characters", () => {
  assert.ok(validateStudent(sample({ name: "Bad|Name" })).errors.name);
  assert.ok(validateStudent(sample({ dept: "CS\nE" })).errors.dept);
});

test("rejects text longer than the C buffers (measured in bytes)", () => {
  assert.ok(validateStudent(sample({ name: "a".repeat(50) })).errors.name);
  assert.equal(validateStudent(sample({ name: "a".repeat(49) })).errors.name, undefined);
  assert.ok(validateStudent(sample({ name: "é".repeat(30) })).errors.name); // 60 bytes
});

test("requireId: false skips the id check (used by updates)", () => {
  const { id, ...withoutId } = sample();
  assert.deepEqual(validateStudent(withoutId, { requireId: false }).errors, {});
});

test("parseId only accepts positive integers", () => {
  assert.equal(parseId("42"), 42);
  for (const bad of ["0", "-1", "4.2", "abc", "", undefined, "99999999999"]) {
    assert.equal(parseId(bad), null, String(bad));
  }
});
