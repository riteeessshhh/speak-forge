/**
 * schemas/index.js — Zod Validation Schemas
 * 
 * Strict schemas for every incoming request body.
 */

import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email('A valid email is required.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

export const loginSchema = z.object({
  email: z.string().email('A valid email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export const topicSchema = z.object({
  track: z.string().min(1, 'Track is required.'),
  difficulty: z.enum(['easy', 'medium', 'hard'], {
    errorMap: () => ({ message: 'Difficulty must be easy, medium, or hard.' }),
  }),
});

export const uploadSchema = z.object({
  track: z.string().min(1, 'Track is required.'),
  difficulty: z.string().min(1, 'Difficulty is required.'),
  topic: z.string().min(1, 'Topic is required.'),
  isBehavioral: z.string().optional(),
});
