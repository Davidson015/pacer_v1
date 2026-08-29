import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/signups";
import { listSignups, saveSignup } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const email = normalizeEmail(
    typeof body === "object" && body !== null && "email" in body
      ? (body as { email: unknown }).email
      : undefined,
  );
  if (!email) {
    return NextResponse.json(
      { error: "a valid email is required" },
      { status: 400 },
    );
  }

  try {
    const added = await saveSignup(email);
    const signups = await listSignups();
    return NextResponse.json(
      { email, alreadySignedUp: !added, signupCount: signups.length },
      { status: added ? 201 : 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "could not save signup" },
      { status: 502 },
    );
  }
}

export async function GET() {
  const signups = await listSignups();
  return NextResponse.json(
    { signupCount: signups.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
