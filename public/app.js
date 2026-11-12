"use strict";

/* StudentHub frontend. Uses the existing /api routes and C-backed storage engine. */
const state = { q: "", dept: "", year: "", sort: "id", order: "asc" };
let students = [];
let editingId = null;
let pendingDelete = null;
let toastTimer = null;
let searchTimer;

const $ = (selector) => document.querySelector(selector);
const el = {
  summary: $("#summary"), rows: $("#rows"), empty: $("#empty"), search: $("#search"),
  deptFilter: $("#dept-filter"), yearFilter: $("#year-filter"), sortSelect: $("#sort-select"),
  deptBars: $("#dept-bars"), headRow: $("#head-row"), formDialog: $("#form-dialog"),
  form: $("#student-form"), formTitle: $("#form-title"), formError: $("#form-error"),
  formSubmit: $("#form-submit"), deleteDialog: $("#delete-dialog"), deleteText: $("#delete-text"),
  deleteConfirm: $("#delete-confirm"), toast: $("#toast")
};

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
  } catch {
    throw Object.assign(new Error("Can't reach the server. Check that it is running with npm start."), { network: true });
  }
  const data = await response.json().catch(() => ({ message: "The server sent an unexpected reply." }));
  if (!response.ok) throw Object.assign(new Error(data.message || "The request failed."), { errors: data.errors, status: response.status });
  return data;
}

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function toast(message, isError = false) {
  clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.classList.toggle("error", isError);
  el.toast.classList.add("show");
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 3200);
}

async function load(highlightId) {
  const params = new URLSearchParams();
  for (const key of ["q", "dept", "year", "sort", "order"]) if (state[key]) params.set(key, state[key]);
  try {
    const [list, stats] = await Promise.all([api(`/students?${params}`), api("/stats")]);
    students = list.students || [];
    renderSummary(stats.stats || {});
    renderDepartments(stats.stats || {});
    renderRows(stats.stats?.total ?? students.length, highlightId);
    renderSortHeaders();
    $("#nav-student-count").textContent = String(stats.stats?.total ?? students.length);
    $("#table-count").textContent = `Showing ${students.length} ${students.length === 1 ? "student" : "students"}`;
  } catch (error) {
    students = [];
    el.rows.replaceChildren();
    el.summary.textContent = "Records couldn't be loaded.";
    showEmpty("Can't load students", error.message);
    $("#table-count").textContent = "Unable to load records";
  }
}

function renderSummary(stats) {
  const total = Number(stats.total ?? students.length);
  const departments = stats.byDepartment || [];
  $("#stat-total").textContent = total.toLocaleString();
  $("#stat-departments").textContent = departments.length.toLocaleString();
  $("#stat-age").textContent = stats.averageAge == null ? "—" : Number(stats.averageAge).toFixed(1);
  $("#stat-colleges").textContent = Number(stats.colleges ?? new Set(students.map(s => s.college)).size).toLocaleString();
  el.summary.textContent = `${plural(total, "student")} across ${plural(departments.length, "department")}.`;
}

function renderDepartments(stats) {
  const departments = stats.byDepartment || [];
  const options = [h("option", { value: "", text: "All departments" })];
  for (const { name } of departments) options.push(h("option", { value: name, text: name }));
  el.deptFilter.replaceChildren(...options);
  const match = departments.find(d => d.name.toLowerCase() === state.dept.toLowerCase());
  if (state.dept && !match) state.dept = "";
  el.deptFilter.value = match ? match.name : "";

  const max = Math.max(1, ...departments.map(d => Number(d.count)));
  const items = departments.map(({ name, count }) => {
    const active = Boolean(match && match.name === name);
    return h("li", {}, h("button", {
      class: "bar-button", type: "button", "aria-pressed": String(active),
      onclick: () => setDepartment(active ? "" : name)
    },
    h("span", { text: name }),
    h("span", { class: "bar-count", text: String(count) }),
    h("span", { class: "bar-track", "aria-hidden": "true" },
      h("span", { class: "bar-fill", style: `width:${(Number(count) / max) * 100}%` }))));
  });
  el.deptBars.replaceChildren(...(items.length ? items : [h("li", { class: "panel-subtitle", text: "Department data will appear here when students are added." })]));
}

function renderRows(totalOnRecord, highlightId) {
  el.rows.replaceChildren(...students.map(student => studentRow(student, student.id === highlightId)));
  if (students.length) el.empty.hidden = true;
  else if (totalOnRecord === 0) showEmpty("No students yet", "Add the first student to start building your directory.", "Add student", () => openForm());
  else showEmpty("No matching students", "Try changing your search or filters.", "Clear filters", clearFilters);
}

function showEmpty(title, message, buttonLabel, onClick) {
  const content = [h("h3", { text: title }), h("p", { text: message })];
  if (buttonLabel) content.push(h("button", { class: "btn btn-primary", type: "button", text: buttonLabel, onclick: onClick }));
  el.empty.replaceChildren(...content);
  el.empty.hidden = false;
}

function studentRow(s, highlight) {
  const cell = (cls, label, text) => h("td", { class: cls, "data-label": label, text: String(text ?? "") });
  return h("tr", highlight ? { class: "flash" } : {},
    cell("id", "ID", `#${s.id}`),
    cell("name", "Student", s.name),
    cell("", "Age", s.age),
    cell("", "Year", `Year ${s.year}`),
    cell("", "Semester", s.semester),
    h("td", { "data-label": "Department" }, h("span", { class: "dept-pill", text: s.dept })),
    cell("college", "College", s.college),
    h("td", { class: "actions" }, h("div", { class: "row-actions" },
      h("button", { class: "link-button", type: "button", text: "Edit", "aria-label": `Edit ${s.name}`, onclick: () => openForm(s) }),
      h("button", { class: "link-button danger", type: "button", text: "Delete", "aria-label": `Delete ${s.name}`, onclick: () => openDelete(s) }))));
}

function renderSortHeaders() {
  for (const th of el.headRow.querySelectorAll("th[data-sort]")) {
    const key = th.dataset.sort;
    if (!th.querySelector("button")) th.replaceChildren(h("button", {
      class: "sort-button", type: "button", text: th.textContent,
      onclick: () => setSort(key)
    }));
    if (state.sort === key) th.setAttribute("aria-sort", state.order === "asc" ? "ascending" : "descending");
    else th.removeAttribute("aria-sort");
  }
  el.sortSelect.value = ["id", "name", "age", "year", "dept"].includes(state.sort) ? state.sort : "id";
}

function setSort(key) { state.order = state.sort === key && state.order === "asc" ? "desc" : "asc"; state.sort = key; load(); }
function setDepartment(name) { state.dept = name; load(); }
function clearFilters() {
  Object.assign(state, { q: "", dept: "", year: "" });
  el.search.value = ""; el.yearFilter.value = ""; el.deptFilter.value = "";
  load();
}

el.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = el.search.value.trim(); load(); }, 250);
});
el.deptFilter.addEventListener("change", () => setDepartment(el.deptFilter.value));
el.yearFilter.addEventListener("change", () => { state.year = el.yearFilter.value; load(); });
el.sortSelect.addEventListener("change", () => { state.sort = el.sortSelect.value; state.order = "asc"; load(); });

document.addEventListener("keydown", event => {
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (event.key === "/" && !typing && !document.querySelector("dialog[open]")) {
    event.preventDefault(); el.search.focus();
  }
});

function fillSelect(select, count, label) {
  select.replaceChildren(...Array.from({ length: count }, (_, i) => h("option", {
    value: i + 1, text: label ? `${label} ${i + 1}` : String(i + 1)
  })));
}
fillSelect($("#f-year"), 6, "Year");
fillSelect($("#f-semester"), 12, "Semester");

function clearFormErrors() {
  el.formError.hidden = true;
  for (const message of el.form.querySelectorAll("[data-error-for]")) message.textContent = "";
  for (const input of el.form.elements) input.removeAttribute?.("aria-invalid");
}
function showFieldErrors(errors) {
  for (const [field, message] of Object.entries(errors)) {
    const target = el.form.elements[field];
    const holder = el.form.querySelector(`[data-error-for="${field}"]`);
    if (target) target.setAttribute("aria-invalid", "true");
    if (holder) { holder.textContent = message; target?.setAttribute("aria-describedby", holder.id || `error-${field}`); holder.id = `error-${field}`; }
  }
  el.form.querySelector('[aria-invalid="true"]')?.focus();
}
function openForm(student) {
  editingId = student ? student.id : null;
  clearFormErrors(); el.form.reset();
  el.formTitle.textContent = student ? "Edit student" : "Add student";
  el.formSubmit.textContent = student ? "Save changes" : "Create student";
  el.form.elements.id.readOnly = Boolean(student);
  if (student) for (const [key, value] of Object.entries(student)) if (el.form.elements[key]) el.form.elements[key].value = value;
  el.formDialog.showModal();
  (student ? el.form.elements.name : el.form.elements.id).focus();
}

el.form.addEventListener("submit", async event => {
  event.preventDefault(); clearFormErrors();
  if (!el.form.reportValidity()) return;
  const payload = Object.fromEntries(new FormData(el.form));
  for (const key of ["id", "age", "year", "semester"]) payload[key] = Number(payload[key]);
  el.formSubmit.disabled = true;
  try {
    if (editingId === null) {
      await api("/students", { method: "POST", body: JSON.stringify(payload) });
      toast(`Added ${payload.name}.`);
    } else {
      delete payload.id;
      await api(`/students/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      toast(`Updated ${payload.name}.`);
    }
    const savedId = editingId ?? payload.id;
    el.formDialog.close(); await load(savedId);
  } catch (error) {
    if (error.errors) showFieldErrors(error.errors);
    else { el.formError.textContent = error.message; el.formError.hidden = false; }
  } finally { el.formSubmit.disabled = false; }
});

$("#form-cancel").addEventListener("click", () => el.formDialog.close());
$("#form-cancel-top").addEventListener("click", () => el.formDialog.close());
$("#add-button").addEventListener("click", () => openForm());
$("#quick-add").addEventListener("click", () => openForm());

function openDelete(student) {
  pendingDelete = student;
  el.deleteText.textContent = `${student.name} (ID ${student.id}) will be permanently removed from the records.`;
  el.deleteDialog.showModal();
}
$("#delete-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!pendingDelete) return;
  el.deleteConfirm.disabled = true;
  try {
    await api(`/students/${pendingDelete.id}`, { method: "DELETE" });
    toast(`Deleted ${pendingDelete.name}.`); el.deleteDialog.close(); await load();
  } catch (error) { el.deleteDialog.close(); toast(error.message, true); }
  finally { el.deleteConfirm.disabled = false; pendingDelete = null; }
});
$("#delete-cancel").addEventListener("click", () => { pendingDelete = null; el.deleteDialog.close(); });

function exportCsv() {
  if (!students.length) { toast("There are no visible student records to export.", true); return; }
  const columns = ["id", "name", "age", "year", "semester", "dept", "college"];
  const escapeCsv = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [columns.join(","), ...students.map(s => columns.map(key => escapeCsv(s[key])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = h("a", { href: url, download: "student-records.csv" });
  document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  toast(`Exported ${plural(students.length, "student")} to CSV.`);
}
$("#export-button").addEventListener("click", exportCsv);
$("#quick-export").addEventListener("click", exportCsv);
$("#quick-clear").addEventListener("click", clearFilters);
$("#refresh-button").addEventListener("click", () => { load(); toast("Student records refreshed."); });
$("#menu-button").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
document.querySelectorAll(".nav-item").forEach(link => link.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  link.classList.add("active"); $("#sidebar").classList.remove("open");
}));
for (const dialog of [el.formDialog, el.deleteDialog]) {
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
}
load();
