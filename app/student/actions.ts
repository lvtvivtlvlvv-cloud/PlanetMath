"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutAction() {
  cookies().delete("session_token");
  redirect("/login");
}

export async function submitHomeworkAction(data: {
  homeworkId: string;
  studentId: string;
  content: string;
  attachments?: { fileName: string; fileUrl: string; fileType: string; fileSize: number; expiresAt: string }[];
}) {
  const hw = await db.homework.findUnique({
    where: { id: data.homeworkId },
    select: { targetDate: true },
  });

  if (!hw) throw new Error("Задание не найдено.");

  // Проверка срока сдачи (включая конец дня дедлайна)
  const deadline = new Date(hw.targetDate);
  deadline.setHours(23, 59, 59, 999);
  if (new Date() > deadline) {
    throw new Error("Срок сдачи задания истек. Отправка и редактирование заблокированы.");
  }

  const existing = await db.homeworkSubmission.findUnique({
    where: {
      homeworkId_studentId: { homeworkId: data.homeworkId, studentId: data.studentId },
    },
    select: { id: true, grade: true, teacherComment: true },
  });

  if (existing) {
    // Редактирование: обновляем решение, не трогая оценку и комментарий учителя
    if (data.attachments && data.attachments.length > 0) {
      await db.attachment.deleteMany({ where: { submissionId: existing.id } });
    }

    await db.homeworkSubmission.update({
      where: { id: existing.id },
      data: {
        content: data.content,
        submittedAt: new Date(),
        // Если уже стояла оценка, статус не сбрасываем, иначе PENDING
        status: existing.grade ? "GRADED" : "PENDING",
        attachments: data.attachments?.length
          ? {
              create: data.attachments.map((a) => ({
                fileName: a.fileName,
                fileUrl: a.fileUrl,
                fileType: a.fileType,
                fileSize: a.fileSize,
                expiresAt: new Date(a.expiresAt),
              })),
            }
          : undefined,
      },
    });
  } else {
    await db.homeworkSubmission.create({
      data: {
        homeworkId: data.homeworkId,
        studentId: data.studentId,
        content: data.content,
        status: "PENDING",
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
  }

  revalidatePath("/student");
  revalidatePath("/admin");
}

export async function submitEgeItemAnswerAction(data: {
  itemId: string;
  studentId: string;
  studentAnswer: string;
  studentComment?: string;
}) {
  const item = await db.egeAssignmentItem.findUnique({
    where: { id: data.itemId },
    include: { task: true, assignment: true },
  });

  if (!item) throw new Error("Задание не найдено");
  if (item.studentId !== data.studentId) throw new Error("Нет доступа к данному заданию");

  if (item.assignment.deadline) {
    const dl = new Date(item.assignment.deadline);
    dl.setHours(23, 59, 59, 999);
    if (new Date() > dl) {
      throw new Error("Срок сдачи работы истек.");
    }
  }

  const cleanAns = data.studentAnswer.trim().toLowerCase().replace(",", ".");
  let isCorrect: boolean | null = null;
  let score = item.score;
  let status = "SUBMITTED";

  // Для заданий 1-12 с кратким числовым ответом проверяем автоматически
  if (item.task.taskNumber <= 12 && item.task.answer) {
    const targetAns = item.task.answer.trim().toLowerCase().replace(",", ".");
    if (cleanAns === targetAns) {
      isCorrect = true;
      score = 1;
      status = "GRADED";
    } else {
      isCorrect = false;
      score = 0;
      status = "GRADED";
    }
  }

  await db.egeAssignmentItem.update({
    where: { id: item.id },
    data: {
      studentAnswer: data.studentAnswer.trim(),
      studentComment: data.studentComment?.trim() || null,
      status,
      score,
      submittedAt: new Date(),
      gradedAt: status === "GRADED" ? new Date() : item.gradedAt,
    },
  });

  revalidatePath("/student");
  revalidatePath("/admin");
  return { success: true, status, score, isCorrect };
}