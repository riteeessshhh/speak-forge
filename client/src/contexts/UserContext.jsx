/**
 * UserContext.jsx — Global Auth State (Cookie-Based)
 * 
 * On mount, calls GET /api/auth/me with credentials: 'include'
 * to hydrate auth state from the HttpOnly cookie.
 * Exposes: user, login, signup, logout, isAuthenticated, isLoading
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const UserContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate auth state on mount from HttpOnly cookie
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        console.warn("Auth hydration failed:", err.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signup = useCallback(async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.warn("Logout request failed:", err.message);
    }
    setUser(null);
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    logout,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useAuth must be used within a UserProvider");
  }
  return context;
}
