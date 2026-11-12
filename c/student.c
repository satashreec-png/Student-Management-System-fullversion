#include "student.h"

#include <ctype.h>
#include <errno.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

const char *data_file_path(void)
{
    const char *path = getenv("STUDENT_DATA_FILE");
    return (path && *path) ? path : DEFAULT_DATA_FILE;
}

int load_students(struct Student *list, int *count)
{
    FILE *file = fopen(data_file_path(), "rb");
    *count = 0;

    if (file == NULL) {
        return errno == ENOENT; /* no file yet is fine */
    }

    while (*count < MAX_STUDENTS &&
           fread(&list[*count], sizeof(struct Student), 1, file) == 1) {
        (*count)++;
    }

    /* More records than we can hold: refuse, so saving can't drop data. */
    int overflow = (*count == MAX_STUDENTS && fgetc(file) != EOF);

    fclose(file);
    return !overflow;
}

int save_students(const struct Student *list, int count)
{
    char temp_path[1024];
    const char *path = data_file_path();

    if (snprintf(temp_path, sizeof temp_path, "%s.tmp", path) >= (int)sizeof temp_path) {
        return 0;
    }

    FILE *file = fopen(temp_path, "wb");
    if (file == NULL) {
        return 0;
    }

    size_t written = 0;
    if (count > 0) {
        written = fwrite(list, sizeof(struct Student), (size_t)count, file);
    }

    int ok = (written == (size_t)count);
    if (fclose(file) != 0) {
        ok = 0;
    }
    if (!ok) {
        remove(temp_path);
        return 0;
    }

#ifdef _WIN32
    remove(path); /* rename() won't overwrite an existing file on Windows */
#endif
    if (rename(temp_path, path) != 0) {
        remove(temp_path);
        return 0;
    }
    return 1;
}

int find_student(const struct Student *list, int count, int id)
{
    for (int i = 0; i < count; i++) {
        if (list[i].id == id) {
            return i;
        }
    }
    return -1;
}

int valid_text(const char *s)
{
    if (*s == '\0') {
        return 0;
    }
    for (; *s; s++) {
        unsigned char c = (unsigned char)*s;
        if (c < 0x20 || c == 0x7f || c == '|') {
            return 0;
        }
    }
    return 1;
}

static char *trim(char *s)
{
    while (*s && isspace((unsigned char)*s)) {
        s++;
    }
    char *end = s + strlen(s);
    while (end > s && isspace((unsigned char)end[-1])) {
        end--;
    }
    *end = '\0';
    return s;
}

int set_text(char *dst, size_t cap, const char *src)
{
    char copy[512];
    if (strlen(src) >= sizeof copy) {
        return 0;
    }
    strcpy(copy, src);
    char *clean = trim(copy);
    if (strlen(clean) >= cap) {
        return 0;
    }
    strcpy(dst, clean);
    return 1;
}

int contains_ignore_case(const char *haystack, const char *needle)
{
    size_t n = strlen(needle);
    if (n == 0) {
        return 1;
    }
    for (; *haystack; haystack++) {
        size_t i = 0;
        while (i < n && haystack[i] &&
               tolower((unsigned char)haystack[i]) == tolower((unsigned char)needle[i])) {
            i++;
        }
        if (i == n) {
            return 1;
        }
    }
    return 0;
}

const char *validate_student(const struct Student *s)
{
    if (s->id < 1) return "ID must be a positive whole number.";
    if (!valid_text(s->name)) return "Name is required and can't contain '|'.";
    if (s->age < 5 || s->age > 100) return "Age must be between 5 and 100.";
    if (!valid_text(s->college)) return "College is required and can't contain '|'.";
    if (s->year < 1 || s->year > 6) return "Year must be between 1 and 6.";
    if (s->semester < 1 || s->semester > 12) return "Semester must be between 1 and 12.";
    if (!valid_text(s->dept)) return "Department is required and can't contain '|'.";
    return NULL;
}

int read_line(char *buf, size_t size)
{
    if (fgets(buf, (int)size, stdin) == NULL) {
        return 0;
    }

    size_t len = strcspn(buf, "\r\n");
    if (buf[len] == '\0' && len == size - 1) {
        int c; /* line didn't fit: discard the rest of it */
        while ((c = getchar()) != '\n' && c != EOF) {
        }
        return -1;
    }

    buf[len] = '\0';
    return 1;
}

int parse_long(const char *s, long lo, long hi, long *out)
{
    char *end;
    errno = 0;
    long value = strtol(s, &end, 10);

    if (end == s || errno == ERANGE) {
        return 0;
    }
    while (isspace((unsigned char)*end)) {
        end++;
    }
    if (*end != '\0' || value < lo || value > hi) {
        return 0;
    }

    *out = value;
    return 1;
}
