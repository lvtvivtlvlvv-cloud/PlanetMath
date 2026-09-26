import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("user123", 10);

  // Привязываем к первому попавшемуся классу (обязательно для роли STUDENT)
  let classGroup = await prisma.classGroup.findFirst();
  if (!classGroup) {
    classGroup = await prisma.classGroup.create({
      data: { grade: 6, letter: "А", name: "6А" },
    });
  }

  const user = await prisma.user.upsert({
    where: { login: "user" },
    update: {
      passwordHash,
      plainPasswordForAdmin: "user123",
    },
    create: {
      login: "user",
      passwordHash,
      role: "STUDENT", // Укажи "ADMIN", если нужен доступ в панель учителя
      fullName: "Тестовый Пользователь",
      classId: classGroup.id,
      plainPasswordForAdmin: "user123",
    },
  });

  console.log(`✓ Пользователь '${user.login}' готов к входу (Роль: ${user.role}, Класс: ${classGroup.name})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());