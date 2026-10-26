import API from './axios';
import { supabase, supabaseAuthEnabled } from './supabase';

async function invoke(action, params) {
  const { data, error } = await supabase.functions.invoke('admin-data-api', {
    body: { action, params },
  });
  if (error) {
    let message = error.message || 'Admin data request failed.';
    if (error.context && typeof error.context.json === 'function') {
      try {
        const result = await error.context.json();
        if (typeof result?.message === 'string') message = result.message;
      } catch {
        // Keep the SDK message when the function response is not JSON.
      }
    }
    throw Object.assign(new Error(message), { response: { data: { message } } });
  }
  return { data: data?.data };
}

const AdminDataAPI = {
  get(path, config = {}) {
    if (!supabaseAuthEnabled) return API.get(path, config);
    if (path.startsWith('/admin/reports')) {
      const url = new URL(path, window.location.origin);
      const params = new URLSearchParams(url.search);
      Object.entries(config.params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, String(value));
      });
      return invoke('reports', Object.fromEntries(params.entries()));
    }
    if (path === '/admin/audit-logs') {
      return invoke('audit-logs', config.params || {});
    }
    return API.get(path, config);
  },
  post(path, body, config = {}) {
    if (!supabaseAuthEnabled) return API.post(path, body, config);
    const match = /^\/admin\/audit-logs\/([^/]+)\/reveal-previous-password$/.exec(path);
    if (match) return invoke('reveal-previous-password', { id: match[1], adminPassword: body?.adminPassword });
    return API.post(path, body, config);
  },
};

export default AdminDataAPI;
