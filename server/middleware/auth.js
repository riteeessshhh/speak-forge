/**
 * auth.js — Authentication Middleware
 * 
 * Exports: verifyToken middleware, COOKIE_OPTIONS config
 */

import jwt from 'jsonwebtoken';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
};

/**
 * Express middleware — reads JWT from HttpOnly cookie, attaches user to req.
 */
export const verifyToken = (req, res, next) => {
  const token = req.cookies.sf_token;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
