const test = require('node:test');
const assert = require('node:assert/strict');
test('expiry monitor uses Philippine midnight, keeps expiry today separate, and handles missing dates', async () => {
  const { philippineDate, daysRemaining, matchesExpiry } = await import('../../frontend/src/utils/expiry.mjs');
  assert.equal(philippineDate(new Date('2026-10-06T15:59:59Z')), '2026-10-06');
  const today = philippineDate(new Date('2026-10-06T16:00:00Z'));
  assert.equal(today, '2026-10-07');
  assert.equal(daysRemaining('2026-10-06', today), -1);
  assert.equal(matchesExpiry(today, today, 'expired'), false);
  assert.equal(matchesExpiry(today, today, 'today'), true);
  assert.equal(matchesExpiry(null, today, 'missing'), true);
  assert.equal(matchesExpiry(null, today, 'expired'), false);
  for (const window of [7, 15, 30]) {
    const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + window);
    assert.equal(matchesExpiry(end.toISOString().slice(0,10), today, String(window)), true);
    end.setUTCDate(end.getUTCDate() + 1);
    assert.equal(matchesExpiry(end.toISOString().slice(0,10), today, String(window)), false);
    assert.equal(matchesExpiry('2026-10-06', today, String(window)), false);
  }
});
