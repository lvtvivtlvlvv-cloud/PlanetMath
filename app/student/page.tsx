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