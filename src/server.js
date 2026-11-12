"use strict";

const { createApp } = require("./app");
const { createEngine } = require("./engine");

const PORT = Number(process.env.PORT) || 3000;

const engine = createEngine();

if (!engine.isBuilt()) {
  console.error(`The C storage engine was not found at:\n  ${engine.enginePath}\n`);
  console.error('Build it first with "npm run build" (needs gcc).');
  process.exit(1);
}

createApp({ engine }).listen(PORT, () => {
  console.log(`Student Management System running at http://localhost:${PORT}`);
  console.log(`Data file: ${engine.dataFile}`);
});
