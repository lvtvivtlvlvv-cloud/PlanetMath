import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const prisma = new PrismaClient();

async function main() {
  console.log("Очистка базы данных...");

  // 1. Удаление всех файлов из таблицы Attachment
  const deletedAttachments = await prisma.attachment.deleteMany();
  console.log(`Удалено файлов из БД: ${deletedAttachments.count}`);

  // 2. Удаление файлов с диска (public/uploads)
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  try {
    const files = await fs.readdir(uploadsDir);
    for (const file of files) {
      await fs.unlink(path.join(uploadsDir, file)).catch(() => {});
    }
    console.log(`Очищена директория загрузок: ${uploadsDir}`);
  } catch {
    console.log("Директория public/uploads пуста или отсутствует");
  }

  // 3. Удаление всех сданных работ
  await prisma.homeworkSubmission.deleteMany();

  // 4. Удаление всех пользователей кроме admin и admin123
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      login: {
        notIn: ["admin", "admin123"],
      },
    },
  });
  console.log(`Удалено пользователей: ${deletedUsers.count}`);

  // 5. Гарантируем наличие пользователя admin с паролем admin123
  const adminPasswordHash = await bcrypt.hash("admin123", 10);

  const existingAdmin = await prisma.user.findUnique({
    where: { login: "admin" },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        login: "admin",
        passwordHash: adminPasswordHash,
        role: "ADMIN",
        fullName: "Администратор",
        plainPasswordForAdmin: "admin123",
      },
    });
    console.log("Создан пользователь: admin (пароль: admin123)");
  } else {
    await prisma.user.update({
      where: { login: "admin" },
      data: {
        passwordHash: adminPasswordHash,
        role: "ADMIN",
        fullName: "Администратор",
        plainPasswordForAdmin: "admin123",
      },
    });
    console.log("Обновлен пользователь: admin (пароль: admin123)");
  }

  // 6. Также гарантируем наличие пользователя admin123 с паролем admin123 (на случай если вход по admin123)
  const existingAdmin123 = await prisma.user.findUnique({
    where: { login: "admin123" },
  });

  if (!existingAdmin123) {
    await prisma.user.create({
      data: {
        login: "admin123",
        passwordHash: adminPasswordHash,
        role: "ADMIN",
        fullName: "Администратор",
        plainPasswordForAdmin: "admin123",
      },
    });
    console.log("Создан пользователь: admin123 (пароль: admin123)");
  } else {
    await prisma.user.update({
      where: { login: "admin123" },
      data: {
        passwordHash: adminPasswordHash,
        role: "ADMIN",
        fullName: "Администратор",
        plainPasswordForAdmin: "admin123",
      },
    });
    console.log("Обновлен пользователь: admin123 (пароль: admin123)");
  }

  // Проверка оставшихся пользователей
  const remainingUsers = await prisma.user.findMany({
    select: { id: true, login: true, role: true, fullName: true },
  });
  console.log("Текущие пользователи в БД:", remainingUsers);

  const remainingAttachments = await prisma.attachment.count();
  console.log("Текущее количество файлов в БД:", remainingAttachments);
}

main()
  .catch((e) => {
    console.error("Ошибка при очистке БД:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
