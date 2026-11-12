"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { filterStudents, computeStats } = require("../src/students");
const { sample } = require("./helpers");

const students = [
  sample({ id: 3, name: "Chitra", age: 22, dept: "ECE", year: 3, college: "IIT" }),
  sample({ id: 1, name: "asha", age: 19, dept: "CSE", year: 1 }),
  sample({ id: 2, name: "Bimal", age: 21, dept: "cse", year: 2, college: "IIT" }),
];

test("search matches name, college, dept and id (case-insensitive)", () => {
  assert.deepEqual(filterStudents(students, { q: "ASH" }).map((s) => s.id), [1]);
  assert.deepEqual(filterStudents(students, { q: "iit" }).map((s) => s.id), [2, 3]);
  assert.deepEqual(filterStudents(students, { q: "3" }).map((s) => s.id), [3]);
});

test("filters by department (case-insensitive) and year", () => {
  assert.deepEqual(filterStudents(students, { dept: "CSE" }).map((s) => s.id), [1, 2]);
  assert.deepEqual(filterStudents(students, { year: "2" }).map((s) => s.id), [2]);
});

test("sorts by a column in either direction and ignores unknown columns", () => {
  assert.deepEqual(filterStudents(students, { sort: "age", order: "desc" }).map((s) => s.id), [3, 2, 1]);
  assert.deepEqual(filterStudents(students, { sort: "name" }).map((s) => s.id), [1, 2, 3]);
  assert.deepEqual(filterStudents(students, { sort: "nonsense" }).map((s) => s.id), [1, 2, 3]);
});

test("computeStats groups departments case-insensitively", () => {
  const stats = computeStats(students);
  assert.equal(stats.total, 3);
  assert.equal(stats.averageAge, 20.7);
  assert.equal(stats.colleges, 2);
  assert.deepEqual(stats.byDepartment, [{ name: "ECE", count: 1 }, { name: "CSE", count: 2 }].sort((a, b) => b.count - a.count));
  assert.deepEqual(stats.byYear, [{ year: 1, count: 1 }, { year: 2, count: 1 }, { year: 3, count: 1 }]);
});

test("computeStats handles an empty list", () => {
  assert.deepEqual(computeStats([]), { total: 0, colleges: 0, averageAge: null, byDepartment: [], byYear: [] });
});
