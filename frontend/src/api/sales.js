import API from './axios';
import { supabase, supabaseAuthEnabled } from './supabase';

async function invoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('sales-api', {
    body: { action, ...payload },
  });
  if (error) {
    let message = error.message || 'Transaction request failed.';
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
  return data;
}

export async function getMyTransactions() {
  if (!supabaseAuthEnabled) return API.get('/transactions/my');
  const result = await invoke('my-transactions');
  return { data: result?.data };
}

export async function getTransactions() {
  if (!supabaseAuthEnabled) return API.get('/transactions');
  const result = await invoke('transactions-list');
  return { data: result?.data };
}

export async function getStaffTransactions() {
  if (!supabaseAuthEnabled) return API.get('/transactions/staff');
  const result = await invoke('staff-transactions');
  return { data: result?.data };
}

export async function getTransactionDetail(id) {
  if (!supabaseAuthEnabled) return API.get(`/transactions/${id}`);
  const result = await invoke('transaction-detail', { id: Number(id) });
  return { data: result?.data };
}

export async function createSale(payload) {
  if (!supabaseAuthEnabled) return API.post('/transactions', payload);
  const data = await invoke('create-sale', payload);
  return { data };
}

export async function completeWalkInSale(id, payment) {
  if (!supabaseAuthEnabled) {
    return API.post(`/transactions/walk-in-requests/${id}/complete`, payment);
  }
  const data = await invoke('complete-walk-in-sale', { id: Number(id), ...payment });
  return { data };
}

export async function getMyWalkInRequests() {
  if (!supabaseAuthEnabled) return API.get('/transactions/walk-in-requests/my');
  const result = await invoke('my-walk-in-requests');
  return { data: result?.data };
}

export async function getPendingWalkInRequests() {
  if (!supabaseAuthEnabled) return API.get('/transactions/walk-in-requests/pending');
  const result = await invoke('pending-walk-in-requests');
  return { data: result?.data };
}

export async function getCancelledWalkInRequests() {
  if (!supabaseAuthEnabled) return API.get('/transactions/walk-in-requests/cancelled');
  const result = await invoke('cancelled-walk-in-requests');
  return { data: result?.data };
}

export async function createWalkInRequest(items) {
  if (!supabaseAuthEnabled) return API.post('/transactions/walk-in-request', { items });
  const data = await invoke('create-walk-in-request', { items });
  return { data };
}

export async function createStaffWalkInRequest(payload) {
  if (!supabaseAuthEnabled) return API.post('/transactions/walk-in-request/staff', payload);
  const data = await invoke('create-staff-walk-in-request', payload);
  return { data };
}

export async function cancelWalkInRequest(id) {
  if (!supabaseAuthEnabled) {
    return API.post(`/transactions/walk-in-requests/${id}/cancel`);
  }
  const data = await invoke('cancel-walk-in-request', { id: Number(id) });
  return { data };
}
