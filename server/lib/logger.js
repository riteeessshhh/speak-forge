/**
 * logger.js — Structured Logger
 * 
 * Replaces console.log/warn/error with timestamped, leveled output.
 * Format: [ISO_TIMESTAMP] [LEVEL] message
 */

const LEVELS = {
  INFO:  '\x1b[36m',  // cyan
  WARN:  '\x1b[33m',  // yellow
  ERROR: '\x1b[31m',  // red
};
const RESET = '\x1b[0m';

function format(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const color = LEVELS[level] || '';
  const prefix = `${color}[${timestamp}] [${level}]${RESET}`;
  
  if (args.length > 0) {
    console.log(prefix, message, ...args);
  } else {
    console.log(prefix, message);
  }
}

export const log = {
  info:  (msg, ...args) => format('INFO',  msg, ...args),
  warn:  (msg, ...args) => format('WARN',  msg, ...args),
  error: (msg, ...args) => format('ERROR', msg, ...args),
};
