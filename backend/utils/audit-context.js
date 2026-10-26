// Only link saved metadata; never reconstruct historical totals from today's stock.
function attachInventoryContext(entries, documents) {
  const byId = new Map(documents.map(doc => [doc.id, doc]));
  return entries.map(entry => {
    if (entry.outcome !== 'succeeded' || entry.details?.snapshot_version === 1) return entry;
    const doc = byId.get(entry.entity_id);
    if (!doc) return entry;
    const line = doc.inventory_document_items?.[0];
    const review = ['Inventory approve_restock', 'Inventory reject_restock'].includes(entry.action);
    const linked = {
      requires_approval: doc.actor_role === 'staff' && (doc.status === 'pending' || doc.reviewed_by != null),
      product: line ? { id: line.product_id, name: line.products?.name } : undefined,
      quantity_requested: line?.quantity,
      expiry_date: line?.expiry_date,
      requested_by: { id: doc.actor_id, name: doc.actor_name, role: doc.actor_role },
      reviewed_by: review ? { id: entry.actor_id, name: entry.actor_name, role: entry.actor_role } : undefined,
      // A later rejection reason must not appear as the earlier submitter's reason.
      reason: entry.action === 'Inventory reject_restock' ? doc.reason : undefined,
    };
    return { ...entry, details: { ...entry.details, linked_request: linked } };
  });
}

function attachOrderContext(entries, orders) {
  const byId = new Map(orders.filter(Boolean).map(order => [String(order.id), order]));
  return entries.map(entry => {
    if (entry.outcome !== 'succeeded' || entry.entity_type !== 'Order' || entry.action !== 'Create order' ||
        !/^\d+$/.test(entry.entity_id || '') || entry.details?.linked_order) return entry;
    const order = byId.get(String(entry.entity_id));
    if (!order) return entry;
    const linkedOrder = {
      receipt_number: order.receipt_number,
      customer_name: order.user_name,
      total_amount: order.total_amount,
      payment_method: order.payment_method,
      tendered_amount: order.tendered_amount,
      change_amount: order.change_amount,
      items: (order.items || []).map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      })),
    };
    return { ...entry, details: { ...entry.details, linked_order: linkedOrder } };
  });
}

module.exports = { attachInventoryContext, attachOrderContext };
