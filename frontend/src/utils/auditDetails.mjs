const labels = {
  'Inventory approve_restock': 'Stock Request Approved',
  'Inventory reject_restock': 'Stock Request Rejected',
  'Inventory restock': 'Restock',
  'Inventory correct': 'Stock Count Corrected',
  'Inventory remove_expired': 'Expired Stock Removed',
  'Inventory create_product': 'Product Created',
  'Inventory edit_product': 'Product Details Updated',
  'Edit batch expiry': 'Expiration Date Updated',
  'Create order': 'Order Created',
};
export function auditTitle(entry) {
  const staffRequest = entry.action === 'Inventory restock' && entry.actor_role === 'staff' && (entry.details?.snapshot_version === 1 || entry.details?.linked_request?.requires_approval === true);
  const label = staffRequest ? 'Stock Request Submitted' : labels[entry.action] || entry.action;
  return entry.outcome === 'failed' ? `${label} — Failed` : entry.outcome === 'pending' ? `${label} — Unconfirmed` : label;
}
export function auditPresentation(entry) {
  const details = entry.details || {};
  if (entry.outcome === 'failed') return { severity: 'error', message: 'This action failed. No successful change is confirmed by this activity.' };
  if (entry.outcome === 'pending') return { severity: 'warning', message: 'The final result was not recorded. Do not assume the action failed or repeat it without checking its status.' };
  if (details.snapshot_version === 1) return { severity: details.replayed ? 'info' : 'success', message: details.result, changes: details.changes || [] };
  if (['Approve submission', 'Reject submission'].includes(entry.action)) return {
    severity: 'success',
    message: `${entry.action === 'Reject submission' ? 'Submission rejected. The requested changes were not applied.' : 'Submission approved successfully.'} This older activity did not save the submission's Before / After details.`,
  };
  if (['Approve account', 'Reject account'].includes(entry.action)) return {
    severity: 'success',
    message: `${entry.action === 'Approve account' ? 'Account approved' : 'Account rejected'} successfully. This older activity did not save the account's Before / After status.`,
  };
  if (entry.entity_type === 'Order' && entry.action === 'Create order') {
    return {
      severity: details.linked_order ? 'success' : 'warning',
      message: details.linked_order ? 'Order created. The saved transaction record is shown below.' : 'Order created, but its saved transaction record could not be loaded.',
    };
  }
  if (entry.action === 'Edit batch expiry') return { severity: 'success', message: 'The expiration change was recorded with the database update.', changes: [{ field: 'expiry_date', label: 'Expiration date', before: details.old_expiry_date, after: details.new_expiry_date }] };
  if (entry.action === 'Inventory approve_restock') return { severity: 'success', message: 'Stock request approved. Historical Before / After values were not recorded for this activity.' };
  if (entry.action === 'Inventory reject_restock') return { severity: 'info', message: 'Stock request rejected. Available stock was not changed by this action.' };
  if (entry.action.startsWith('Submit ') || (entry.action === 'Inventory restock' && entry.actor_role === 'staff' && details.linked_request?.requires_approval === true)) return { severity: 'info', message: 'Request submitted. Submission alone does not add stock; admin approval is required.' };
  return { severity: 'info', message: 'Activity completed. Detailed Before / After changes were not recorded for this activity.' };
}
export const auditValue = value => value === null || value === undefined || value === '' ? 'Not set' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
