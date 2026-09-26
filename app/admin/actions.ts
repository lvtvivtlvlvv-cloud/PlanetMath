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

  const grade = parseInt(gradeStr, 10);
  if (!fullName || isNaN(grade) || grade < 1 || grade > 11 || !letter) {
    throw new Error("Некорректные параметры ученика");
  }

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
    },
  });

  revalidatePath("/admin");
  return { success: true, login, password };
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
  attachments?: { fileName: string; fileUrl: string; fileType: string; fileSize: number; expiresAt: string }[];
}) {
  await db.homework.create({
    data: {
      classId: data.classId,
      subjectName: data.subjectName.trim(),
      targetDate: new Date(data.targetDate),
      title: data.title.trim(),
      description: data.description.trim(),
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
}) {
  const submissionsCount = await db.homeworkSubmission.count({
    where: { homeworkId: data.homeworkId },
  });

  if (submissionsCount > 0) {
    throw new Error("Запрещено: ученики уже сдали решения.");
  }

  await db.homework.update({
    where: { id: data.homeworkId },
    data: {
      title: data.title.trim(),
      description: data.description.trim(),
      subjectName: data.subjectName.trim(),
      targetDate: new Date(data.targetDate),
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

export async function gradeSubmissionAction(submissionId: string, grade: number, comment?: string) {
  if (grade < 1 || grade > 5) throw new Error("Оценка должна быть от 1 до 5");

  await db.homeworkSubmission.update({
    where: { id: submissionId },
    data: { grade, teacherComment: comment ?? null, status: "GRADED", gradedAt: new Date() },
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