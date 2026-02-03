import type { Env } from "./env";

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Very simple Basic Auth:
 * - Client sends: Authorization: Basic base64(username:password)
 * - We hash the password with SHA-256 and compare to D1 stored hash
 */
export async function requireBasicAuth(env: Env, authHeader: string | null): Promise<{ username: string }> {
  if (!authHeader || !authHeader.toLowerCase().startsWith("basic ")) {
    throw new AuthError("Missing Authorization header");
  }

  const b64 = authHeader.slice(6).trim();
  let decoded = "";
  try {
    decoded = atob(b64);
  } catch {
    throw new AuthError("Invalid basic auth encoding");
  }

  const idx = decoded.indexOf(":");
  if (idx === -1) throw new AuthError("Invalid basic auth format");

  const username = decoded.slice(0, idx);
  const password = decoded.slice(idx + 1);

  if (!username || !password) throw new AuthError("Invalid credentials");

  const row = await env.DB.prepare("SELECT username, password_hash FROM users WHERE username = ? LIMIT 1")
    .bind(username)
    .first<{ username: string; password_hash: string }>();

  if (!row) throw new AuthError("Invalid credentials");

  const passHash = await sha256Hex(password);
  if (passHash !== row.password_hash) throw new AuthError("Invalid credentials");

  return { username };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
