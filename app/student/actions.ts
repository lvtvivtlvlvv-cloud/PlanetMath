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