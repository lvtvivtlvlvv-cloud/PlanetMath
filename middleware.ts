import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "school-portal-super-secret-key-prod-2026"
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("session_token")?.value;

  const isRootPage = pathname === "/";
  const isAuthPage = pathname.startsWith("/login");
  const isAdminPage = pathname.startsWith("/admin");
  const isStudentPage = pathname.startsWith("/student");

  const createRedirect = (targetPath: string) => {
    const url = req.nextUrl.clone();
    url.pathname = targetPath;
    url.search = "";
    return NextResponse.redirect(url);
  };

  // 1. Корневой путь (/) — немедленный редирект на уровне middleware
  if (isRootPage) {
    if (!token) {
      return createRedirect("/login");
    }
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      const role = payload.role as string;
      if (role === "ADMIN") {
        return createRedirect("/admin");
      }
      return createRedirect("/student");
    } catch {
      const res = createRedirect("/login");
      res.cookies.delete("session_token");
      return res;
    }
  }

  // 2. Неавторизованный пользователь пытается зайти в кабинет
  if (!token) {
    if (isAdminPage || isStudentPage) {
      return createRedirect("/login");
    }
    return NextResponse.next();
  }

  // 3. Страница входа (/login):
  // ВАЖНО: НИКОГДА не перенаправляем автоматически с /login в кабинеты!
  // Это исключает бесконечный цикл 307, если в базе данных пользователя уже нет.
  if (isAuthPage) {
    return NextResponse.next();
  }

  // 4. Проверка прав для защищенных кабинетов
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const role = payload.role as string;

    if (isAdminPage && role !== "ADMIN") {
      return createRedirect("/student");
    }

    if (isStudentPage && role !== "STUDENT") {
      return createRedirect("/admin");
    }

    return NextResponse.next();
  } catch {
    // Токен поврежден или просрочен — сбрасываем и ведем на вход
    const res = createRedirect("/login");
    res.cookies.delete("session_token");
    return res;
  }
}

export const config = {
  matcher: ["/", "/admin/:path*", "/student/:path*", "/login"],
};