import { cookies } from "next/headers";
import { verifySessionToken } from "./auth-utils";
import { db } from "./db";

export type UserRole = "ADMIN" | "STUDENT";

export class AuthError extends Error {
  readonly code: "UNAUTHORIZED" | "FORBIDDEN";
  readonly status: number;

  constructor(code: "UNAUTHORIZED" | "FORBIDDEN", message?: string) {
    super(message || (code === "UNAUTHORIZED" ? "Требуется авторизация" : "Недостаточно прав"));
    this.name = "AuthError";
    this.code = code;
    this.status = code === "UNAUTHORIZED" ? 401 : 403;
  }
}

/**
 * Возвращает пользователя из БД по сессионной cookie.
 * Роль берётся из БД, а не из тела токена: разжалованный учитель теряет доступ
 * сразу, а не через 7 дней.
 */
export async function getSessionUser() {
  const token = cookies().get("session_token")?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: { classGroup: true },
  });

  return user ?? null;
}

export async function requireUser(roles?: UserRole[]) {
  const user = await getSessionUser();
  if (!user) throw new AuthError("UNAUTHORIZED");
  if (roles && !roles.includes(user.role as UserRole)) throw new AuthError("FORBIDDEN");
  return user;
}

export function requireAdmin() {
  return requireUser(["ADMIN"]);
}

export function requireStudent() {
  return requireUser(["STUDENT"]);
}

/** Для route handlers: превращает AuthError в корректный HTTP-ответ. */
export function authErrorResponse(error: unknown): { status: number; message: string } | null {
  if (error instanceof AuthError) return { status: error.status, message: error.message };
  return null;
}
