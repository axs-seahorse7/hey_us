import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../../services/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      try {
        const token = localStorage.getItem('dear-us-token');
        if (token) {
          const userData = await authApi.getCurrentUser(token);
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('Session expired or invalid:', err);
        localStorage.removeItem('dear-us-token');
        localStorage.removeItem('dear-us-user');
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('dear-us-token', token);
    localStorage.setItem('dear-us-user', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('dear-us-token');
    localStorage.removeItem('dear-us-user');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
