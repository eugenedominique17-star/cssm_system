const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const express = require('../backend/node_modules/express');
const { chromium } = require('./walkin-browser/node_modules/playwright-core');
const app = express();
const root = path.resolve(__dirname, '../frontend/build-walkin-check');
app.use(express.static(root));
app.get('*', (_req, res) => res.sendFile(path.join(root, 'index.html')));
const product = { id: 1, name: 'Demo Milk', category: 'Dairy', price: 20, stock: 10, status: 'active', expiry_date: '2999-01-01' };
const client = { id: 100, name: 'Demo Customer', email: 'demo@example.test', role: 'client', status: 'active' };
const cashier = { id: 200, name: 'Demo Cashier', role: 'staff', status: 'active' };
const sale = { id: 501, receipt_number: 'REC-DEMO-501', user_id: 100, staff_id: 200, user_name: client.name, staff_name: cashier.name,
  total_amount: 20, payment_method: 'cash', tendered_amount: 50, change_amount: 30, created_at: '2026-10-12T08:00:00+08:00',
  product_summary: 'Demo Milk x1', items: [{ id: 1, product_id: 1, product_name: product.name, quantity: 1, unit_price: 20, subtotal: 20 }] };
let sales = [];
let salePosts = 0;
let historyGets = 0;
const reportQueries = [];
const unexpected = [];
const errors = [];

(async () => {
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  let browser;
  try {
    const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
    browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--disable-gpu'] });
    async function pageFor(user) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/New_York' });
      await context.addInitScript(user => {
        if (user) { localStorage.setItem('token', 'browser-fixture'); localStorage.setItem('user', JSON.stringify(user)); }
        window.testStreams = [];
        window.EventSource = class {
          constructor() { this.listeners = {}; window.testStreams.push(this); setTimeout(() => this.emit('connected', {}), 20); }
          addEventListener(name, fn) { this.listeners[name] = fn; }
          emit(name, data) { if (!this.closed) this.listeners[name]?.({ data: JSON.stringify(data) }); }
          close() { this.closed = true; }
        };
      }, user);
      await context.route('**/api/**', async route => {
        const request = route.request(); const url = new URL(request.url()); const p = url.pathname;
        let body;
        if (p.endsWith('/public/homepage')) body = { products: [product], promos: [] };
        else if (p.endsWith('/products')) body = [product];
        else if (p.endsWith('/promos')) body = [];
        else if (p.endsWith('/users')) body = [client];
        else if (p.endsWith('/transactions/my')) { historyGets++; body = sales; }
        else if (p.endsWith('/transactions/501')) body = sale;
        else if (p.endsWith('/transactions') && request.method() === 'POST') {
          const payload = request.postDataJSON();
          assert.equal(payload.user_id, 100); assert.equal(payload.tendered_amount, 50);
          assert.deepEqual(payload.items, [{ product_id: 1, quantity: 1 }]);
          assert.match(payload.request_id, /^[a-f0-9-]{36}$/);
          salePosts++; sales = [sale]; product.stock = 9;
          body = { transactionId: 501, receipt_number: sale.receipt_number };
        } else if (p.endsWith('/transactions')) body = sales;
        else if (p.endsWith('/admin/reports')) {
          reportQueries.push(Object.fromEntries(url.searchParams));
          const chart = url.searchParams.get('chart');
          body = { summary: { total_revenue: 20, total_transactions: 1 }, data: [] };
          if (chart === 'sales_category') body.data = [{ category: 'Dairy', total_sales: 20 }];
          if (chart === 'top_products') body.data = [{ name: product.name, category: 'Dairy', total_quantity: 1, total_sales: 20 }];
          if (chart === 'sales_trend') Object.assign(body, {
            data: [{ date: url.searchParams.get('start_date'), total_sales: 20, transaction_count: 1 }],
            comparison: { previous_start_date: '2026-09-01', previous_end_date: '2026-09-30', total_revenue: 10, revenue_change_percent: 100 },
            projection: { available: true, source_start: '2026-10-05', source_end: '2026-10-11', forecast_start: '2026-10-12', forecast_end: '2026-10-18', average_daily_sales: 20, estimated_revenue: 140, method: 'Average daily sales × 7; estimate only.' },
          });
        } else { unexpected.push(p); body = []; }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      const page = await context.newPage();
      page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
      return page;
    }
    const base = `http://127.0.0.1:${server.address().port}`;
    if (!process.argv.includes('--reports-only')) {
    const home = await pageFor(null);
    await home.goto(base);
    await home.getByRole('button', { name: 'Sign Up', exact: true }).waitFor();
    assert.ok((await home.locator('body').innerText()).includes('8:00 AM–6:00 PM'));
    assert.equal(await home.locator('a[href="tel:09515200688"]').count(), 2);
    await home.getByRole('button', { name: 'Sign Up', exact: true }).click();
    await home.waitForURL('**/register/client');
    console.log('PASS homepage business details and signup link');
    await home.context().close();

    const customer = await pageFor(client);
    await customer.goto(base + '/client/history');
    await customer.getByText('Purchase History', { exact: true }).last().waitFor();
    const staff = await pageFor(cashier);
    await staff.goto(base + '/staff/order-management');
    await staff.waitForURL('**/staff/receipts');
    await staff.getByRole('button', { name: 'New Receipt', exact: true }).click();
    const dialog = staff.getByRole('dialog');
    await dialog.getByRole('combobox').nth(0).click();
    await staff.getByRole('option', { name: /Demo Customer/ }).click();
    await dialog.getByRole('combobox').nth(2).click();
    await staff.getByRole('option', { name: /Demo Milk/ }).click();
    await dialog.getByLabel('Amount Tendered').fill('10');
    assert.equal(await dialog.getByRole('button', { name: 'Complete Sale' }).isDisabled(), true);
    await dialog.getByLabel('Amount Tendered').fill('50');
    await dialog.getByRole('button', { name: 'Complete Sale' }).click();
    await staff.getByText('Receipt Preview', { exact: true }).waitFor();
    assert.equal(salePosts, 1);
    assert.ok(!(await staff.locator('body').innerText()).includes('Pending Walk-in Requests'));
    console.log('PASS direct cashier sale, insufficient payment guard, automatic receipt preview, no pending queue');

    await customer.evaluate(sale => window.testStreams.filter(s => !s.closed).forEach(s => s.emit('order_status_update', {
      status: 'completed', message: 'Your in-store purchase is complete.', receipt_number: sale.receipt_number,
    })), sale);
    await customer.getByText('Purchase completed!', { exact: true }).waitFor();
    await customer.getByText('Paid / Completed', { exact: true }).waitFor();
    await customer.getByText('Demo Cashier', { exact: true }).waitFor();
    const beforeReconnect = historyGets;
    await customer.evaluate(() => window.testStreams.filter(s => !s.closed).forEach(s => s.emit('connected', {})));
    await customer.waitForResponse(response => response.url().includes('/transactions/my'));
    assert.ok(historyGets > beforeReconnect);
    await customer.screenshot({ path: path.join(__dirname, 'walkin-history.png'), fullPage: true });
    console.log('PASS live customer receipt, completed status, cashier name, reconnect reload');
    await staff.context().close(); await customer.context().close();
    }

    const admin = await pageFor({ id: 300, name: 'Demo Admin', role: 'admin', status: 'active' });
    await admin.goto(base + '/admin/reports');
    await admin.getByText('Next 7 days: estimated sales', { exact: true }).waitFor();
    await admin.getByRole('combobox').click();
    await admin.getByRole('option', { name: 'Custom dates', exact: true }).click();
    await admin.getByLabel('Start date', { exact: true }).fill('2026-10-01');
    await admin.getByLabel('End date', { exact: true }).fill('2026-10-12');
    await admin.getByText('Revenue increased by 100.0%', { exact: false }).waitFor();
    await admin.waitForFunction(() => !document.querySelector('[role="progressbar"]'));
    const last = reportQueries.slice(-3);
    assert.equal(last.length, 3);
    for (const query of last) { assert.equal(query.start_date, '2026-10-01'); assert.equal(query.end_date, '2026-10-12'); }
    await admin.screenshot({ path: path.join(__dirname, 'walkin-reports.png'), fullPage: true });
    console.log('PASS consistent custom filters, comparison, analysis and projection');
    assert.deepEqual(errors, []);
    assert.ok(!unexpected.some(p => /walk-in-request/.test(p)), JSON.stringify(unexpected));
    console.log('PASS no browser runtime errors or legacy order API calls');
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
  finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
