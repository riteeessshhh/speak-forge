/**
 * auth.js — Authentication Middleware
 * 
 * Supports both HttpOnly cookie (`sf_token`) and `Authorization: Bearer <token>`
 * so mobile browsers that restrict cross-site third-party cookies still authenticate seamlessly.
 */

import jwt from 'jsonwebtoken';

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'None' : 'Lax',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
};

export function extractTokenFromRequest(req) {
  if (req.cookies?.sf_token) {
    return req.cookies.sf_token;
  }
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer && bearer !== 'null' && bearer !== 'undefined') {
      return bearer;
    }
  }
  return null;
}

/**
 * Express middleware — reads JWT from HttpOnly cookie or Bearer header, attaches user to req.
 */
export const verifyToken = (req, res, next) => {
  const token = extractTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
