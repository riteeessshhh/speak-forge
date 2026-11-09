/**
 * lib/api.js — Dynamic API Base URL Resolution
 * 
 * Works seamlessly across:
 * 1. Production (Vercel): uses VITE_API_URL
 * 2. Mobile on local Wi-Fi: automatically uses window.location.hostname:5000 (e.g. 10.43.176.233:5000)
 * 3. Desktop localhost: uses localhost:5000
 */

export const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:5000`;
  }
  return 'http://localhost:5000';
};

export const API_URL = getApiUrl();
