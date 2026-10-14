import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import API from '../api/axios';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const normalizeUser = (userData) => {
  if (!userData) return null;

  const normalizedRole = String(userData.role || '').toLowerCase();

  return {
    ...userData,
    role: normalizedRole === 'user' ? 'client' : normalizedRole
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      try {
        setUser(normalizeUser(JSON.parse(storedUser)));
      } catch (error) {
        console.error('Failed to restore saved user session:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    setLoading(false);
  }, []);

  const login = async (identifier, password) => {
    const response = await API.post('/auth/login', { identifier, password });
    const { token, user: userData } = response.data;
    const normalizedUser = normalizeUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    setUser(normalizedUser);
    return normalizedUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('storehub-cart-')) {
        localStorage.removeItem(key);
      }
    });

    setUser(null);
  };

  const updateUser = useCallback((userData) => {
    const normalizedUser = normalizeUser(userData);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    setUser(normalizedUser);
  }, []);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';
  const isClient = user?.role === 'client';

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      updateUser,
      isAuthenticated,
      isAdmin,
      isStaff,
      isClient,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
