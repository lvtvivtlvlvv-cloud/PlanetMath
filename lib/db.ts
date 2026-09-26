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
    console.warn("[AI Studio] Database client initialization fallback active", err);
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
