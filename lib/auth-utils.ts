import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "school-portal-super-secret-key-prod-2026"
);

export interface TokenPayload {
  userId: string;
  login: string;
  role: "ADMIN" | "STUDENT";
  fullName: string;
  classId?: string | null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function transliterateChar(char: string): string {
  const lower = char.toLowerCase();
  return CYRILLIC_TO_LATIN[lower] ?? (/[a-z0-9]/.test(lower) ? lower : "x");
}

export function generateStudentCredentials(fullName: string, grade: number, letter: string) {
  const parts = fullName.trim().split(/\s+/);
  const surname = parts[0] || "User";
  const name = parts[1] || "";
  const patronymic = parts[2] || "";

  let initials = "";
  if (patronymic) {
    initials =
      transliterateChar(surname[0] || "u") +
      transliterateChar(name[0] || "x") +
      transliterateChar(patronymic[0] || "x");
  } else {
    initials =
      transliterateChar(surname[0] || "u") +
      transliterateChar(surname[1] || "x") +
      transliterateChar(name[0] || "x");
  }

  const paddedGrade = grade < 10 ? `0${grade}` : `${grade}`;
  const translitLetter = transliterateChar(letter[0] || "a");
  const randomSuffix = Math.floor(100 + Math.random() * 900).toString();
  const login = `${initials}${paddedGrade}${translitLetter}${randomSuffix}`.toLowerCase();

  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(8);
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += charset[bytes[i] % charset.length];
  }

  return { login, password };
}