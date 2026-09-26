import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth-utils";

export default async function HomePage() {
  const token = cookies().get("session_token")?.value;

  if (!token) {
    redirect("/login");
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    redirect("/login");
  }

  if (payload.role === "ADMIN") {
    redirect("/admin");
  } else {
    redirect("/student");
  }
}