export type Signup = {
  email: string;
  createdAt: string;
};

const signups: Signup[] = [];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL.test(email) ? email : null;
}

/** Stores an email once, in arrival order. Returns false if already signed up. */
export function addSignup(email: string): boolean {
  if (signups.some((signup) => signup.email === email)) return false;
  signups.push({ email, createdAt: new Date().toISOString() });
  return true;
}

export function signupCount(): number {
  return signups.length;
}

export function getSignups(): Signup[] {
  return [...signups];
}
