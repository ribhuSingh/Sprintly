import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../lib/errors';
import { isProd } from '../config/env';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: `Route ${req.method} ${req.path} not found`, code: 'not_found' } });
}

// Express recognises error handlers by arity, so all four params must stay.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: { message: `Invalid ${err.path}`, code: 'bad_request' } });
  }
  if (typeof err === 'object' && err && 'code' in err && (err as { code: unknown }).code === 11000) {
    return res.status(409).json({ error: { message: 'That value is already taken', code: 'conflict' } });
  }
  if (typeof err === 'object' && err && 'type' in err && (err as { type: unknown }).type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Malformed JSON body', code: 'bad_request' } });
  }
  console.error(err);
  res.status(500).json({
    error: { message: isProd ? 'Something went wrong' : String((err as Error)?.message ?? err), code: 'internal' },
  });
}
