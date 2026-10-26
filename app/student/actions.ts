"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/session";
import { normalizeAttachments } from "@/lib/uploads";
import { endOfDay } from "@/lib/dates";

export async function logoutAction() {
  cookies().delete("session_token");
  redirect("/login");
}

/**
 * Приводит ответ ученика к сравнимому виду:
 * unicode-минус → дефис, все запятые → точки, убираем пробелы и хвостовую точку.
 */
function normalizeAnswer(raw: string): string {
  return raw
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/^\+/, "")
    .replace(/\.$/, "");
}

export async function submitHomeworkAction(data: {
  homeworkId: string;
  studentId?: string;
  content: string;
  attachments?: { fileName: string; fileUrl: string; fileType: string; fileSize: number; expiresAt: string }[];
}) {
  // Кто сдаёт — берём из сессии, а не из тела запроса.
  const me = await requireStudent();

  const homework = await db.homework.findUnique({
    where: { id: data.homeworkId },
    select: { id: true, classId: true, targetDate: true, targetTrack: true },
  });

  if (!homework) throw new Error("Задание не найдено.");
  if (homework.classId !== me.classId) throw new Error("Это задание не из вашего класса.");

  const myTrack = me.examTrack || (me.classGroup?.grade === 11 ? "База" : null);
  if (
    me.classGroup?.grade === 11 &&
    myTrack &&
    homework.targetTrack &&
    homework.targetTrack !== "ALL" &&
    homework.targetTrack !== myTrack
  ) {
    throw new Error("Задание выдано для другого экзаменационного трека.");
  }

  if (new Date() > endOfDay(homework.targetDate)) {
    throw new Error("Срок сдачи задания истек. Отправка и редактирование заблокированы.");
  }

  const content = typeof data.content === "string" ? data.content.trim() : "";
  if (!content) throw new Error("Напишите ответ или комментарий к работе.");
  if (content.length > 20000) throw new Error("Слишком длинный текст решения.");

  const attachments = normalizeAttachments(data.attachments);

  const existing = await db.homeworkSubmission.findUnique({
    where: { homeworkId_studentId: { homeworkId: data.homeworkId, studentId: me.id } },
    select: { id: true, grade: true },
  });

  if (existing) {
    // Проверенную работу редактировать нельзя: иначе оценка относится к другому тексту.
    if (existing.grade !== null) {
      throw new Error("Работа уже проверена учителем — редактирование недоступно.");
    }

    if (attachments.length > 0) {
      await db.attachment.deleteMany({ where: { submissionId: existing.id } });
    }

    await db.homeworkSubmission.update({
      where: { id: existing.id },
      data: {
        content,
        submittedAt: new Date(),
        status: "PENDING",
        attachments: attachments.length > 0 ? { create: attachments } : undefined,
      },
    });
  } else {
    await db.homeworkSubmission.create({
      data: {
        homeworkId: data.homeworkId,
        studentId: me.id,
        content,
        status: "PENDING",
        attachments: attachments.length > 0 ? { create: attachments } : undefined,
      },
    });
  }

  revalidatePath("/student");
  revalidatePath("/admin");
}

export async function submitEgeItemAnswerAction(data: {
  itemId: string;
  studentId?: string;
  studentAnswer: string;
  studentComment?: string;
}) {
  const me = await requireStudent();

  const item = await db.egeAssignmentItem.findUnique({
    where: { id: data.itemId },
    include: { task: true, assignment: true },
  });

  if (!item) throw new Error("Задание не найдено");
  if (item.studentId !== me.id) throw new Error("Нет доступа к данному заданию");

  if (item.status === "GRADED") {
    throw new Error("Задание уже проверено — повторная отправка ответа недоступна.");
  }

  if (item.assignment.deadline && new Date() > endOfDay(item.assignment.deadline)) {
    throw new Error("Срок сдачи работы истек.");
  }

  const studentAnswer = typeof data.studentAnswer === "string" ? data.studentAnswer.trim() : "";
  if (!studentAnswer) throw new Error("Введите ответ");

  const comment = typeof data.studentComment === "string" ? data.studentComment.trim() : "";

  let isCorrect: boolean | null = null;
  let score: number | null = null;
  let status = "SUBMITTED";

  // Для заданий 1–12 с кратким ответом проверяем автоматически.
  if (item.task.taskNumber <= 12 && item.task.answer) {
    isCorrect = normalizeAnswer(studentAnswer) === normalizeAnswer(item.task.answer);
    score = isCorrect ? 1 : 0;
    status = "GRADED";
  }

  await db.egeAssignmentItem.update({
    where: { id: item.id },
    data: {
      studentAnswer,
      studentComment: comment || null,
      status,
      score,
      submittedAt: new Date(),
      gradedAt: status === "GRADED" ? new Date() : null,
    },
  });

  revalidatePath("/student");
  revalidatePath("/admin");
  return { success: true, status, score, isCorrect };
}
