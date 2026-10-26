import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  try {
    return (
      globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      })
    );
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      // В продакшене «тихий» пустой клиент означает пустые страницы и
      // невнятные ошибки входа — лучше упасть сразу и явно.
      throw new Error(
        `Не удалось инициализировать Prisma Client: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    console.warn("[db] Prisma Client не инициализирован, включён демо-режим без БД", err);
    const noOp = {
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null,
      create: async (d: any) => d?.data ?? {},
      update: async (d: any) => d?.data ?? {},
      delete: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 0 }),
      count: async () => 0,
    };
    return new Proxy({}, {
      get: () =>
        new Proxy(noOp, {
          get: (target, prop) => (target as any)[prop] ?? (async () => null),
        }),
    }) as unknown as PrismaClient;
  }
}

export const db = createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
