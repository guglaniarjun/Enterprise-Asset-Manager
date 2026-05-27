import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function requireSecret(...vars: Array<string | undefined>): string {
  for (const v of vars) if (v) return v;
  throw new Error(
    "JWT_SECRET (or SESSION_SECRET fallback) must be set in the environment",
  );
}
const ACCESS_SECRET: string = requireSecret(
  process.env.JWT_SECRET,
  process.env.SESSION_SECRET,
);
const REFRESH_SECRET: string = requireSecret(
  process.env.JWT_REFRESH_SECRET,
  process.env.SESSION_SECRET,
);
const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "7d";

export interface JwtPayload {
  userId: number;
  tenantId: number;
  email: string;
  roles: Array<{ roleId: number; roleName: string; branchId: number | null }>;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function signRefreshToken(
  payload: Pick<JwtPayload, "userId" | "tenantId">,
): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(
  token: string,
): Pick<JwtPayload, "userId" | "tenantId"> {
  return jwt.verify(token, REFRESH_SECRET) as Pick<
    JwtPayload,
    "userId" | "tenantId"
  >;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}
