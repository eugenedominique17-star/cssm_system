import API from './axios';
import { supabase, supabaseAuthEnabled } from './supabase';

async function invoke(body) {
  const { data, error } = await supabase.functions.invoke('inventory-api', { body });
  if (error) {
    let message = error.message || 'Inventory request failed.';
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
  return { data };
}

const queryParams = config => new URLSearchParams(config?.params || {});

const InventoryAPI = {
  get(path, config) {
    if (!supabaseAuthEnabled) return API.get(path, config);
    if (path === '/inventory') return invoke({ action: 'overview' });
    if (path === '/inventory/history') {
      const params = queryParams(config);
      return invoke({
        action: 'history',
        page: Number(params.get('page') || 0),
        type: params.get('type') || 'documents',
        ...(params.has('product_id') ? { product_id: params.get('product_id') } : {}),
      });
    }
    if (path === '/inventory/requests') {
      const params = queryParams(config);
      return invoke({
        action: 'requests',
        page: Number(params.get('page') || 0),
        status: params.get('status') || 'all',
      });
    }
    return Promise.reject(new Error(`Unsupported inventory request: ${path}`));
  },

  post(path, payload) {
    if (!supabaseAuthEnabled) return API.post(path, payload);
    const kind = path.startsWith('/inventory/') ? path.slice('/inventory/'.length) : '';
    if (!kind) return Promise.reject(new Error(`Unsupported inventory request: ${path}`));
    return invoke({ action: 'command', kind, ...payload });
  },
};

export default InventoryAPI;
