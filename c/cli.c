/*
 * cli.c - interactive command-line interface for the Student Management System.
 *
 * Uses the same data file and validation as the web version, so records
 * added here show up in the web app and the other way round.
 */
#include "student.h"

#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static struct Student students[MAX_STUDENTS];
static int count = 0;

/* ---- prompts (each one repeats until the answer is valid) ---- */

static void prompt_text(const char *label, char *dst, size_t cap)
{
    char line[512];

    for (;;) {
        printf("%s: ", label);
        fflush(stdout);

        int result = read_line(line, sizeof line);
        if (result == 0) {
            printf("\n");
            exit(0); /* end of input */
        }
        if (result == 1 && set_text(dst, cap, line) && valid_text(dst)) {
            return;
        }
        printf("  Enter 1 to %zu characters. The '|' symbol isn't allowed.\n", cap - 1);
    }
}

static int prompt_int(const char *label, int lo, int hi)
{
    char line[64];
    long value;

    for (;;) {
        printf("%s: ", label);
        fflush(stdout);

        int result = read_line(line, sizeof line);
        if (result == 0) {
            printf("\n");
            exit(0);
        }
        if (result == 1 && parse_long(line, lo, hi, &value)) {
            return (int)value;
        }
        printf("  Enter a whole number from %d to %d.\n", lo, hi);
    }
}

static void prompt_details(struct Student *s)
{
    prompt_text("Enter student name", s->name, sizeof s->name);
    s->age = prompt_int("Enter age", 5, 100);
    prompt_text("Enter college", s->college, sizeof s->college);
    s->year = prompt_int("Enter year (1-6)", 1, 6);
    s->semester = prompt_int("Enter semester (1-12)", 1, 12);
    prompt_text("Enter department", s->dept, sizeof s->dept);
}

/* ---- output ---- */

static void print_header(void)
{
    printf("\n%-6s %-22s %-4s %-5s %-4s %-10s %s\n",
           "ID", "Name", "Age", "Year", "Sem", "Dept", "College");
    printf("------------------------------------------------------------------------\n");
}

static void print_row(const struct Student *s)
{
    printf("%-6d %-22.22s %-4d %-5d %-4d %-10.10s %.30s\n",
           s->id, s->name, s->age, s->year, s->semester, s->dept, s->college);
}

static void print_details(const struct Student *s)
{
    printf("\n  ID:         %d\n", s->id);
    printf("  Name:       %s\n", s->name);
    printf("  Age:        %d\n", s->age);
    printf("  College:    %s\n", s->college);
    printf("  Year:       %d\n", s->year);
    printf("  Semester:   %d\n", s->semester);
    printf("  Department: %s\n", s->dept);
}

static void save_or_warn(const char *success_message)
{
    if (save_students(students, count)) {
        printf("%s\n", success_message);
    } else {
        printf("ERROR: could not save to %s. Does the folder exist?\n", data_file_path());
    }
}

/* ---- selecting a student by ID, name or department ---- */

static int select_student(const char *action)
{
    static int matches[MAX_STUDENTS];
    int match_count = 0;

    printf("\n%s student by:\n  1. ID\n  2. Name\n  3. Department\n", action);
    int mode = prompt_int("Enter your choice", 1, 3);

    if (mode == 1) {
        int index = find_student(students, count,
                                 prompt_int("Enter student ID", 1, INT_MAX));
        if (index >= 0) {
            matches[match_count++] = index;
        }
    } else {
        char query[NAME_SIZE];
        prompt_text(mode == 2 ? "Enter part of the name" : "Enter part of the department",
                    query, sizeof query);

        for (int i = 0; i < count; i++) {
            const char *field = (mode == 2) ? students[i].name : students[i].dept;
            if (contains_ignore_case(field, query)) {
                matches[match_count++] = i;
            }
        }
    }

    if (match_count == 0) {
        printf("Student not found.\n");
        return -1;
    }
    if (match_count == 1) {
        return matches[0];
    }

    printf("\nMultiple students found:\n");
    print_header();
    for (int i = 0; i < match_count; i++) {
        print_row(&students[matches[i]]);
    }

    int id = prompt_int("\nEnter the ID of the student you want", 1, INT_MAX);
    for (int i = 0; i < match_count; i++) {
        if (students[matches[i]].id == id) {
            return matches[i];
        }
    }
    printf("That ID isn't in the list above.\n");
    return -1;
}

/* ---- menu actions ---- */

static void add_students(void)
{
    int room = MAX_STUDENTS - count;
    if (room == 0) {
        printf("The student record is full (%d students).\n", MAX_STUDENTS);
        return;
    }

    int how_many = prompt_int("How many students do you want to add", 1, room);

    for (int i = 0; i < how_many; i++) {
        struct Student s;
        memset(&s, 0, sizeof s);

        for (;;) {
            s.id = prompt_int("Enter student ID", 1, INT_MAX);
            if (find_student(students, count, s.id) < 0) {
                break;
            }
            printf("  That ID already exists. Enter a different ID.\n");
        }

        prompt_details(&s);
        students[count++] = s;
        printf("Student added.\n\n");
    }

    save_or_warn("Student records saved.");
}

static void list_students(void)
{
    if (count == 0) {
        printf("\nNo students yet. Choose 1 to add one.\n");
        return;
    }

    print_header();
    for (int i = 0; i < count; i++) {
        print_row(&students[i]);
    }
}

static void search_students(void)
{
    int index = select_student("Search");
    if (index >= 0) {
        print_details(&students[index]);
    }
}

static void update_student(void)
{
    int index = select_student("Update");
    if (index < 0) {
        return;
    }

    printf("\nUpdating %s (ID %d). Enter the new details:\n",
           students[index].name, students[index].id);
    prompt_details(&students[index]);
    save_or_warn("Student updated and saved.");
}

static void delete_student(void)
{
    int index = select_student("Delete");
    if (index < 0) {
        return;
    }

    printf("\nDelete %s (ID %d)?\n", students[index].name, students[index].id);
    if (prompt_int("Type 1 to delete, 0 to cancel", 0, 1) == 0) {
        printf("Cancelled. Nothing was deleted.\n");
        return;
    }

    for (int i = index; i < count - 1; i++) {
        students[i] = students[i + 1];
    }
    count--;
    save_or_warn("Student deleted and saved.");
}

int main(void)
{
    if (!load_students(students, &count)) {
        fprintf(stderr, "Could not read %s.\n", data_file_path());
        return 1;
    }

    int choice;
    do {
        printf("\n====== Student Management System ======\n");
        printf("Students on record: %d\n", count);
        printf("  1. Add students\n");
        printf("  2. Show all students\n");
        printf("  3. Search for a student\n");
        printf("  4. Update a student\n");
        printf("  5. Delete a student\n");
        printf("  6. Exit\n");
        choice = prompt_int("Enter your choice", 1, 6);

        switch (choice) {
            case 1: add_students(); break;
            case 2: list_students(); break;
            case 3: search_students(); break;
            case 4: update_student(); break;
            case 5: delete_student(); break;
            default: break;
        }
    } while (choice != 6);

    printf("Goodbye!\n");
    return 0;
}
