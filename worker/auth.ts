// Self-hosted auth for Cloudflare Workers + D1.
// Email/password accounts, PBKDF2-SHA256 password hashing via WebCrypto and
// opaque server-side sessions in D1 (HttpOnly cookie). No third-party service.

export interface D1DatabaseLike {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
      first: <T = Record<string, unknown>>() => Promise<T | null>;
      run: () => Promise<unknown>;
    };
    all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
    first: <T = Record<string, unknown>>() => Promise<T | null>;
    run: () => Promise<unknown>;
  };
}

export const SESSION_COOKIE = 'cf_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// PBKDF2-SHA256 costs roughly 0.17 us per iteration, and the Workers Free plan
// allows only 10 ms of CPU per request (the paid plan allows 30 s, set by
// `limits.cpu_ms` in wrangler.jsonc). 20 000 iterations keeps a sign-up or
// sign-in around 4-6 ms, so auth works on both plans. The iteration count is
// stored inside every hash (`pbkdf2$<iterations>$<salt>$<hash>`), so existing
// passwords keep verifying if the value changes later - on a paid plan raise
// this back to 100_000 and add `"limits": { "cpu_ms": 50 }` to wrangler.jsonc.
const PBKDF2_ITERATIONS = 20_000;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: number | null;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return new Uint8Array(bits);
}

/** Returns `pbkdf2$<iterations>$<salt>$<hash>` for storage in D1. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 10_000) return false;
  try {
    const salt = fromBase64Url(parts[2]);
    const expected = fromBase64Url(parts[3]);
    const actual = await pbkdf2(password, salt, iterations);
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

export function normalizeName(raw: unknown): string | null {
  const name = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!name) return null;
  return name.slice(0, 80);
}

export async function ensureAuthSchema(db: D1DatabaseLike): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
         id TEXT PRIMARY KEY,
         email TEXT NOT NULL UNIQUE,
         name TEXT,
         password_hash TEXT NOT NULL,
         created_at INTEGER NOT NULL
       )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS sessions (
         token_hash TEXT PRIMARY KEY,
         user_id TEXT NOT NULL,
         created_at INTEGER NOT NULL,
         expires_at INTEGER NOT NULL
       )`
    )
    .run();
  await db
    .prepare('CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)')
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS workspaces (
         client_id TEXT PRIMARY KEY,
         snapshot_json TEXT NOT NULL,
         updated_at INTEGER NOT NULL
       )`
    )
    .run();
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}

export function sessionCookie(token: string, requestUrl: URL): string {
  const secure = requestUrl.protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
    SESSION_TTL_MS / 1000
  }${secure}`;
}

export function clearedSessionCookie(requestUrl: URL): string {
  const secure = requestUrl.protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function createSession(db: D1DatabaseLike, userId: string): Promise<string> {
  const token = toBase64Url(randomBytes(32));
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(tokenHash, userId, now, now + SESSION_TTL_MS)
    .run();
  return token;
}

export async function getSessionUser(
  db: D1DatabaseLike,
  request: Request
): Promise<SessionUser | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT u.id AS id, u.email AS email, u.name AS name, u.created_at AS created_at, s.expires_at AS expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .bind(tokenHash)
    .first<{ id: string; email: string; name: string | null; created_at: number; expires_at: number }>();
  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  return { id: row.id, email: row.email, name: row.name ?? null, createdAt: row.created_at ?? null };
}

export async function destroySession(db: D1DatabaseLike, request: Request): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
}

export async function findUserByEmail(
  db: D1DatabaseLike,
  email: string
): Promise<{ id: string; email: string; name: string | null; password_hash: string; created_at: number } | null> {
  return db
    .prepare('SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string; email: string; name: string | null; password_hash: string; created_at: number }>();
}

export async function createUser(
  db: D1DatabaseLike,
  email: string,
  name: string | null,
  passwordHash: string
): Promise<SessionUser> {
  const id = `usr_${toBase64Url(randomBytes(12))}`;
  const createdAt = Date.now();
  await db
    .prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, email, name, passwordHash, createdAt)
    .run();
  return { id, email, name, createdAt };
}

/**
 * CSRF guard for state-changing requests: the browser must be on this origin.
 * Falls back to Sec-Fetch-Site / Referer when the Origin header is absent.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = new URL(request.url).origin;
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin && requestOrigin !== 'null') {
    return requestOrigin === origin;
  }
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin === origin;
    } catch {
      return false;
    }
  }
  return false;
}
