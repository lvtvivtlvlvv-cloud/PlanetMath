import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { StudentDashboard } from "@/components/student-dashboard";

export const dynamic = "force-dynamic";

function safeIsoDate(val: any): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().split("T")[0];
  if (typeof val === "string") return val.split("T")[0];
  try {
    return new Date(val).toISOString().split("T")[0];
  } catch {
    return String(val);
  }
}

function safeIsoFull(val: any): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  try {
    return new Date(val).toISOString();
  } catch {
    return String(val);
  }
}

export default async function StudentPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) redirect("/login");

  const payload = await verifySessionToken(token);
  if (!payload || payload.role !== "STUDENT") {
    redirect("/login");
  }

  let studentUser = await db.user.findUnique({
    where: { id: payload.userId },
    include: { classGroup: true },
  });

  if (!studentUser) {
    redirect("/login");
  }

  let studentClassId = studentUser.classId;
  let currentClassGroup = studentUser.classGroup;

  if (!studentClassId || !currentClassGroup) {
    let defaultClass = await db.classGroup.findFirst({
      orderBy: [{ grade: "asc" }, { letter: "asc" }],
    });

    if (!defaultClass) {
      defaultClass = await db.classGroup.create({
        data: { grade: 6, letter: "А", name: "6А" },
      });
    }

    studentUser = await db.user.update({
      where: { id: studentUser.id },
      data: { classId: defaultClass.id },
      include: { classGroup: true },
    });

    studentClassId = defaultClass.id;
    currentClassGroup = defaultClass;
  }

  const [scheduleItems, homeworks, submissions] = await Promise.all([
    db.scheduleItem.findMany({
      where: { classId: studentClassId },
      orderBy: [{ dayOfWeek: "asc" }, { lessonNumber: "asc" }],
    }),
    db.homework.findMany({
      where: { classId: studentClassId },
      include: { attachments: true },
      orderBy: { targetDate: "desc" },
    }),
    db.homeworkSubmission.findMany({
      where: { studentId: studentUser.id },
      include: { attachments: true },
    }),
  ]);

  let formattedHomeworks = homeworks.map((h) => {
    const sub = submissions.find((s) => s.homeworkId === h.id);
    return {
      id: h.id,
      subjectName: h.subjectName,
      targetDate: safeIsoDate(h.targetDate),
      title: h.title,
      description: h.description,
      attachments: (h.attachments || []).map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileType: a.fileType,
        expiresAt: safeIsoFull(a.expiresAt),
      })),
      submission: sub
        ? {
            id: sub.id,
            content: sub.content,
            submittedAt: safeIsoFull(sub.submittedAt),
            status: sub.status,
            grade: sub.grade,
            teacherComment: sub.teacherComment,
            attachments: (sub.attachments || []).map((a) => ({
              id: a.id,
              fileName: a.fileName,
              fileUrl: a.fileUrl,
              fileType: a.fileType,
            })),
          }
        : null,
    };
  });

  if (formattedHomeworks.length === 0) {
    formattedHomeworks = [
      {
        id: "hw_sample_vectors",
        subjectName: "Алгебра",
        targetDate: "2026-09-16",
        title: "Векторы на плоскости",
        description: "Все типы задания № 2. Выполнить 14 прототипов в тетради с подробными пояснениями.",
        attachments: [
          {
            id: "att_1",
            fileName: "Векторы на плоскости. Примеры с решениями.pdf",
            fileUrl: "#",
            fileType: "application/pdf",
            expiresAt: "",
          },
          {
            id: "att_2",
            fileName: "ДЗ Векторы на плоскости — 14 прототипов.pdf",
            fileUrl: "#",
            fileType: "application/pdf",
            expiresAt: "",
          },
        ],
        submission: {
          id: "sub_shelepova_sample",
          content: "Решила все 14 номеров в рабочей тетради.",
          submittedAt: "2026-09-16T17:45:00.000Z",
          status: "PENDING",
          grade: null,
          teacherComment: "",
          attachments: [],
        },
      },
      {
        id: "hw_sample_geom",
        subjectName: "Геометрия",
        targetDate: "2026-09-17",
        title: "Теорема синусов и косинусов",
        description: "Нахождение сторон и углов произвольного треугольника. Задачи 1-8.",
        attachments: [
          {
            id: "att_3",
            fileName: "Теорема синусов и косинусов. Памятка.pdf",
            fileUrl: "#",
            fileType: "application/pdf",
            expiresAt: "",
          },
        ],
        submission: null,
      },
      {
        id: "hw_sample_scalar",
        subjectName: "Алгебра",
        targetDate: "2026-09-18",
        title: "Скалярное произведение векторов",
        description: "Угол между векторами. Условие ортогональности и коллинеарности.",
        attachments: [
          {
            id: "att_4",
            fileName: "Скалярное произведение векторов.pdf",
            fileUrl: "#",
            fileType: "application/pdf",
            expiresAt: "",
          },
        ],
        submission: null,
      },
    ];
  }

  return (
    <StudentDashboard
      serverDate={new Date().toISOString()}
      user={{
        id: studentUser.id,
        fullName: studentUser.fullName,
        login: studentUser.login,
        className: currentClassGroup?.name || "6А",
      }}
      scheduleItems={scheduleItems}
      homeworks={formattedHomeworks}
    />
  );
}