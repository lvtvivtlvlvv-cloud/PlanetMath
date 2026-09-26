import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Очистка существующих записей в БД...");
  await prisma.attachment.deleteMany();
  await prisma.homeworkSubmission.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.scheduleItem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.classGroup.deleteMany();

  console.log("Создание классов...");
  const class6A = await prisma.classGroup.create({
    data: { grade: 6, letter: "А", name: "6А" },
  });

  const class9B = await prisma.classGroup.create({
    data: { grade: 9, letter: "Б", name: "9Б" },
  });

  console.log("Создание учителей и администраторов...");
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      login: "admin",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      fullName: "Иванова Елена Васильевна",
      plainPasswordForAdmin: "admin123",
    },
  });

  const teacherPasswordHash = await bcrypt.hash("teacher123", 10);
  await prisma.user.create({
    data: {
      login: "teacher",
      passwordHash: teacherPasswordHash,
      role: "ADMIN",
      fullName: "Смирнов Алексей Петрович",
      plainPasswordForAdmin: "teacher123",
    },
  });

  console.log("Создание учетных записей учеников...");
  // Быстрый тестовый вход
  const userPasswordHash = await bcrypt.hash("user123", 10);
  const testUser = await prisma.user.create({
    data: {
      login: "user",
      passwordHash: userPasswordHash,
      role: "STUDENT",
      fullName: "Артищев Иван Сергеевич",
      classId: class6A.id,
      plainPasswordForAdmin: "user123",
    },
  });

  // Основной ученик
  const studentPasswordHash = await bcrypt.hash("student123", 10);
  await prisma.user.create({
    data: {
      login: "saa06a123",
      passwordHash: studentPasswordHash,
      role: "STUDENT",
      fullName: "Савченко Андрей Алексеевич",
      classId: class6A.id,
      plainPasswordForAdmin: "student123",
    },
  });

  // Дополнительный ученик для проверки алфавитной нумерации
  await prisma.user.create({
    data: {
      login: "bda06a451",
      passwordHash: studentPasswordHash,
      role: "STUDENT",
      fullName: "Борисов Дмитрий Андреевич",
      classId: class6A.id,
      plainPasswordForAdmin: "student123",
    },
  });

  console.log("Генерация сетки расписания 2026-2027 для 6А...");
  const scheduleData = [
    // Понедельник (1)
    { day: 1, lesson: 1, start: "08:30", end: "09:15", subject: "Математика", room: "204", teacher: "Иванова Е. В." },
    { day: 1, lesson: 2, start: "09:25", end: "10:10", subject: "Русский язык", room: "102", teacher: "Смирнов А. П." },
    { day: 1, lesson: 3, start: "10:25", end: "11:10", subject: "История", room: "305", teacher: "Иванова Е. В." },
    { day: 1, lesson: 4, start: "11:30", end: "12:15", subject: "Литература", room: "102", teacher: "Смирнов А. П." },

    // Вторник (2)
    { day: 2, lesson: 1, start: "08:30", end: "09:15", subject: "Физика", room: "401", teacher: "Иванова Е. В." },
    { day: 2, lesson: 2, start: "09:25", end: "10:10", subject: "Математика", room: "204", teacher: "Иванова Е. В." },
    { day: 2, lesson: 3, start: "10:25", end: "11:10", subject: "Английский язык", room: "208", teacher: "Смирнов А. П." },
    { day: 2, lesson: 4, start: "11:30", end: "12:15", subject: "Биология", room: "312", teacher: "Смирнов А. П." },

    // Среда (3)
    { day: 3, lesson: 1, start: "08:30", end: "09:15", subject: "Геометрия", room: "204", teacher: "Иванова Е. В." },
    { day: 3, lesson: 2, start: "09:25", end: "10:10", subject: "Русский язык", room: "102", teacher: "Смирнов А. П." },
    { day: 3, lesson: 3, start: "10:25", end: "11:10", subject: "География", room: "215", teacher: "Иванова Е. В." },
    { day: 3, lesson: 4, start: "11:30", end: "12:15", subject: "Физкультура", room: "С/З", teacher: "Смирнов А. П." },

    // Четверг (4)
    { day: 4, lesson: 1, start: "08:30", end: "09:15", subject: "Информатика", room: "301", teacher: "Иванова Е. В." },
    { day: 4, lesson: 2, start: "09:25", end: "10:10", subject: "Математика", room: "204", teacher: "Иванова Е. В." },
    { day: 4, lesson: 3, start: "10:25", end: "11:10", subject: "Литература", room: "102", teacher: "Смирнов А. П." },
    { day: 4, lesson: 4, start: "11:30", end: "12:15", subject: "История", room: "305", teacher: "Смирнов А. П." },

    // Пятница (5)
    { day: 5, lesson: 1, start: "08:30", end: "09:15", subject: "Русский язык", room: "102", teacher: "Смирнов А. П." },
    { day: 5, lesson: 2, start: "09:25", end: "10:10", subject: "Английский язык", room: "208", teacher: "Смирнов А. П." },
    { day: 5, lesson: 3, start: "10:25", end: "11:10", subject: "Математика", room: "204", teacher: "Иванова Е. В." },
    { day: 5, lesson: 4, start: "11:30", end: "12:15", subject: "Музыка", room: "110", teacher: "Иванова Е. В." },

    // Суббота (6)
    { day: 6, lesson: 1, start: "08:30", end: "09:15", subject: "Обществознание", room: "305", teacher: "Иванова Е. В." },
    { day: 6, lesson: 2, start: "09:25", end: "10:10", subject: "Технология", room: "Маст.", teacher: "Смирнов А. П." },
    { day: 6, lesson: 3, start: "10:25", end: "11:10", subject: "Классный час", room: "204", teacher: "Иванова Е. В." },
  ];

  for (const item of scheduleData) {
    await prisma.scheduleItem.create({
      data: {
        classId: class6A.id,
        dayOfWeek: item.day,
        lessonNumber: item.lesson,
        startTime: item.start,
        endTime: item.end,
        subjectName: item.subject,
        room: item.room,
        teacherName: item.teacher,
      },
    });
  }

  console.log("Создание активных и архивных ДЗ...");
  // 1. Активное ДЗ
  const activeHw = await prisma.homework.create({
    data: {
      classId: class6A.id,
      subjectName: "Математика",
      targetDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      title: "Параграф 4, № 112-118",
      description: "Решить уравнения в тетради, выполнить чертеж графика к номеру 115.",
    },
  });

  // 2. ДЗ со сдачей от пользователя user
  const submittedHw = await prisma.homework.create({
    data: {
      classId: class6A.id,
      subjectName: "Русский язык",
      targetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      title: "Упражнение 72",
      description: "Списать текст, вставить пропущенные буквы и выделить суффиксы.",
    },
  });

  await prisma.homeworkSubmission.create({
    data: {
      homeworkId: submittedHw.id,
      studentId: testUser.id,
      content: "Упражнение выполнено в тетради, правила повторил.",
      status: "PENDING",
    },
  });

  // 3. Просроченное ДЗ (для блока «Срок сдачи окончен»)
  await prisma.homework.create({
    data: {
      classId: class6A.id,
      subjectName: "История",
      targetDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      title: "Параграф 1, вопросы 1-5",
      description: "Письменно ответить на вопросы в конце параграфа.",
    },
  });

  console.log("✓ Наполнение базы завершено.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });