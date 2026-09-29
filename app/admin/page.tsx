import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { AdminDashboard, StudentItem, TeacherItem } from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const token = cookies().get("session_token")?.value;
  if (!token) redirect("/login");

  const payload = await verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    redirect("/login");
  }

  const adminUser = await db.user.findUnique({
    where: { id: payload.userId },
  });

  if (!adminUser) {
    redirect("/login");
  }

  let classes = await db.classGroup.findMany({ orderBy: [{ grade: "asc" }, { letter: "asc" }] });
  if (classes.length === 0) {
    await db.classGroup.createMany({
      data: [
        { grade: 11, letter: "А", name: "11А" },
        { grade: 10, letter: "А", name: "10А" },
      ],
    });
    classes = await db.classGroup.findMany({ orderBy: [{ grade: "asc" }, { letter: "asc" }] });
  }

  const [scheduleItems, homeworks, submissions, users] = await Promise.all([
    db.scheduleItem.findMany({ orderBy: [{ dayOfWeek: "asc" }, { lessonNumber: "asc" }] }),
    db.homework.findMany({
      include: {
        classGroup: true,
        attachments: true,
        _count: { select: { submissions: true } },
      },
      orderBy: { targetDate: "desc" },
    }),
    db.homeworkSubmission.findMany({
      include: {
        student: true,
        homework: true,
        attachments: true,
      },
      orderBy: { submittedAt: "desc" },
    }),
    db.user.findMany({
      include: { classGroup: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const students: StudentItem[] = users
    .filter((u) => u.role === "STUDENT" && u.classGroup)
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      login: u.login,
      plainPassword: u.plainPasswordForAdmin || "—",
      classId: u.classId || "",
      className: u.classGroup?.name || "",
      grade: u.classGroup?.grade || 0,
      letter: u.classGroup?.letter || "",
      examTrack: u.examTrack || (u.classGroup?.grade === 11 ? "База" : null),
    }));

  const teachers: TeacherItem[] = users
    .filter((u) => u.role === "ADMIN")
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      login: u.login,
      plainPassword: u.plainPasswordForAdmin || "—",
    }));

  const formattedHomeworks = homeworks.map((h) => ({
    id: h.id,
    classId: h.classId,
    className: h.classGroup.name,
    subjectName: h.subjectName,
    title: h.title,
    description: h.description,
    targetTrack: h.targetTrack || null,
    targetDate: h.targetDate.toISOString().split("T")[0],
    submissionsCount: h._count.submissions,
    attachments: (h.attachments || []).map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      fileType: a.fileType,
      fileSize: a.fileSize,
      expiresAt: a.expiresAt.toISOString(),
    })),
  }));

  const formattedSubmissions = submissions.map((s) => ({
    id: s.id,
    homeworkId: s.homeworkId,
    studentId: s.studentId,
    studentName: s.student.fullName,
    subjectName: s.homework.subjectName,
    homeworkTitle: s.homework.title,
    targetDate: s.homework.targetDate.toISOString().split("T")[0],
    content: s.content,
    submittedAt: s.submittedAt.toISOString(),
    status: s.status,
    grade: s.grade,
    teacherComment: s.teacherComment,
    attachments: s.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      fileType: a.fileType,
      expiresAt: a.expiresAt.toISOString(),
    })),
  }));

  const formattedSchedule = scheduleItems.map((s) => ({
    id: s.id,
    classId: s.classId,
    dayOfWeek: s.dayOfWeek,
    lessonNumber: s.lessonNumber,
    startTime: s.startTime,
    endTime: s.endTime,
    subjectName: s.subjectName,
    room: s.room,
    teacherName: s.teacherName,
  }));

  return (
    <AdminDashboard
      serverDate={new Date().toISOString()}
      classes={classes}
      scheduleItems={formattedSchedule}
      homeworks={formattedHomeworks}
      submissions={formattedSubmissions}
      students={students}
      teachers={teachers}
    />
  );
}