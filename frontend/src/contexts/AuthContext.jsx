import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import API from '../api/axios';
import { supabase, supabaseAuthEnabled } from '../api/supabase';

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
    let mounted = true;
    const subscription = supabaseAuthEnabled
      ? supabase.auth.onAuthStateChange((event, session) => {
          if (session?.access_token) {
            localStorage.setItem('token', session.access_token);
          } else if (event === 'SIGNED_OUT') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (mounted) setUser(null);
          }
        }).data.subscription
      : null;

    const restoreSession = async () => {
      if (supabaseAuthEnabled) {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) console.error('Failed to restore Supabase Auth session:', error);
        if (data.session?.access_token) localStorage.setItem('token', data.session.access_token);
      }

      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (token && storedUser) {
        try {
          if (mounted) setUser(normalizeUser(JSON.parse(storedUser)));
        } catch (error) {
          console.error('Failed to restore saved user session:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      if (mounted) setLoading(false);
    };

    restoreSession().catch(error => {
      console.error('Failed to initialize authentication:', error);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (identifier, password) => {
    if (supabaseAuthEnabled) {
      const { data, error } = await supabase.functions.invoke('legacy-auth-migrate', {
        body: { identifier, password },
      });
      if (error) {
        let message = error.message || 'Login failed. Please try again.';
        if (error.context && typeof error.context.json === 'function') {
          try {
            const body = await error.context.json();
            if (typeof body?.message === 'string') message = body.message;
          } catch {
            // Keep the SDK error message when the function response is not JSON.
          }
        }
        throw Object.assign(new Error(message), { response: { data: { message } } });
      }
      if (!data?.session?.access_token || !data?.session?.refresh_token || !data?.user) {
        throw Object.assign(new Error('Authentication response was incomplete.'), {
          response: { data: { message: 'Authentication response was incomplete.' } },
        });
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessionError || !sessionData.session) {
        const message = sessionError?.message || 'Unable to save the Supabase Auth session.';
        throw Object.assign(new Error(message), { response: { data: { message } } });
      }
      const normalizedUser = normalizeUser(data.user);
      localStorage.setItem('token', sessionData.session.access_token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      return normalizedUser;
    }

    const response = await API.post('/auth/login', { identifier, password });
    const { token, user: userData } = response.data;
    const normalizedUser = normalizeUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    setUser(normalizedUser);
    return normalizedUser;
  };

  const logout = () => {
    if (supabaseAuthEnabled) {
      supabase.auth.signOut({ scope: 'local' }).then(({ error }) => {
        if (error) console.error('Failed to clear the Supabase Auth session:', error);
      }).catch(error => {
        console.error('Failed to clear the Supabase Auth session:', error);
      });
    }
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
