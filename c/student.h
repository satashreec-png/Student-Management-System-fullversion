/*
 * student.h - shared definitions for the Student Management System.
 *
 * Used by both the interactive CLI (cli.c) and the engine that the Node.js
 * server talks to (engine.c). The on-disk format is an array of raw
 * struct Student records, so files written by the original version of this
 * project keep working.
 */
#ifndef STUDENT_H
#define STUDENT_H

#include <stddef.h>

#define MAX_STUDENTS 1000
#define NAME_SIZE 50
#define COLLEGE_SIZE 100
#define DEPT_SIZE 50
#define DEFAULT_DATA_FILE "data/Students.dat"

struct Student {
    int id;
    char name[NAME_SIZE];
    int age;
    char college[COLLEGE_SIZE];
    int year;
    int semester;
    char dept[DEPT_SIZE];
};

/* Path of the data file: $STUDENT_DATA_FILE, or data/Students.dat. */
const char *data_file_path(void);

/* Loads all records. Returns 1 on success (a missing file is an empty list). */
int load_students(struct Student *list, int *count);

/* Saves all records using a temp file + rename so a crash can't corrupt data. */
int save_students(const struct Student *list, int count);

/* Returns the index of the student with this id, or -1. */
int find_student(const struct Student *list, int count, int id);

/* Returns NULL if the student is valid, otherwise a human-readable reason. */
const char *validate_student(const struct Student *s);

/* Text helpers. */
int valid_text(const char *s);                          /* non-empty, no '|' or control chars */
int set_text(char *dst, size_t cap, const char *src);   /* trim + copy; 0 if it doesn't fit */
int contains_ignore_case(const char *haystack, const char *needle);

/* Input helpers for stdin. */
int read_line(char *buf, size_t size);                  /* 1 ok, 0 EOF, -1 line too long */
int parse_long(const char *s, long lo, long hi, long *out);

#endif
