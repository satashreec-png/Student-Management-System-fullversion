# Builds the two C programs into bin/.  Usage: make | make test | make clean
CC      ?= gcc
CFLAGS  ?= -std=c11 -Wall -Wextra -O2

all: bin/student_engine bin/student_cli

bin/student_engine: c/engine.c c/student.c c/student.h
	$(CC) $(CFLAGS) -o $@ c/engine.c c/student.c

bin/student_cli: c/cli.c c/student.c c/student.h
	$(CC) $(CFLAGS) -o $@ c/cli.c c/student.c

test: all
	npm test

clean:
	rm -f bin/student_engine bin/student_engine.exe bin/student_cli bin/student_cli.exe

.PHONY: all test clean
