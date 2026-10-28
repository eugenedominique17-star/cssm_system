export const stockLabels = { in: 'In Stock', low: 'Low Stock', out: 'Out of Stock' };
export const movementLabels = { create_product: 'Product Created', restock: 'Stock Added', sale: 'Stock Sold', correct: 'Stock Adjusted', remove_expired: 'Expired Stock Removed', damage: 'Damaged / Written Off', supplier_return: 'Returned to Supplier', reorder_receive: 'Automatic Reorder Received', consolidated: 'Existing Stock Combined', opening_store: 'Opening Stock', receive: 'Stock Received (legacy)', transfer: 'Stock Transfer (legacy)', reversal: 'Transfer Reversed (legacy)', adjustment: 'Stock Adjusted' };
export function inventoryRows(products, batches, today, simpleReady = true) {
  const grouped = new Map();
  for (const batch of batches) {
    const expired = Boolean(batch.expiry_date && (simpleReady ? batch.expiry_date <= today : batch.expiry_date < today));
    const days = batch.expiry_date ? Math.round((Date.parse(`${batch.expiry_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null;
    if (!grouped.has(batch.product_id)) grouped.set(batch.product_id, []);
    grouped.get(batch.product_id).push({ ...batch, expired, soon: !expired && days !== null && days <= 7 });
  }
  return products.map(product => {
    const lots = (grouped.get(product.id) || []).sort((a, b) => (a.expiry_date || '9999').localeCompare(b.expiry_date || '9999'));
    const available = lots.reduce((n, b) => n + (b.expired ? 0 : b.store_qty), 0);
    return { ...product, batches: lots, available,
      physical: lots.reduce((n, b) => n + b.store_qty + b.warehouse_qty, 0),
      expired: lots.reduce((n, b) => n + (b.expired ? b.store_qty + b.warehouse_qty : 0), 0),
      soon: lots.reduce((n, b) => n + (b.soon ? b.store_qty : 0), 0),
      nextExpiry: lots.find(b => !b.expired && b.expiry_date && b.store_qty > 0)?.expiry_date,
      stockStatus: available === 0 ? 'out' : available <= (product.minimum_stock ?? 10) ? 'low' : 'in',
    };
  });
}
