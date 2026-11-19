import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { loginSchema, registerSchema, updateProfileSchema } from '@sprintly/shared';
import { UserModel } from '../models';
import { AUTH_COOKIE, authCookieOptions, signToken } from '../lib/auth';
import { conflict, notFound, parse, unauthorized } from '../lib/errors';
import { toUser } from '../lib/serialize';
import { requireAuth, uid } from '../middleware/auth';
import { env } from '../config/env';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { message: 'Too many attempts, try again later', code: 'rate_limited' } },
});

authRouter.post('/register', authLimiter, async (req, res) => {
  const body = parse(registerSchema, req.body);
  if (await UserModel.exists({ email: body.email })) throw conflict('An account with that email already exists');
  const user = await UserModel.create({
    name: body.name,
    email: body.email,
    passwordHash: await bcrypt.hash(body.password, 10),
  });
  res.cookie(AUTH_COOKIE, signToken(user.id), authCookieOptions);
  res.status(201).json({ user: toUser(user) });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const body = parse(loginSchema, req.body);
  const user = await UserModel.findOne({ email: body.email }).select('+passwordHash');
  // Same error for unknown email and wrong password: don't reveal which accounts exist.
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw unauthorized('Invalid email or password');
  }
  res.cookie(AUTH_COOKIE, signToken(user.id), authCookieOptions);
  res.json({ user: toUser(user) });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...authCookieOptions, maxAge: undefined });
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await UserModel.findById(uid(req));
  if (!user) throw unauthorized();
  res.json({ user: toUser(user) });
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const body = parse(updateProfileSchema, req.body);
  const user = await UserModel.findByIdAndUpdate(uid(req), body, { new: true });
  if (!user) throw notFound('User');
  res.json({ user: toUser(user) });
});
