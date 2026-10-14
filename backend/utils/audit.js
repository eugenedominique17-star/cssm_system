// Explicitly allowlist metadata. Never copy request/response bodies into the log.
function describeRequest(req) {
  const method = req.method;
  const route = `${req.baseUrl}${req.route?.path || ''}`;
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) return null;
  const groups = { products: 'Product', promos: 'Promo', users: 'Account', transactions: 'Order', admin: 'Approval', auth: 'Account', inventory: 'Inventory' };
  const group = req.baseUrl.split('/').pop();
  // This RPC records the verified old/new dates atomically with its update.
  if (group === 'inventory' && req.params?.kind === 'expiry') return null;
  if (!groups[group]) return null;
  const verbs = { POST: 'Create', PUT: 'Update', PATCH: 'Update', DELETE: 'Delete' };
  let action = `${verbs[method]} ${groups[group].toLowerCase()}`;
  if (group === 'inventory') action = `Inventory ${req.params.kind}`;
  if (route.includes('approve-submission')) action = req.body?.status === 'rejected' ? 'Reject submission' : 'Approve submission';
  else if (route.includes('approve-staff') || route.endsWith('/approve')) action = req.body?.status === 'rejected' ? 'Reject account' : 'Approve account';
  else if (route.endsWith('/reject')) action = 'Reject account';
  else if (route.endsWith('/deactivate')) action = 'Deactivate account';
  else if (route.endsWith('/request-password-reset')) action = 'Request password reset';
  else if (route.endsWith('/reset-password')) action = 'Reset password';
  else if (route.endsWith('/change-password')) action = 'Change password';
  else if (route.endsWith('/profile')) action = 'Update profile';
  else if (route.endsWith('/complete')) action = 'Complete order';
  else if (route.endsWith('/cancel')) action = 'Cancel order';
  const details = {};
  const fields = group === 'products' ? ['name', 'stock', 'price', 'category', 'status']
    : group === 'promos' ? ['title', 'discount_type', 'discount_value', 'status']
    : group === 'admin' ? ['status'] : [];
  for (const key of fields) {
    const value = req.body?.[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      details[key] = typeof value === 'string' ? value.slice(0, 200) : value;
    }
  }
  return { action, entity_type: groups[group], entity_id: req.params?.id ? String(req.params.id) : group === 'auth' ? String(req.user.id) : null, details: { requested: details } };
}

function completion(entry, body, statusCode) {
  const result = { outcome: statusCode < 400 ? 'succeeded' : 'failed', finished_at: new Date().toISOString(), details: { ...entry.details, http_status: statusCode } };
  if (statusCode < 400) {
    const id = body?.inventoryId ?? body?.submissionId ?? body?.productId ?? body?.promoId ?? body?.userId ?? body?.transactionId;
    if (typeof id === 'number' || typeof id === 'string') result.entity_id = String(id);
    if (body?.submissionId && ['Product', 'Promo'].includes(entry.entity_type)) {
      result.action = `Submit ${entry.entity_type.toLowerCase()} for approval`;
      result.details.reference_type = 'Submission';
    }
  }
  return result;
}

module.exports = { describeRequest, completion };
