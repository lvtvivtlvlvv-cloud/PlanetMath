"use server";

import { db } from "@/lib/db";
import { generateStudentCredentials, hashPassword } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";

export async function logoutAction() {
  cookies().delete("session_token");
  redirect("/login");
}

export async function createStudentAction(formData: FormData) {
  const fullName = (formData.get("fullName") as string)?.trim();
  const gradeStr = formData.get("grade") as string;
  const letter = (formData.get("letter") as string)?.trim().toUpperCase();
  const examTrackRaw = (formData.get("examTrack") as string)?.trim();

  const grade = parseInt(gradeStr, 10);
  if (!fullName || isNaN(grade) || grade < 1 || grade > 11 || !letter) {
    throw new Error("Некорректные параметры ученика");
  }

  const examTrack = grade === 11 ? (examTrackRaw === "Профиль" ? "Профиль" : "База") : null;

  const className = `${grade}${letter}`;
  let classGroup = await db.classGroup.findUnique({ where: { name: className } });

  if (!classGroup) {
    classGroup = await db.classGroup.create({ data: { grade, letter, name: className } });
  }

  const { login, password } = generateStudentCredentials(fullName, grade, letter);
  const passwordHash = await hashPassword(password);

  await db.user.create({
    data: {
      login,
      passwordHash,
      fullName,
      role: "STUDENT",
      classId: classGroup.id,
      plainPasswordForAdmin: password,
      examTrack,
    },
  });

  revalidatePath("/admin");
  return { success: true, login, password };
}

export async function updateStudentTrackAction(studentId: string, examTrack: "База" | "Профиль") {
  const user = await db.user.findUnique({
    where: { id: studentId },
    include: { classGroup: true },
  });

  if (!user) throw new Error("Ученик не найден");

  await db.user.update({
    where: { id: studentId },
    data: { examTrack },
  });

  revalidatePath("/admin");
  revalidatePath("/student");
  return { success: true };
}

export async function deleteStudentAction(userId: string) {
  await db.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
  return { success: true };
}

export async function createTeacherAction(formData: FormData) {
  const fullName = (formData.get("fullName") as string)?.trim();
  if (!fullName) throw new Error("Укажите ФИО учителя");

  const parts = fullName.split(/\s+/);
  const surnameTranslit = parts[0] ? parts[0].toLowerCase().replace(/[^a-z0-9]/gi, "") : "teacher";
  const randomSuffix = Math.floor(100 + Math.random() * 900).toString();
  const login = `t_${surnameTranslit.slice(0, 6)}_${randomSuffix}`.toLowerCase();

  const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += charset[bytes[i] % charset.length];
  }

  const passwordHash = await hashPassword(password);

  await db.user.create({
    data: {
      login,
      passwordHash,
      fullName,
      role: "ADMIN",
      plainPasswordForAdmin: password,
    },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function deleteTeacherAction(userId: string) {
  const adminCount = await db.user.count({ where: { role: "ADMIN" } });
  if (adminCount <= 1) {
    throw new Error("Нельзя удалить единственного учителя/администратора в системе.");
  }
  await db.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
  return { success: true };
}

export async function createHomeworkAction(data: {
  classId: string;
  subjectName: string;
  targetDate: string;
  title: string;
  description: string;
  targetTrack?: string | null;
  attachments?: { fileName: string; fileUrl: string; fileType: string; fileSize: number; expiresAt: string }[];
}) {
  const targetTrack = data.targetTrack && data.targetTrack !== "ALL" ? data.targetTrack : null;

  await db.homework.create({
    data: {
      classId: data.classId,
      subjectName: data.subjectName.trim(),
      targetDate: new Date(data.targetDate),
      title: data.title.trim(),
      description: data.description.trim(),
      targetTrack,
      attachments: {
        create: data.attachments?.map((a) => ({
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileType: a.fileType,
          fileSize: a.fileSize,
          expiresAt: new Date(a.expiresAt),
        })),
      },
    },
  });

  revalidatePath("/admin");
  revalidatePath("/student");
}

export async function updateHomeworkAction(data: {
  homeworkId: string;
  title: string;
  description: string;
  subjectName: string;
  targetDate: string;
  targetTrack?: string | null;
}) {
  const submissionsCount = await db.homeworkSubmission.count({
    where: { homeworkId: data.homeworkId },
  });

  if (submissionsCount > 0) {
    throw new Error("Запрещено: ученики уже сдали решения.");
  }

  const targetTrack = data.targetTrack && data.targetTrack !== "ALL" ? data.targetTrack : null;

  await db.homework.update({
    where: { id: data.homeworkId },
    data: {
      title: data.title.trim(),
      description: data.description.trim(),
      subjectName: data.subjectName.trim(),
      targetDate: new Date(data.targetDate),
      targetTrack,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/student");
}

export async function deleteHomeworkAction(homeworkId: string) {
  const submissionsCount = await db.homeworkSubmission.count({
    where: { homeworkId },
  });

  if (submissionsCount > 0) {
    throw new Error("Нельзя удалить задание с отправленными решениями.");
  }

  await db.homework.delete({ where: { id: homeworkId } });
  revalidatePath("/admin");
  revalidatePath("/student");
}

export async function gradeSubmissionAction(
  submissionId: string,
  grade: number,
  comment?: string,
  annotationsJson?: string,
  tasksJson?: string,
  canvasWidth?: number,
  canvasHeight?: number,
  modifiedImageUrl?: string
) {
  if (grade < 1 || grade > 5) throw new Error("Оценка должна быть от 1 до 5");

  let packedComment = comment ?? "";
  if (annotationsJson || tasksJson || modifiedImageUrl) {
    try {
      const payload = {
        text: comment ?? "",
        annotations: annotationsJson ? JSON.parse(annotationsJson) : [],
        tasks: tasksJson ? JSON.parse(tasksJson) : {},
        canvasWidth: canvasWidth || 800,
        canvasHeight: canvasHeight || 1066,
        modifiedImageUrl: modifiedImageUrl || "",
      };
      packedComment = JSON.stringify(payload);
    } catch {
      packedComment = comment ?? "";
    }
  }

  await db.homeworkSubmission.update({
    where: { id: submissionId },
    data: { grade, teacherComment: packedComment, status: "GRADED", gradedAt: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath("/student");
}

export interface EditableScheduleRow {
  id?: string;
  classId: string;
  dayOfWeek: number;
  lessonNumber: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  room: string;
  teacherName: string;
}

export async function addSingleLessonAction(lesson: Omit<EditableScheduleRow, "id">) {
  await db.scheduleItem.create({
    data: {
      classId: lesson.classId,
      dayOfWeek: Number(lesson.dayOfWeek),
      lessonNumber: Number(lesson.lessonNumber),
      startTime: lesson.startTime.trim() || "08:30",
      endTime: lesson.endTime.trim() || "09:15",
      subjectName: lesson.subjectName.trim() || "Предмет",
      room: lesson.room.trim() || "101",
      teacherName: lesson.teacherName.trim() || "Учитель",
    },
  });

  revalidatePath("/admin");
  revalidatePath("/student");
}

export async function deleteSingleLessonAction(id: string) {
  await db.scheduleItem.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/student");
}

export async function saveScheduleBatchAction(classId: string, rows: EditableScheduleRow[]) {
  await db.$transaction(async (tx) => {
    await tx.scheduleItem.deleteMany({ where: { classId } });
    if (rows.length > 0) {
      await tx.scheduleItem.createMany({
        data: rows.map((r) => ({
          classId,
          dayOfWeek: Number(r.dayOfWeek),
          lessonNumber: Number(r.lessonNumber),
          startTime: r.startTime.trim() || "08:30",
          endTime: r.endTime.trim() || "09:15",
          subjectName: r.subjectName.trim() || "Предмет",
          room: r.room.trim() || "101",
          teacherName: r.teacherName.trim() || "Учитель",
        })),
      });
    }
  });

  revalidatePath("/admin");
  revalidatePath("/student");
  return { success: true };
}

export async function createEgeTaskAction(data: {
  taskNumber: number;
  topic?: string;
  title: string;
  content: string;
  answer?: string;
  solution?: string;
  difficulty?: string;
}) {
  const taskNumber = Number(data.taskNumber);
  if (isNaN(taskNumber) || taskNumber < 1 || taskNumber > 19) {
    throw new Error("Номер задания должен быть от 1 до 19");
  }
  if (!data.title?.trim() || !data.content?.trim()) {
    throw new Error("Название и условие задания обязательны для заполнения");
  }

  const { EGE_TASK_TOPICS } = await import("@/lib/ege-constants");
  const meta = EGE_TASK_TOPICS[taskNumber] || { topic: `Задание №${taskNumber}`, difficulty: "BASE" as const };

  const task = await db.egeTask.create({
    data: {
      taskNumber,
      topic: data.topic?.trim() || meta.topic,
      title: data.title.trim(),
      content: data.content.trim(),
      answer: data.answer?.trim() || null,
      solution: data.solution?.trim() || null,
      difficulty: data.difficulty || meta.difficulty,
      source: "MANUAL",
    },
  });

  revalidatePath("/admin");
  return { success: true, taskId: task.id };
}

export async function deleteEgeTaskAction(taskId: string) {
  await db.egeTask.delete({ where: { id: taskId } });
  revalidatePath("/admin");
  return { success: true };
}

export async function createEgeAssignmentAction(data: {
  title: string;
  teacherComment?: string;
  targetType: "student" | "class";
  targetId: string; // studentId or classId
  targetTrack?: string | null; // "База" | "Профиль" | "ALL"
  deadline?: string;
  countsByType: Record<number, number>; // e.g. { 1: 5, 12: 2 }
}) {
  const title = data.title?.trim();
  if (!title) throw new Error("Укажите название работы");

  const counts = data.countsByType || {};
  const requestedTaskNumbers = Object.entries(counts)
    .filter(([_, count]) => Number(count) > 0)
    .map(([num, count]) => ({ taskNumber: Number(num), count: Number(count) }));

  if (requestedTaskNumbers.length === 0) {
    throw new Error("Выберите хотя бы один тип задания и укажите количество");
  }

  // Определяем список учеников, которым выдается работа
  let recipientStudents: { id: string; fullName: string }[] = [];

  if (data.targetType === "student") {
    const student = await db.user.findUnique({
      where: { id: data.targetId },
      select: { id: true, fullName: true, examTrack: true },
    });
    if (!student) throw new Error("Ученик не найден");
    recipientStudents = [student];
  } else {
    // Выдача классу
    const usersInClass = await db.user.findMany({
      where: {
        classId: data.targetId,
        role: "STUDENT",
        ...(data.targetTrack && data.targetTrack !== "ALL"
          ? {
              OR: [
                { examTrack: data.targetTrack },
                { examTrack: null },
              ],
            }
          : {}),
      },
      select: { id: true, fullName: true, examTrack: true },
    });

    if (usersInClass.length === 0) {
      throw new Error("В выбранном классе нет учеников для назначения");
    }
    recipientStudents = usersInClass;
  }

  const deadlineDate = data.deadline ? new Date(data.deadline) : null;

  // Предзагружаем пул заданий по каждому запрошенному номеру
  const tasksByNumber: Record<number, any[]> = {};
  for (const { taskNumber } of requestedTaskNumbers) {
    const tasks = await db.egeTask.findMany({
      where: { taskNumber },
      orderBy: { createdAt: "asc" },
    });
    tasksByNumber[taskNumber] = tasks;
  }

  // Создаем работы для каждого ученика
  for (const student of recipientStudents) {
    const assignment = await db.egeAssignment.create({
      data: {
        title,
        teacherComment: data.teacherComment?.trim() || null,
        targetClassId: data.targetType === "class" ? data.targetId : null,
        studentId: student.id,
        targetTrack: data.targetTrack || null,
        deadline: deadlineDate,
      },
    });

    let orderIndex = 0;
    const itemsToCreate: { assignmentId: string; taskId: string; studentId: string; orderIndex: number; maxScore: number }[] = [];

    for (const { taskNumber, count } of requestedTaskNumbers) {
      const pool = tasksByNumber[taskNumber] || [];
      if (pool.length === 0) continue;

      // Перемешиваем или выбираем нужное количество
      for (let i = 0; i < count; i++) {
        const pickedTask = pool[i % pool.length];
        const isPart2 = taskNumber >= 13;
        const maxScore = taskNumber >= 17 ? 3 : isPart2 ? 2 : 1;

        itemsToCreate.push({
          assignmentId: assignment.id,
          taskId: pickedTask.id,
          studentId: student.id,
          orderIndex: orderIndex++,
          maxScore,
        });
      }
    }

    if (itemsToCreate.length > 0) {
      await db.egeAssignmentItem.createMany({
        data: itemsToCreate,
      });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/student");
  return { success: true, countAssigned: recipientStudents.length };
}

export async function deleteEgeAssignmentAction(assignmentId: string) {
  await db.egeAssignment.delete({ where: { id: assignmentId } });
  revalidatePath("/admin");
  revalidatePath("/student");
  return { success: true };
}

export async function reseedEgeTasksAction() {
  const { INITIAL_FIPI_TASKS } = await import("@/lib/ege-constants");
  for (const item of INITIAL_FIPI_TASKS) {
    const existing = await db.egeTask.findFirst({
      where: { taskNumber: item.taskNumber, title: item.title },
    });
    if (!existing) {
      await db.egeTask.create({
        data: {
          taskNumber: item.taskNumber,
          topic: item.topic,
          title: item.title,
          content: item.content,
          answer: item.answer,
          solution: item.solution,
          difficulty: item.difficulty,
          source: "FIPI",
        },
      });
    }
  }
  revalidatePath("/admin");
  return { success: true };
}