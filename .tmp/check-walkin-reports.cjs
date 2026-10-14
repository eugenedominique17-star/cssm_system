const assert = require('node:assert/strict');
const controller = require('../backend/controllers/admin.controller');
const { storeDate } = require('../backend/utils/expiry');
(async () => {
  const end = storeDate();
  const start = end.slice(0, 7) + '-01';
  const results = {};
  for (const chart of ['sales_trend', 'sales_category', 'top_products']) {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await controller.getSalesReport({ query: { chart, start_date: start, end_date: end } }, res);
    assert.equal(res.code, 200, JSON.stringify(res.body));
    results[chart] = res.body;
  }
  assert.deepEqual(results.sales_category.summary, results.sales_trend.summary);
  assert.deepEqual(results.top_products.summary, results.sales_trend.summary);
  const categoryTotal = results.sales_category.data.reduce((sum, row) => sum + row.total_sales, 0);
  assert.ok(Math.abs(categoryTotal - results.sales_trend.summary.total_revenue) < 0.01);
  console.log(JSON.stringify({ read_only: true, range: [start, end], summaries_match: true, categories_reconcile: true,
    projection_available: results.sales_trend.projection.available,
    projection_source: [results.sales_trend.projection.source_start, results.sales_trend.projection.source_end] }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
