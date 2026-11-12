"use strict";

/**
 * Adds demo students so the app has something to show.
 * Skips IDs that already exist, so it is safe to run more than once.
 *
 *   npm run seed
 */

const { createEngine } = require("../src/engine");

const DEMO_STUDENTS = [
  [1001, "Aarav Sharma", 19, "Jadavpur University", 1, 2, "CSE"],
  [1002, "Diya Banerjee", 20, "Jadavpur University", 2, 3, "ECE"],
  [1003, "Rohan Das", 21, "IIT Kharagpur", 3, 5, "Mechanical"],
  [1004, "Ananya Roy", 19, "NSHM Knowledge Campus", 1, 1, "CSE"],
  [1005, "Kabir Sen", 22, "IIT Kharagpur", 4, 7, "CSE"],
  [1006, "Ishita Ghosh", 20, "Presidency University", 2, 4, "Physics"],
  [1007, "Vihaan Mukherjee", 23, "NSHM Knowledge Campus", 4, 8, "MBA"],
  [1008, "Meera Nair", 21, "Jadavpur University", 3, 6, "ECE"],
  [1009, "Arjun Patel", 18, "IIT Kharagpur", 1, 1, "Civil"],
  [1010, "Sara Khan", 20, "Presidency University", 2, 3, "Chemistry"],
  [1011, "Neel Chatterjee", 22, "Jadavpur University", 4, 7, "Mechanical"],
  [1012, "Tara Bose", 19, "NSHM Knowledge Campus", 1, 2, "ECE"],
].map(([id, name, age, college, year, semester, dept]) => ({ id, name, age, college, year, semester, dept }));

async function main() {
  const engine = createEngine();

  if (!engine.isBuilt()) {
    console.error('Build the C engine first: "npm run build"');
    process.exit(1);
  }

  const existing = new Set((await engine.list()).map((s) => s.id));
  let added = 0;

  for (const student of DEMO_STUDENTS) {
    if (!existing.has(student.id)) {
      await engine.add(student);
      added += 1;
    }
  }

  console.log(`Added ${added} demo student(s). ${DEMO_STUDENTS.length - added} already existed.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
