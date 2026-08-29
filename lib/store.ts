import { createHash } from "node:crypto";
import { BlobNotFoundError, head, list, put } from "@vercel/blob";
import { parsePoint, type RunPoint } from "@/lib/run";
import { normalizeEmail, type Signup } from "@/lib/signups";

const fallbackPoints: RunPoint[] = [];
const fallbackSignups: Signup[] = [];

function hasBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function isSignup(value: unknown): value is Signup {
  if (typeof value !== "object" || value === null) return false;
  const raw = value as Record<string, unknown>;
  return (
    normalizeEmail(raw.email) === raw.email &&
    typeof raw.createdAt === "string" &&
    !Number.isNaN(Date.parse(raw.createdAt))
  );
}

export async function savePoint(point: RunPoint): Promise<void> {
  if (!hasBlobStorage()) {
    fallbackPoints.push(point);
    return;
  }

  await put(
    `points/${new Date().toISOString()}-${crypto.randomUUID()}.json`,
    JSON.stringify(point),
    {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    },
  );
}

export async function listPoints(): Promise<RunPoint[]> {
  if (!hasBlobStorage()) return [...fallbackPoints];

  try {
    const blobs: Array<{ pathname: string; url: string }> = [];
    let cursor: string | undefined;

    do {
      const page = await list({ prefix: "points/", cursor });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    const points = await Promise.all(
      blobs.map(async (blob) => {
        try {
          const response = await fetch(blob.url, { cache: "no-store" });
          if (!response.ok) return null;
          const parsed = parsePoint(await response.json());
          return typeof parsed === "string"
            ? null
            : { pathname: blob.pathname, point: parsed };
        } catch {
          return null;
        }
      }),
    );

    return points
      .filter(
        (entry): entry is { pathname: string; point: RunPoint } =>
          entry !== null,
      )
      .sort((a, b) => a.pathname.localeCompare(b.pathname))
      .map(({ point }) => point);
  } catch {
    return [];
  }
}

export async function saveSignup(email: string): Promise<boolean> {
  if (!hasBlobStorage()) {
    if (fallbackSignups.some((signup) => signup.email === email)) return false;
    fallbackSignups.push({ email, createdAt: new Date().toISOString() });
    return true;
  }

  // Blob URLs are public, so the address is a digest rather than the email itself.
  const digest = createHash("sha256").update(email).digest("hex");
  const pathname = `signups/${digest}.json`;
  try {
    await head(pathname);
    return false;
  } catch (error) {
    if (!(error instanceof BlobNotFoundError)) throw error;
  }

  await put(
    pathname,
    JSON.stringify({ email, createdAt: new Date().toISOString() }),
    {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    },
  );
  return true;
}

export async function listSignups(): Promise<Signup[]> {
  if (!hasBlobStorage()) return [...fallbackSignups];

  try {
    const blobs: Array<{ pathname: string; url: string }> = [];
    let cursor: string | undefined;

    do {
      const page = await list({ prefix: "signups/", cursor });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    const signups = await Promise.all(
      blobs.map(async (blob) => {
        try {
          const response = await fetch(blob.url, { cache: "no-store" });
          if (!response.ok) return null;
          const value: unknown = await response.json();
          return isSignup(value)
            ? { pathname: blob.pathname, signup: value }
            : null;
        } catch {
          return null;
        }
      }),
    );

    return signups
      .filter(
        (entry): entry is { pathname: string; signup: Signup } =>
          entry !== null,
      )
      .sort((a, b) => a.pathname.localeCompare(b.pathname))
      .map(({ signup }) => signup);
  } catch {
    return [];
  }
}
