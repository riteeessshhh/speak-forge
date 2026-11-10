/**
 * lib/api.js — Dynamic API Base URL Resolution & Mobile Auth Header Helpers
 * 
 * Works seamlessly across:
 * 1. Production (Vercel): uses VITE_API_URL (set to Render HTTPS backend)
 * 2. Local Dev (Desktop localhost & Mobile Wi-Fi via Vite proxy): uses relative paths ('')
 *    so mobile only needs port 5173 open and cookies remain first-party SameSite=Lax.
 */

export const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return '';
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
    return `http://${window.location.hostname}:5000`;
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    console.error('[SpeakForge] VITE_API_URL is not configured for HTTPS production build!');
  }
  return '';
};

export const API_URL = getApiUrl();

const TOKEN_STORAGE_KEY = 'sf_auth_token';

export function getStoredToken() {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (typeof window !== 'undefined' && token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {
    // Ignore storage errors in restricted private browsing modes
  }
}

export function clearStoredToken() {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}

export function getAuthHeaders(extraHeaders = {}) {
  const token = getStoredToken();
  if (token) {
    return { Authorization: `Bearer ${token}`, ...extraHeaders };
  }
  return { ...extraHeaders };
}
