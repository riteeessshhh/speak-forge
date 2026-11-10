/**
 * UserContext.jsx — Global Auth State (Cookie + Bearer Fallback)
 * 
 * On mount, calls GET /api/auth/me with credentials: 'include' and Bearer token fallback
 * so both first-party cookies and mobile browsers that block cross-site cookies work reliably.
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API_URL, getAuthHeaders, setStoredToken, clearStoredToken } from "../lib/api";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate auth state on mount from HttpOnly cookie or stored fallback token
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else if (res.status === 401) {
          clearStoredToken();
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
    if (data.token) setStoredToken(data.token);
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
    if (data.token) setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.warn("Logout request failed:", err.message);
    }
    clearStoredToken();
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
