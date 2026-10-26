import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSessionToken } from "@/lib/auth-utils";
import { hitRateLimit, resetRateLimit } from "@/lib/rate-limit";

/**
 * Заглушка для выравнивания времени ответа: при несуществующем логине
 * всё равно выполняем bcrypt, чтобы нельзя было перебором узнать,
 * какие логины есть в системе.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZV8mQ0jq0m1S9x4c5y6d7e8f9g0h1i";

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "local";
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const { login: rawLogin, password: rawPassword } = (body ?? {}) as {
      login?: unknown;
      password?: unknown;
    };

    const login = typeof rawLogin === "string" ? rawLogin.trim() : "";
    const password = typeof rawPassword === "string" ? rawPassword : "";

    if (!login || !password) {
      return NextResponse.json({ error: "Введите логин и пароль" }, { status: 400 });
    }

    // Ограничиваем длину, чтобы не гонять bcrypt по мегабайтам.
    if (login.length > 64 || password.length > 200) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    const rateKey = `${clientIp(req)}:${login.toLowerCase()}`;
    const rate = hitRateLimit(rateKey);

    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Слишком много попыток входа. Повторите через ${rate.retryAfter} с.` },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
      );
    }

    const user = await db.user.findUnique({ where: { login } });

    if (!user) {
      await verifyPassword(password, DUMMY_HASH).catch(() => false);
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    resetRateLimit(rateKey);

    const token = await createSessionToken({
      userId: user.id,
      login: user.login,
      role: user.role as "ADMIN" | "STUDENT",
      fullName: user.fullName,
      classId: user.classId,
    });

    const res = NextResponse.json({ success: true, role: user.role });
    res.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (error: any) {
    console.error("Login error:", error);
    // Наружу — только общее сообщение, без деталей инфраструктуры.
    return NextResponse.json({ error: "Ошибка сервера. Попробуйте позднее." }, { status: 500 });
  }
}
