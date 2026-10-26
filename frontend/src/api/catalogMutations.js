import APIClient from './axios';
import { supabase, supabaseAuthEnabled } from './supabase';

async function invoke(resource, operation, id, data) {
  const { data: result, error } = await supabase.functions.invoke('catalog-mutate', {
    body: { resource, operation, ...(id === undefined ? {} : { id }), ...(data === undefined ? {} : { data }) },
  });
  if (error) {
    let message = error.message || 'Catalog change failed.';
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json();
        if (typeof body?.message === 'string') message = body.message;
      } catch {
        // Keep the SDK message when the function response is not JSON.
      }
    }
    throw Object.assign(new Error(message), { response: { data: { message } } });
  }
  return { data: result };
}

const CatalogMutationAPI = {
  post(path, data) {
    if (!supabaseAuthEnabled) return APIClient.post(path, data);
    const resource = path === '/products' ? 'products' : path === '/promos' ? 'promos' : null;
    if (!resource) return Promise.reject(new Error(`Unsupported catalog mutation: ${path}`));
    return invoke(resource, 'create', undefined, data);
  },

  put(path, data) {
    if (!supabaseAuthEnabled) return APIClient.put(path, data);
    const match = /^\/(products|promos)\/(\d+)$/.exec(path);
    if (!match) return Promise.reject(new Error(`Unsupported catalog mutation: ${path}`));
    return invoke(match[1], 'update', Number(match[2]), data);
  },

  delete(path) {
    if (!supabaseAuthEnabled) return APIClient.delete(path);
    const match = /^\/(products|promos)\/(\d+)$/.exec(path);
    if (!match) return Promise.reject(new Error(`Unsupported catalog mutation: ${path}`));
    return invoke(match[1], 'delete', Number(match[2]));
  },
};

export default CatalogMutationAPI;
