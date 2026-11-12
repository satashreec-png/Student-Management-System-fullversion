/*
 * engine.c - storage engine used by the Node.js server.
 *
 * One command per process, read from stdin (one value per line):
 *
 *   ADD     id, name, age, college, year, semester, dept
 *   UPDATE  id, name, age, college, year, semester, dept
 *   GET     id
 *   DELETE  id
 *   LIST
 *
 * Replies on stdout:
 *   OK|message                      (ADD, UPDATE, DELETE)
 *   COUNT|n  then STUDENT|... lines (LIST)
 *   STUDENT|id|name|age|college|year|semester|dept   (GET)
 *   ERR|CODE|message                (any failure)
 *
 * CODE is one of INVALID, DUPLICATE, NOT_FOUND, FULL, IO, UNKNOWN_COMMAND.
 */
#include "student.h"

#include <limits.h>
#include <stdio.h>
#include <string.h>

static struct Student students[MAX_STUDENTS];
static int count = 0;

static void fail(const char *code, const char *message)
{
    printf("ERR|%s|%s\n", code, message);
}

static void print_student(const struct Student *s)
{
    printf("STUDENT|%d|%s|%d|%s|%d|%d|%s\n",
           s->id, s->name, s->age, s->college, s->year, s->semester, s->dept);
}

/* ---- input ---- */

static const char *read_id(int *id)
{
    char line[64];
    long value;
    if (read_line(line, sizeof line) != 1 || !parse_long(line, 1, INT_MAX, &value)) {
        return "ID must be a positive whole number.";
    }
    *id = (int)value;
    return NULL;
}

static const char *read_number(const char *error, int *out)
{
    char line[64];
    long value;
    if (read_line(line, sizeof line) != 1 || !parse_long(line, INT_MIN, INT_MAX, &value)) {
        return error;
    }
    *out = (int)value;
    return NULL;
}

static const char *read_text(const char *error, char *dst, size_t cap)
{
    char line[512];
    if (read_line(line, sizeof line) != 1 || !set_text(dst, cap, line)) {
        return error;
    }
    return NULL;
}

/* Reads and validates a full record. Returns NULL on success, else a message. */
static const char *read_record(struct Student *s)
{
    const char *error;
    memset(s, 0, sizeof *s);

    if ((error = read_id(&s->id))) return error;
    if ((error = read_text("Name is missing or longer than 49 characters.", s->name, sizeof s->name))) return error;
    if ((error = read_number("Age must be a number.", &s->age))) return error;
    if ((error = read_text("College is missing or longer than 99 characters.", s->college, sizeof s->college))) return error;
    if ((error = read_number("Year must be a number.", &s->year))) return error;
    if ((error = read_number("Semester must be a number.", &s->semester))) return error;
    if ((error = read_text("Department is missing or longer than 49 characters.", s->dept, sizeof s->dept))) return error;

    return validate_student(s);
}

/* ---- commands ---- */

static int load_or_fail(void)
{
    if (!load_students(students, &count)) {
        fail("IO", "Could not read the student records.");
        return 0;
    }
    return 1;
}

static void save_or_fail(const char *success_message)
{
    if (save_students(students, count)) {
        printf("OK|%s\n", success_message);
    } else {
        fail("IO", "Could not save the student records.");
    }
}

static void cmd_add(void)
{
    struct Student student;
    const char *error = read_record(&student);
    if (error) { fail("INVALID", error); return; }
    if (!load_or_fail()) return;

    if (find_student(students, count, student.id) >= 0) {
        fail("DUPLICATE", "A student with this ID already exists.");
        return;
    }
    if (count >= MAX_STUDENTS) {
        fail("FULL", "The student record is full.");
        return;
    }

    students[count++] = student;
    save_or_fail("Student added successfully.");
}

static void cmd_update(void)
{
    struct Student student;
    const char *error = read_record(&student);
    if (error) { fail("INVALID", error); return; }
    if (!load_or_fail()) return;

    int index = find_student(students, count, student.id);
    if (index < 0) { fail("NOT_FOUND", "Student not found."); return; }

    students[index] = student;
    save_or_fail("Student updated successfully.");
}

static void cmd_get(void)
{
    int id;
    const char *error = read_id(&id);
    if (error) { fail("INVALID", error); return; }
    if (!load_or_fail()) return;

    int index = find_student(students, count, id);
    if (index < 0) { fail("NOT_FOUND", "Student not found."); return; }

    print_student(&students[index]);
}

static void cmd_delete(void)
{
    int id;
    const char *error = read_id(&id);
    if (error) { fail("INVALID", error); return; }
    if (!load_or_fail()) return;

    int index = find_student(students, count, id);
    if (index < 0) { fail("NOT_FOUND", "Student not found."); return; }

    for (int i = index; i < count - 1; i++) {
        students[i] = students[i + 1];
    }
    count--;
    save_or_fail("Student deleted successfully.");
}

static void cmd_list(void)
{
    if (!load_or_fail()) return;

    printf("COUNT|%d\n", count);
    for (int i = 0; i < count; i++) {
        print_student(&students[i]);
    }
}

int main(void)
{
    char command[64];
    if (read_line(command, sizeof command) != 1) {
        return 1;
    }

    if (strcmp(command, "ADD") == 0)         cmd_add();
    else if (strcmp(command, "UPDATE") == 0) cmd_update();
    else if (strcmp(command, "GET") == 0)    cmd_get();
    else if (strcmp(command, "DELETE") == 0) cmd_delete();
    else if (strcmp(command, "LIST") == 0)   cmd_list();
    else fail("UNKNOWN_COMMAND", "Unknown command.");

    return 0;
}
