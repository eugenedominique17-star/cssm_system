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
module.exports = { attachInventoryContext };
