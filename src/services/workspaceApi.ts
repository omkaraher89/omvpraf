// Account + workspace persistence against the Cloudflare Worker (D1).
// Sessions are HttpOnly cookies set by the server; the browser never sees a token.

import type { GuestWorkspaceSnapshot } from './userCloudStore';
import { GUEST_WORKSPACE_STORAGE_KEY } from './userCloudStore';

const PUSH_DEBOUNCE_MS = 2000;

export interface AccountUser {
  id: string;
  email: string;
  name: string | null;
  createdAt?: number | null;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchSessionUser(): Promise<AccountUser | null> {
  try {
    const res = await fetch('/api/auth/session', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: AccountUser | null };
    return data?.user ?? null;
  } catch {
    return null;
  }
}

export async function signUpAccount(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<AccountUser> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new AuthError(await readError(res, 'Could not create the account.'), res.status);
  const data = (await res.json()) as { user: AccountUser };
  return data.user;
}

export async function logInAccount(input: {
  email: string;
  password: string;
}): Promise<AccountUser> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new AuthError(await readError(res, 'Could not sign in.'), res.status);
  const data = (await res.json()) as { user: AccountUser };
  return data.user;
}

export async function logOutAccount(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore: the local session is cleared on reload anyway
  }
}

export async function fetchRemoteWorkspace(
  timeoutMs = 4000
): Promise<GuestWorkspaceSnapshot | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('/api/workspace', { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { snapshot?: GuestWorkspaceSnapshot | null };
    return data?.snapshot ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSnapshot: GuestWorkspaceSnapshot | null = null;
let inFlight = false;

async function flushPush(): Promise<{ ok: boolean; error?: string }> {
  if (inFlight || !pendingSnapshot) return { ok: false, error: 'no snapshot queued' };
  const snapshot = pendingSnapshot;
  pendingSnapshot = null;
  inFlight = true;
  try {
    const res = await fetch('/api/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot }),
      keepalive: true,
    });
    if (!res.ok) {
      return { ok: false, error: await readError(res, 'server rejected the save') };
    }
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'the save request was cancelled'
        : 'the save request failed';
    return { ok: false, error: message };
  } finally {
    inFlight = false;
    if (pendingSnapshot) void flushPush();
  }
}

/** Queue a debounced write of the workspace snapshot to the account's D1 row. */
export function queueRemoteWorkspaceSave(snapshot: GuestWorkspaceSnapshot): void {
  pendingSnapshot = snapshot;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void flushPush();
  }, PUSH_DEBOUNCE_MS);
}

/**
 * Save the workspace to D1 right now, without waiting for the debounce.
 * This does not touch any local UI state (chart view, symbols, drawings cursor, etc.).
 */
export async function forceSaveWorkspaceToServer(
  snapshot: GuestWorkspaceSnapshot
): Promise<{ ok: boolean; error?: string }> {
  pendingSnapshot = snapshot;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  return flushPush();
}

/**
 * Before the app boots, restore the signed-in account's workspace from D1.
 * The account copy is authoritative, so it replaces any stale local cache.
 */
export async function hydrateWorkspaceFromServer(): Promise<boolean> {
  const snapshot = await fetchRemoteWorkspace();
  if (!snapshot) return false;
  try {
    localStorage.setItem(GUEST_WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}
