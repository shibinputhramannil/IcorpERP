import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => {
    return Boolean(localStorage.getItem('access_token'));
  });

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return;
    }

    let isMounted = true;

    api.get('/auth/me/')
      .then(({ data }) => {
        if (isMounted) {
          setUser(data);
          localStorage.setItem('user', JSON.stringify(data));
        }
      })
      .catch((error) => {
        if (isMounted && error.response?.status === 401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    const handleLogoutEvent = () => {
      setUser(null);
    };

    window.addEventListener('auth:logout', handleLogoutEvent);
    return () => {
      isMounted = false;
      window.removeEventListener('auth:logout', handleLogoutEvent);
    };
  }, []);

  /**
   * Login user with username/email and password
   */
  const login = async (username, password) => {
    // 1. Obtain JWT access & refresh tokens
    const { data: tokenData } = await api.post('/auth/login/', {
      username,
      password,
    });

    localStorage.setItem('access_token', tokenData.access);
    localStorage.setItem('refresh_token', tokenData.refresh);

    // 2. Fetch current user profile with memberships
    const { data: userData } = await api.get('/auth/me/');
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));

    return userData;
  };

  /**
   * Securely logout user and purge stored credentials
   */
  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    window.dispatchEvent(new Event('auth:logout'));
  };

  /**
   * Refetch current user profile (e.g. after company switch or membership update)
   */
  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me/');
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      return data;
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
      throw error;
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
