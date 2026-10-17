/** Shape returned by every admin server action (safe to import from client components). */
export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string };

export function ok<T = void>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, data: data as T, message };
}

export function fail<T = void>(error: string): ActionResult<T> {
  return { ok: false, error };
}
