import { NextResponse } from "next/server";
import { addSignup, normalizeEmail, signupCount } from "@/lib/signups";

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

  const added = addSignup(email);
  return NextResponse.json(
    { email, alreadySignedUp: !added, signupCount: signupCount() },
    { status: added ? 201 : 200 },
  );
}

export async function GET() {
  return NextResponse.json({ signupCount: signupCount() });
}
