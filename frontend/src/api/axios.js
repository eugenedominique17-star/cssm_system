import axios from 'axios';
import { API_BASE } from './baseUrl';
import { supabase, supabaseAuthEnabled } from './supabase';

const API = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add JWT token
API.interceptors.request.use(
  async (config) => {
    let token = localStorage.getItem('token');
    if (supabaseAuthEnabled) {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      token = data.session?.access_token || token;
      if (token) localStorage.setItem('token', token);
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 errors
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED' && window.location.pathname !== '/change-password') {
      window.location.href = '/change-password';
    }
    if (error.response && error.response.status === 401 && !error.config?.skipAuthRedirect) {
      if (supabaseAuthEnabled) {
        supabase.auth.signOut({ scope: 'local' }).then(({ error: signOutError }) => {
          if (signOutError) console.error('Failed to clear an expired Supabase Auth session:', signOutError);
        }).catch(signOutError => {
          console.error('Failed to clear an expired Supabase Auth session:', signOutError);
        });
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default API;
