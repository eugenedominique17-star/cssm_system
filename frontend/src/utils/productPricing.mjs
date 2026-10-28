export function calculateSellingPrice(purchasePrice, markupPercent) {
  if (purchasePrice === '' || purchasePrice === null || purchasePrice === undefined
    || markupPercent === '' || markupPercent === null || markupPercent === undefined) {
    return null;
  }
  const cost = Number(purchasePrice);
  const markup = Number(markupPercent);
  if (!Number.isFinite(cost) || cost <= 0 || cost > 99_999_999
    || !Number.isFinite(markup) || markup < 0 || markup > 10_000) return null;
  const price = Math.round((cost * (1 + markup / 100) + Number.EPSILON) * 100) / 100;
  return Number.isFinite(price) && price > 0 && price <= 99_999_999 ? price : null;
}
