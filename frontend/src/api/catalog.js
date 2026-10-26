import API from './axios';
import { supabase, supabaseAuthEnabled, supabaseHomepageCatalogEnabled } from './supabase';

const legacyPath = (resource, active) => {
  if (resource === 'homepage') return '/public/homepage';
  const query = active ? '?active=true' : '';
  return `/${resource}${query}`;
};

export async function getCatalog(resource, { active = false } = {}) {
  if (!['homepage', 'products', 'promos'].includes(resource)) {
    throw new Error(`Unsupported catalog resource: ${resource}`);
  }

  const useSupabase = supabaseAuthEnabled || (resource === 'homepage' && supabaseHomepageCatalogEnabled);
  if (!useSupabase) {
    return API.get(legacyPath(resource, active));
  }

  const { data, error } = await supabase.functions.invoke('catalog-read', {
    body: { action: resource, active },
  });
  if (error) {
    let message = error.message || 'Unable to load the store catalog.';
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json();
        if (typeof body?.message === 'string') message = body.message;
      } catch {
        // Keep the SDK message when the function response is not JSON.
      }
    }
    throw Object.assign(new Error(message), {
      response: { data: { message } },
    });
  }

  return { data: resource === 'homepage' ? data : data?.data };
}

export async function getCatalogItem(resource, id) {
  if (!['product', 'promo'].includes(resource) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) {
    throw new Error('A valid product or promo ID is required.');
  }
  if (!supabaseAuthEnabled) return API.get(`/${resource === 'product' ? 'products' : 'promos'}/${id}`);
  const { data, error } = await supabase.functions.invoke('catalog-read', {
    body: { action: resource, id: Number(id) },
  });
  if (error) {
    let message = error.message || 'Unable to load the catalog item.';
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
  return { data: data?.data };
}

export async function getLowStockProducts(threshold) {
  if (!supabaseAuthEnabled) {
    const query = threshold === undefined ? '' : `?threshold=${encodeURIComponent(threshold)}`;
    return API.get(`/products/low-stock${query}`);
  }
  const { data, error } = await supabase.functions.invoke('catalog-read', {
    body: { action: 'low-stock', ...(threshold === undefined ? {} : { threshold: Number(threshold) }) },
  });
  if (error) {
    let message = error.message || 'Unable to load low-stock products.';
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
  return { data: data?.data };
}
