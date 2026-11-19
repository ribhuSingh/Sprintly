import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';
import { env, isProd } from '../config/env';

export const AUTH_COOKIE = 'sprintly_token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const signToken = (userId: string) =>
  jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: Math.floor(MAX_AGE_MS / 1000) });

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** httpOnly so the token is not readable from JS (mitigates XSS token theft). */
export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: MAX_AGE_MS,
  path: '/',
};
