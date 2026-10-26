import API from './axios';
import { supabase, supabaseAuthEnabled } from './supabase';

async function invoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('submission-api', {
    body: { action, ...payload },
  });
  if (error) {
    let message = error.message || 'Submission request failed.';
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

export async function getPendingSubmissions() {
  if (!supabaseAuthEnabled) return API.get('/admin/pending-submissions');
  const result = await invoke('pending');
  return { data: result?.data };
}

export async function getMySubmissions() {
  if (!supabaseAuthEnabled) return API.get('/admin/my-submissions');
  const result = await invoke('mine');
  return { data: result?.data };
}

export async function reviewSubmission(id, status, adminNotes) {
  if (!supabaseAuthEnabled) {
    return API.put(`/admin/approve-submission/${id}`, {
      status,
      admin_notes: adminNotes,
    });
  }
  const data = await invoke('review', { id: Number(id), status, admin_notes: adminNotes });
  return { data };
}
