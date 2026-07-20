#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct Student {
    int id;
    char name[50];
    int grade;
    int feesPaid; // 0 = no, 1 = yes
    int marks;
};

void addStudent(struct Student s) {
    FILE *fp = fopen("students.db", "a");
    if (fp == NULL) {
        printf("Error opening file!\n");
        return;
    }
    fprintf(fp, "%d,%s,%d,%d,%d\n", s.id, s.name, s.grade, s.feesPaid, s.marks);
    fclose(fp);
    printf("Student added: %s\n", s.name);
}

void listStudents() {
    FILE *fp = fopen("students.db", "r");
    if (fp == NULL) {
        printf("No records yet.\n");
        return;
    }
    char line[200];
    while (fgets(line, sizeof(line), fp)) {
        printf("%s", line);
    }
    fclose(fp);
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        printf("Usage: mj [add|list]\n");
        return 1;
    }

    if (strcmp(argv[1], "add") == 0) {
        if (argc != 6) {
            printf("Usage: mj add <name> <grade> <feesPaid> <marks>\n");
            return 1;
        }
        struct Student s;
        s.id = rand(); // auto ID
        strcpy(s.name, argv[2]);
        s.grade = atoi(argv[3]);
        s.feesPaid = atoi(argv[4]);
        s.marks = atoi(argv[5]);
        addStudent(s);
    } else if (strcmp(argv[1], "list") == 0) {
        listStudents();
    } else {
        printf("Unknown command.\n");
    }

    return 0;
}

