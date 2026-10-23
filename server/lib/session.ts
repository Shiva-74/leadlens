import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { pool } from '../db/index.js';

// Extend Express Request type so req.sessionId is available everywhere
declare global {
  namespace Express {
    interface Request {
      sessionId: string;
    }
  }
}

const COOKIE_NAME = 'leadlens_sid';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only run session check on /api routes (skip static assets)
  if (!req.path.startsWith('/api')) {
    return next();
  }

  try {
    let sid = req.cookies?.[COOKIE_NAME];
    let validSession = false;

    if (sid && UUID_REGEX.test(sid)) {
      const result = await pool.query('SELECT id FROM sessions WHERE id = $1', [sid]);
      if (result.rowCount && result.rowCount > 0) {
        validSession = true;
      }
    }

    if (!validSession) {
      sid = crypto.randomUUID();
      await pool.query('INSERT INTO sessions (id) VALUES ($1)', [sid]);
      res.cookie(COOKIE_NAME, sid, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: THIRTY_DAYS_MS,
        path: '/',
      });
    }

    req.sessionId = sid;
    next();
  } catch (err) {
    console.error('Session middleware error:', err);
    res.status(500).json({ error: 'Failed to initialize anonymous session. Check database connection.' });
  }
}