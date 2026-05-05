/**
 * index.js — Thin Orchestrator (Production Refactored)
 * 
 * DESIGN: Modular, scalable, and optimized for SRE best practices.
 */

import './lib/env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { log } from './lib/logger.js';

// Route Imports
import authRoutes from './routes/auth.js';
import topicRoutes from './routes/topics.js';
import uploadRoutes from './routes/upload.js';
import analyticsRoutes from './routes/analytics.js';

// Initialize environment
// (Moved to top)

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const baseOrigin = (process.env.CLIENT_URL || 'http://localhost:5173').trim().replace(/\/$/, '');
const allowedOrigins = [baseOrigin, `${baseOrigin}/`];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    // Normalize origins
    const normalizedOrigin = origin.trim().replace(/\/$/, '');
    
    // Check if it's in our list OR if it's a Vercel deployment URL
    const isVercel = normalizedOrigin.endsWith('.vercel.app');
    const isAllowed = allowedOrigins.some(ao => ao.trim().replace(/\/$/, '') === normalizedOrigin);
    
    if (isAllowed || isVercel || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      log.error(`CORS BLOCKED: Incoming origin "${origin}" did not match allowed origins: ${JSON.stringify(allowedOrigins)}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Request logging (Production style)
app.use((req, res, next) => {
  log.info(`${req.method} ${req.url}`);
  next();
});

// Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/generate-topic', topicRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  log.error(`Unhandled Error: ${err.message}`);
  log.error(err.stack);
  res.status(500).json({ error: 'Internal server error.' });
});

// Start Server
app.listen(PORT, () => {
  log.info(`SpeakForge Server running on port ${PORT}`);
  log.info(`CORS allowed from: ${baseOrigin} (and / version)`);
});
