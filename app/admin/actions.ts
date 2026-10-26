"use server";

import { Prisma } from "@prisma/client";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { generateStudentCredentials, hashPassword } from "@/lib/auth-utils";
import { requireAdmin } from "@/lib/session";
import { normalizeAttachments } from "@/lib/uploads";
import { parseYmd } from "@/lib/dates";

export async function logoutAction() {
  cookies().delete("session_token");
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generatePassword(): string {
  const bytes = crypto.randomBytes(8);
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return password;
}

function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Заполните поле «${field}»`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`Поле «${field}» длиннее ${maxLength} символов`);
  }
  return trimmed;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeTrack(value: unknown): string | null {
  return value === "База" || value === "Профиль" ? value : null;
}

function requireTime(value: unknown, field: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) {
    throw new Error(`Поле «${field}» должно быть в формате ЧЧ:ММ`);
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Ученики
// ---------------------------------------------------------------------------

export async function createStudentAction(formData: FormData) {
  await requireAdmin();

  const fullName = requireText(formData.get("fullName"), "ФИО ученика", 120).replace(/\s+/g, " ");
  const grade = parseInt(String(formData.get("grade")), 10);
  const letter = requireText(formData.get("letter"), "Буква класса", 2).toUpperCase();
  const examTrackRaw = formData.get("examTrack");

  if (Number.isNaN(grade) || grade < 1 || grade > 11) {
    throw new Error("Класс должен быть от 1 до 11");
  }

  const examTrack = grade === 11 ? normalizeTrack(examTrackRaw) || "База" : null;
  const className = `${grade}${letter}`;

  let classGroup = await db.classGroup.findUnique({ where: { name: className } });
  if (!classGroup) {
    classGroup = await db.classGroup.create({ data: { grade, letter, name: className } });
  }

  // Логин генерируется случайно — при коллизии пробуем ещё раз, а не падаем 500.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { login, password } = generateStudentCredentials(fullName, grade, letter);
    const passwordHash = await hashPassword(password);

    try {
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
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  throw new Error("Не удалось подобрать свободный логин. Попробуйте ещё раз.");
}

export async function updateStudentTrackAction(studentId: string, examTrack: "База" | "Профиль") {
  await requireAdmin();

  if (examTrack !== "База" && examTrack !== "Профиль") {
    throw new Error("Недопустимый экзаменационный трек");
  }

  const student = await db.user.findUnique({
    where: { id: studentId },
    include: { classGroup: true },
  });

  if (!student || student.role !== "STUDENT") throw new Error("Ученик не найден");
  if (student.classGroup?.grade !== 11) {
    throw new Error("Экзаменационный трек доступен только для 11 класса");
  }

  await db.user.update({ where: { id: studentId }, data: { examTrack } });

  revalidatePath("/admin");
  revalidatePath("/student");
  return { success: true };
}

export async function deleteStudentAction(userId: string) {
  await requireAdmin();

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) throw new Error("Пользователь не найден");
  if (target.role !== "STUDENT") {
    throw new Error("Через этот раздел можно удалять только учеников");
  }

  await db.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Учителя
// ---------------------------------------------------------------------------

export async function createTeacherAction(formData: FormData) {
  await requireAdmin();

  const fullName = requireText(formData.get("fullName"), "ФИО учителя", 120).replace(/\s+/g, " ");

  const surname = fullName.split(/\s+/)[0] || "teacher";
  const surnameTranslit = surname.toLowerCase().replace(/[^a-z0-9]/gi, "") || "teacher";
  const randomSuffix = crypto.randomInt(100, 1000).toString();

  for (let attempt = 0; attempt < 6; attempt++) {
    const login = `t_${surnameTranslit.slice(0, 6)}_${randomSuffix}${attempt || ""}`.toLowerCase();
    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    try {
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
      return { success: true, login, password };
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  throw new Error("Не удалось подобрать свободный логин. Попробуйте ещё раз.");
}

export async function deleteTeacherAction(userId: string) {
  const me = await requireAdmin();

  if (userId === me.id) {
    throw new Error("Нельзя удалить собственную учётную запись");
  }

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) throw new Error("Пользователь не найден");
  if (target.role !== "ADMIN") {
    throw new Error("Этот пользователь не является учителем");
  }

  const adminCount = await db.user.count({ where: { role: "ADMIN" } });
  if (adminCount <= 1) {
    throw new Error("Нельзя удалить единственного учителя/администратора в системе.");
  }

  await db.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Домашние задания
// ---------------------------------------------------------------------------

export async function createHomeworkAction(data: {
  classId: string;
  subjectName: string;
  targetDate: string;
  title: string;
  description: string;
  targetTrack?: string | null;
  attachments?: { fileName: string; fileUrl: string; fileType: string; fileSize: number; expiresAt: string }[];
}) {
  await requireAdmin();

  const classGroup = await db.classGroup.findUnique({ where: { id: data.classId } });
  if (!classGroup) throw new Error("Класс не найден");

  const targetDate = parseYmd(data.targetDate);
  const attachments = normalizeAttachments(data.attachments);

  await db.homework.create({
    data: {
      classId: data.classId,
      subjectName: requireText(data.subjectName, "Предмет", 80),
      targetDate,
      title: requireText(data.title, "Тема задания", 200),
      description: optionalText(data.description, 5000) || "",
      targetTrack: normalizeTrack(data.targetTrack),
      attachments: attachments.length > 0 ? { create: attachments } : undefined,
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
  await requireAdmin();

  const homework = await db.homework.findUnique({ where: { id: data.homeworkId } });
  if (!homework) throw new Error("Задание не найдено");

  const submissionsCount = await db.homeworkSubmission.count({
    where: { homeworkId: data.homeworkId },
  });

  if (submissionsCount > 0) {
    throw new Error("Запрещено: ученики уже сдали решения.");
  }

  await db.homework.update({
    where: { id: data.homeworkId },
    data: {
      title: requireText(data.title, "Тема задания", 200),
      description: optionalText(data.description, 5000) || "",
      subjectName: requireText(data.subjectName, "Предмет", 80),
      targetDate: parseYmd(data.targetDate),
      // Если поле не передали — сохраняем текущее значение, а не обнуляем.
      targetTrack:
        data.targetTrack === undefined ? homework.targetTrack : normalizeTrack(data.targetTrack),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/student");
}

export async function deleteHomeworkAction(homeworkId: string) {
  await requireAdmin();

  const submissionsCount = await db.homeworkSubmission.count({ where: { homeworkId } });
  if (submissionsCount > 0) {
    throw new Error("Нельзя удалить задание с отправленными решениями.");
  }

  await db.homework.delete({ where: { id: homeworkId } });
  revalidatePath("/admin");
  revalidatePath("/student");
}

// ---------------------------------------------------------------------------
// Проверка работ
// ---------------------------------------------------------------------------

const MAX_PACKED_COMMENT = 200_000;

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
  await requireAdmin();

  const numericGrade = Number(grade);
  if (!Number.isInteger(numericGrade) || numericGrade < 1 || numericGrade > 5) {
    throw new Error("Оценка должна быть от 1 до 5");
  }

  const submission = await db.homeworkSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) throw new Error("Работа не найдена");

  const text = optionalText(comment, 5000) || "";

  let packedComment = text;
  if (annotationsJson || tasksJson || modifiedImageUrl) {
    // Размер проверяем до разбора: клиент может прислать мегабайты JSON.
    if ((annotationsJson?.length || 0) + (tasksJson?.length || 0) > MAX_PACKED_COMMENT) {
      throw new Error("Слишком большой объём пометок");
    }

    const payload = {
      text,
      annotations: annotationsJson ? JSON.parse(annotationsJson) : [],
      tasks: tasksJson ? JSON.parse(tasksJson) : {},
      canvasWidth: Math.min(Math.max(Number(canvasWidth) || 800, 1), 10000),
      canvasHeight: Math.min(Math.max(Number(canvasHeight) || 1066, 1), 10000),
      // Только URL загруженного файла, никакого base64 в БД.
      modifiedImageUrl:
        typeof modifiedImageUrl === "string" && modifiedImageUrl.startsWith("/uploads/")
          ? modifiedImageUrl
          : "",
    };
    packedComment = JSON.stringify(payload);
  }

  await db.homeworkSubmission.update({
    where: { id: submissionId },
    data: { grade: numericGrade, teacherComment: packedComment, status: "GRADED", gradedAt: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath("/student");
}

// ---------------------------------------------------------------------------
// Расписание
// ---------------------------------------------------------------------------

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

function normalizeScheduleRow(row: EditableScheduleRow, classId: string) {
  const dayOfWeek = Number(row.dayOfWeek);
  const lessonNumber = Number(row.lessonNumber);

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
    throw new Error("День недели должен быть от 1 (пн) до 7 (вс)");
  }
  if (!Number.isInteger(lessonNumber) || lessonNumber < 1 || lessonNumber > 12) {
    throw new Error("Номер урока должен быть от 1 до 12");
  }

  return {
    classId,
    dayOfWeek,
    lessonNumber,
    startTime: requireTime(row.startTime, "Начало"),
    endTime: requireTime(row.endTime, "Конец"),
    subjectName: requireText(row.subjectName, "Предмет", 80),
    room: optionalText(row.room, 20) || "—",
    teacherName: optionalText(row.teacherName, 120) || "Учитель",
  };
}

export async function addSingleLessonAction(lesson: Omit<EditableScheduleRow, "id">) {
  await requireAdmin();

  const classGroup = await db.classGroup.findUnique({ where: { id: lesson.classId } });
  if (!classGroup) throw new Error("Класс не найден");

  const data = normalizeScheduleRow(lesson as EditableScheduleRow, lesson.classId);

  const duplicate = await db.scheduleItem.findFirst({
    where: {
      classId: data.classId,
      dayOfWeek: data.dayOfWeek,
      lessonNumber: data.lessonNumber,
    },
  });
  if (duplicate) {
    throw new Error(`Урок №${data.lessonNumber} в этот день уже существует`);
  }

  await db.scheduleItem.create({ data });

  revalidatePath("/admin");
  revalidatePath("/student");
}

export async function deleteSingleLessonAction(id: string) {
  await requireAdmin();
  await db.scheduleItem.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/student");
}

export async function saveScheduleBatchAction(classId: string, rows: EditableScheduleRow[]) {
  await requireAdmin();

  const classGroup = await db.classGroup.findUnique({ where: { id: classId } });
  if (!classGroup) throw new Error("Класс не найден");

  const normalized = rows.map((row) => normalizeScheduleRow(row, classId));

  // Два урока на одном месте ломают сетку — проверяем до записи.
  const seen = new Set<string>();
  for (const row of normalized) {
    const key = `${row.dayOfWeek}-${row.lessonNumber}`;
    if (seen.has(key)) {
      throw new Error(`Дублируется урок №${row.lessonNumber} в дне ${row.dayOfWeek}`);
    }
    seen.add(key);
  }

  await db.$transaction(async (tx) => {
    await tx.scheduleItem.deleteMany({ where: { classId } });
    if (normalized.length > 0) {
      await tx.scheduleItem.createMany({ data: normalized });
    }
  });

  revalidatePath("/admin");
  revalidatePath("/student");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Банк ЕГЭ
// ---------------------------------------------------------------------------

export async function createEgeTaskAction(data: {
  taskNumber: number;
  topic?: string;
  title: string;
  content: string;
  answer?: string;
  solution?: string;
  difficulty?: string;
}) {
  await requireAdmin();

  const taskNumber = Number(data.taskNumber);
  if (!Number.isInteger(taskNumber) || taskNumber < 1 || taskNumber > 19) {
    throw new Error("Номер задания должен быть от 1 до 19");
  }

  const { EGE_TASK_TOPICS } = await import("@/lib/ege-constants");
  const meta = EGE_TASK_TOPICS[taskNumber] || {
    topic: `Задание №${taskNumber}`,
    difficulty: "BASE" as const,
  };

  const task = await db.egeTask.create({
    data: {
      taskNumber,
      topic: optionalText(data.topic, 120) || meta.topic,
      title: requireText(data.title, "Название задания", 200),
      content: requireText(data.content, "Условие задания", 10000),
      answer: optionalText(data.answer, 500),
      solution: optionalText(data.solution, 10000),
      difficulty: data.difficulty || meta.difficulty,
      source: "MANUAL",
    },
  });

  revalidatePath("/admin");
  return { success: true, taskId: task.id };
}

export async function deleteEgeTaskAction(taskId: string) {
  await requireAdmin();
  await db.egeTask.delete({ where: { id: taskId } });
  revalidatePath("/admin");
  return { success: true };
}

/** Перемешивает пул и берёт не больше, чем в нём есть — без дублей. */
function pickDistinct<T>(pool: T[], count: number): T[] {
  if (pool.length === 0 || count <= 0) return [];

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export async function createEgeAssignmentAction(data: {
  title: string;
  teacherComment?: string;
  targetType: "student" | "class";
  targetId: string;
  targetTrack?: string | null;
  deadline?: string;
  countsByType: Record<number, number>;
}) {
  await requireAdmin();

  const title = requireText(data.title, "Название работы", 200);

  const requested = Object.entries(data.countsByType || {})
    .map(([num, count]) => ({ taskNumber: Number(num), count: Number(count) }))
    .filter(
      (item) =>
        Number.isInteger(item.taskNumber) &&
        item.taskNumber >= 1 &&
        item.taskNumber <= 19 &&
        Number.isInteger(item.count) &&
        item.count > 0
    )
    .map((item) => ({ ...item, count: Math.min(item.count, 20) }));

  if (requested.length === 0) {
    throw new Error("Выберите хотя бы один тип задания и укажите количество");
  }

  let recipients: { id: string }[] = [];

  if (data.targetType === "student") {
    const student = await db.user.findUnique({
      where: { id: data.targetId },
      select: { id: true, role: true },
    });
    if (!student || student.role !== "STUDENT") throw new Error("Ученик не найден");
    recipients = [student];
  } else {
    const track = normalizeTrack(data.targetTrack);
    const students = await db.user.findMany({
      where: {
        classId: data.targetId,
        role: "STUDENT",
        ...(track ? { OR: [{ examTrack: track }, { examTrack: null }] } : {}),
      },
      select: { id: true },
    });

    if (students.length === 0) {
      throw new Error("В выбранном классе нет учеников для назначения");
    }
    recipients = students;
  }

  const deadline = data.deadline ? parseYmd(data.deadline) : null;

  const pools: Record<number, { id: string; taskCode: string | null }[]> = {};
  for (const { taskNumber } of requested) {
    pools[taskNumber] = await db.egeTask.findMany({
      where: { taskNumber },
      select: { id: true, taskCode: true },
      orderBy: { createdAt: "asc" },
    });
  }

  // Задания, которые ученик уже получал: новую работу собираем из «свежих»,
  // чтобы случайный подбор не выдавал те же прототипы второй раз.
  const usedByStudent = new Map<string, Set<string>>();
  if (recipients.length > 0) {
    const usedRows = await db.egeAssignmentItem.findMany({
      where: { studentId: { in: recipients.map((r) => r.id) } },
      select: { studentId: true, taskId: true },
    });
    for (const row of usedRows) {
      let set = usedByStudent.get(row.studentId);
      if (!set) {
        set = new Set<string>();
        usedByStudent.set(row.studentId, set);
      }
      set.add(row.taskId);
    }
  }

  const exampleCodes: string[] = [];

  // Всё или ничего: половина класса с работой, половина без — хуже, чем ошибка.
  const result = await db.$transaction(async (tx) => {
    let assigned = 0;
    let skipped = 0;

    for (const student of recipients) {
      const isFirstStudent = assigned === 0;
      const used = usedByStudent.get(student.id) ?? new Set<string>();

      const assignment = await tx.egeAssignment.create({
        data: {
          title,
          teacherComment: optionalText(data.teacherComment, 2000),
          targetClassId: data.targetType === "class" ? data.targetId : null,
          studentId: student.id,
          targetTrack: normalizeTrack(data.targetTrack),
          deadline,
        },
      });

      let orderIndex = 0;
      const items: {
        assignmentId: string;
        taskId: string;
        studentId: string;
        orderIndex: number;
        maxScore: number;
      }[] = [];

      for (const { taskNumber, count } of requested) {
        const pool = pools[taskNumber] || [];
        if (pool.length === 0) {
          skipped++;
          continue;
        }

        // Сначала пробуем только невыданные ранее задания; если их не хватает —
        // добираем из общего пула (иначе работу просто нечем заполнить).
        const fresh = pool.filter((task) => !used.has(task.id));
        const source = fresh.length >= count ? fresh : pool;
        const picked = pickDistinct(source, count);
        if (picked.length < count) skipped += count - picked.length;

        if (isFirstStudent) {
          for (const task of picked) {
            const code = task.taskCode || `№${taskNumber}`;
            if (!exampleCodes.includes(code)) exampleCodes.push(code);
          }
        }

        for (const task of picked) {
          const isPart2 = taskNumber >= 13;
          const maxScore = taskNumber >= 17 ? 3 : isPart2 ? 2 : 1;
          items.push({
            assignmentId: assignment.id,
            taskId: task.id,
            studentId: student.id,
            orderIndex: orderIndex++,
            maxScore,
          });
        }
      }

      if (items.length > 0) {
        await tx.egeAssignmentItem.createMany({ data: items });
      }
      assigned++;
    }

    return { assigned, skipped };
  });

  revalidatePath("/admin");
  revalidatePath("/student");

  return {
    success: true,
    countAssigned: result.assigned,
    skippedTasks: result.skipped,
    exampleCodes: exampleCodes.slice(0, 8),
  };
}

export async function deleteEgeAssignmentAction(assignmentId: string) {
  await requireAdmin();
  await db.egeAssignment.delete({ where: { id: assignmentId } });
  revalidatePath("/admin");
  revalidatePath("/student");
  return { success: true };
}

export async function reseedEgeTasksAction() {
  await requireAdmin();

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

export async function syncFromLocalPdfAction() {
  await requireAdmin();

  const { ensureEgeTasksInitialized } = await import("@/lib/ege-init");
  const total = await ensureEgeTasksInitialized();

  revalidatePath("/admin");
  revalidatePath("/student");
  return { success: true, total, added: 0, updated: total };
}
