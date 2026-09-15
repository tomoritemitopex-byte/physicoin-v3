import { NextResponse } from "next/server";
import { createUser, getUser, getUserByNickname } from "@/lib/domains/users";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const id = u.searchParams.get("id");
    const nickname = u.searchParams.get("nickname");
    const user = id ? await getUser(id) : nickname ? await getUserByNickname(nickname) : null;
    if (!user) return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Profile not found." }, { status: 404 });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = await createUser(body);
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
