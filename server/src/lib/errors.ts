import type { ZodError, ZodTypeAny, z } from 'zod';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'error',
    public details?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: Record<string, string[]>) =>
  new AppError(400, msg, 'bad_request', details);
export const unauthorized = (msg = 'Not authenticated') => new AppError(401, msg, 'unauthorized');
export const forbidden = (msg = 'You do not have permission to do that') =>
  new AppError(403, msg, 'forbidden');
export const notFound = (what = 'Resource') => new AppError(404, `${what} not found`, 'not_found');
export const conflict = (msg: string) => new AppError(409, msg, 'conflict');

export function zodDetails(err: ZodError) {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Parse untrusted input with a Zod schema, throwing a 400 with field errors on failure. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw badRequest('Validation failed', zodDetails(result.error));
  return result.data;
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
