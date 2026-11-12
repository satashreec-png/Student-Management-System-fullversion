"use strict";

/** Pure functions for searching, sorting and summarising student lists. */

const SORTABLE = new Set(["id", "name", "age", "college", "year", "semester", "dept"]);

function filterStudents(students, { q, dept, year, sort = "id", order = "asc" } = {}) {
  let result = students;

  const needle = typeof q === "string" ? q.trim().toLowerCase() : "";
  if (needle) {
    result = result.filter((s) =>
      [String(s.id), s.name, s.college, s.dept].some((field) => field.toLowerCase().includes(needle))
    );
  }

  if (typeof dept === "string" && dept.trim()) {
    const wanted = dept.trim().toLowerCase();
    result = result.filter((s) => s.dept.toLowerCase() === wanted);
  }

  const yearNumber = Number.parseInt(year, 10);
  if (Number.isInteger(yearNumber)) {
    result = result.filter((s) => s.year === yearNumber);
  }

  const key = SORTABLE.has(sort) ? sort : "id";
  const direction = order === "desc" ? -1 : 1;

  return [...result].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    const comparison =
      typeof left === "number" ? left - right : String(left).localeCompare(String(right), undefined, { sensitivity: "base" });
    return comparison * direction;
  });
}

function computeStats(students) {
  const departments = new Map();
  const colleges = new Set();
  const years = new Map();
  let ageTotal = 0;

  for (const s of students) {
    const key = s.dept.toLowerCase();
    const entry = departments.get(key) || { name: s.dept, count: 0 };
    entry.count += 1;
    departments.set(key, entry);

    colleges.add(s.college.toLowerCase());
    years.set(s.year, (years.get(s.year) || 0) + 1);
    ageTotal += s.age;
  }

  return {
    total: students.length,
    colleges: colleges.size,
    averageAge: students.length ? Math.round((ageTotal / students.length) * 10) / 10 : null,
    byDepartment: [...departments.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    byYear: [...years.entries()].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year),
  };
}

module.exports = { filterStudents, computeStats };
