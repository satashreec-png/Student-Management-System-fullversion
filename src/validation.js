"use strict";

/**
 * Input validation for student records.
 * Limits mirror the C engine (c/student.h), which re-checks everything.
 */

const MAX_ID = 2147483647;

const TEXT_FIELDS = {
  name: { label: "Name", maxBytes: 49 },
  college: { label: "College", maxBytes: 99 },
  dept: { label: "Department", maxBytes: 49 },
};

const NUMBER_FIELDS = {
  age: { label: "Age", min: 5, max: 100 },
  year: { label: "Year", min: 1, max: 6 },
  semester: { label: "Semester", min: 1, max: 12 },
};

function toInteger(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : NaN;
  }
  if (typeof value === "string" && /^\s*-?\d+\s*$/.test(value)) {
    return parseInt(value, 10);
  }
  return NaN;
}

/** Parses an ID from a URL parameter. Returns null if it isn't a valid ID. */
function parseId(raw) {
  const id = toInteger(raw);
  return Number.isInteger(id) && id >= 1 && id <= MAX_ID ? id : null;
}

/**
 * Validates a student payload.
 * @param {object} input        the request body
 * @param {object} [options]
 * @param {boolean} [options.requireId=true]  false for updates (ID comes from the URL)
 * @returns {{ value: object, errors: Record<string,string> }}
 */
function validateStudent(input, { requireId = true } = {}) {
  const body = input && typeof input === "object" ? input : {};
  const errors = {};
  const value = {};

  if (requireId) {
    const id = parseId(body.id);
    if (id === null) {
      errors.id = `ID must be a whole number from 1 to ${MAX_ID}.`;
    } else {
      value.id = id;
    }
  }

  for (const [field, { label, maxBytes }] of Object.entries(TEXT_FIELDS)) {
    const raw = body[field];
    const text = typeof raw === "string" ? raw.trim() : "";

    if (!text) {
      errors[field] = `${label} is required.`;
    } else if (/[|\u0000-\u001f\u007f]/.test(text)) {
      errors[field] = `${label} can't contain the "|" symbol or control characters.`;
    } else if (Buffer.byteLength(text, "utf8") > maxBytes) {
      errors[field] = `${label} must be at most ${maxBytes} bytes long.`;
    } else {
      value[field] = text;
    }
  }

  for (const [field, { label, min, max }] of Object.entries(NUMBER_FIELDS)) {
    const number = toInteger(body[field]);

    if (!Number.isInteger(number) || number < min || number > max) {
      errors[field] = `${label} must be a whole number from ${min} to ${max}.`;
    } else {
      value[field] = number;
    }
  }

  return { value, errors };
}

module.exports = { validateStudent, parseId, MAX_ID };
