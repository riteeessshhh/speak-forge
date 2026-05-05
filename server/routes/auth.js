/**
 * routes/auth.js — Authentication Routes
 * 
 * POST /signup, POST /login, POST /logout, GET /me
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { log } from '../lib/logger.js';
import pool from '../db/pool.js';
import { findUserByEmail, createUser, findUserById } from '../db/queries.js';
import { COOKIE_OPTIONS } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { signupSchema, loginSchema } from '../schemas/index.js';

const router = Router();

/**
 * POST /signup
 */
router.post('/signup', validate(signupSchema), async (req, res) => {
  const { email, password } = req.validated;
  const client = await pool.connect();
  try {
    const existing = await findUserByEmail(client, email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(client, email, passwordHash);

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('sf_token', token, COOKIE_OPTIONS);

    log.info(`New user registered: ${user.email}`);
    res.status(201).json({ user: { id: user.id, email: user.email, createdAt: user.created_at } });
  } catch (err) {
    log.error('Signup error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

/**
 * POST /login
 */
router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.validated;
  const client = await pool.connect();
  try {
    const user = await findUserByEmail(client, email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('sf_token', token, COOKIE_OPTIONS);

    log.info(`User logged in: ${user.email}`);
    res.json({ user: { id: user.id, email: user.email, createdAt: user.created_at } });
  } catch (err) {
    log.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

/**
 * POST /logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('sf_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    path: '/',
  });
  log.info('User logged out.');
  res.json({ message: 'Logged out successfully.' });
});

/**
 * GET /me
 */
router.get('/me', async (req, res) => {
  const token = req.cookies.sf_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const client = await pool.connect();
    try {
      const user = await findUserById(client, decoded.id);
      if (!user) return res.status(401).json({ error: 'User not found.' });
      res.json({ user: { id: user.id, email: user.email, createdAt: user.created_at } });
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

export default router;
