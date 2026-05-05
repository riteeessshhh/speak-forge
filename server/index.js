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
const allowedOrigin = (process.env.CLIENT_URL || 'http://localhost:5173').trim().replace(/\/$/, '');

app.use(cors({
  origin: allowedOrigin,
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

// Start Server
app.listen(PORT, () => {
  log.info(`SpeakForge Server running on port ${PORT}`);
  log.info(`CORS allowed from: ${allowedOrigin}`);
});
