import API from './axios';
import { supabase, supabaseAuthEnabled } from './supabase';

const query = config => new URLSearchParams(config?.params || {});
const requestUrl = path => new URL(path, 'http://localhost');

async function invoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('account-admin-api', {
    body: { action, ...payload },
  });
  if (error) {
    let message = error.message || 'Account request failed.';
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
  return data;
}

const AccountAdminAPI = {
  get(path, config) {
    if (!supabaseAuthEnabled) return API.get(path, config);
    const parsed = requestUrl(path);
    if (parsed.pathname === '/users') {
      const params = new URLSearchParams(parsed.search);
      query(config).forEach((value, key) => params.set(key, value));
      const role = params.get('role');
      return invoke('accounts', role ? { role } : {}).then(result => ({ data: result.data }));
    }
    if (parsed.pathname === '/users/my-created') {
      return invoke('my-created').then(result => ({ data: result.data }));
    }
    const account = /^\/users\/(\d+)$/.exec(parsed.pathname);
    if (account) {
      return invoke('account', { id: Number(account[1]) }).then(result => ({ data: result.data }));
    }
    if (parsed.pathname === '/auth/me') {
      return invoke('me').then(result => ({ data: result.data }));
    }
    if (parsed.pathname === '/admin/pending-staff') {
      return invoke('pending-staff').then(result => ({ data: result.data }));
    }
    if (parsed.pathname === '/admin/pending-clients') {
      return invoke('pending-clients').then(result => ({ data: result.data }));
    }
    if (parsed.pathname === '/admin/dashboard') {
      return invoke('dashboard').then(result => ({ data: result.data }));
    }
    return API.get(path, config);
  },

  post(path, body, config = {}) {
    if (!supabaseAuthEnabled) return API.post(path, body, config);
    if (path === '/users') {
      return invoke('create-client', { data: body }).then(data => ({ data }));
    }
    if (path === '/users/staff') {
      return invoke('create-staff', { data: body }).then(data => ({ data }));
    }
    const reset = /^\/users\/(\d+)\/request-password-reset$/.exec(path);
    if (reset) {
      return invoke('account-mutation', { operation: 'request-password-reset', id: Number(reset[1]) })
        .then(data => ({ data }));
    }
    if (path === '/auth/change-password') {
      return invoke('change-password', body).then(result => ({ data: result.data }));
    }
    return API.post(path, body, config);
  },

  put(path, body) {
    if (!supabaseAuthEnabled) return API.put(path, body);
    let match = /^\/users\/(\d+)\/(approve|reject|deactivate|reset-password)$/.exec(path);
    if (match) {
      const operation = match[2] === 'reset-password' ? 'reset-password' : match[2];
      return invoke('account-mutation', { operation, id: Number(match[1]) })
        .then(data => ({ data }));
    }
    match = /^\/admin\/approve-staff\/(\d+)$/.exec(path);
    if (match) {
      return invoke('account-mutation', { operation: 'approve-staff', id: Number(match[1]), status: body?.status })
        .then(data => ({ data }));
    }
    match = /^\/users\/(\d+)$/.exec(path);
    if (match) {
      return invoke('account-mutation', { operation: 'update', id: Number(match[1]), data: body })
        .then(data => ({ data }));
    }
    if (path === '/auth/profile') {
      return invoke('update-profile', { data: body }).then(result => ({ data: result.data }));
    }
    return API.put(path, body);
  },

  delete(path) {
    if (!supabaseAuthEnabled) return API.delete(path);
    const match = /^\/users\/(\d+)$/.exec(path);
    if (match) return invoke('account-mutation', { operation: 'delete', id: Number(match[1]) });
    return API.delete(path);
  },
};

export default AccountAdminAPI;
