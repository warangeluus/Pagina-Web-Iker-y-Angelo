import assert from 'node:assert/strict';

// Test doubles run only in a disposable browser context, never in the user's database.
export async function testPendingPurchases(browser, baseURL, check) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(baseURL);
    await page.waitForSelector('#products article');
    await page.clock.setFixedTime(new Date('2026-10-06T15:00:00Z'));
    const initial = await page.evaluate(async () => {
      const api = await import('./js/pending-purchases.js');
      const record = await api.createPendingPurchase([{ productId: 'test-product', variantId: 'test-variant', quantity: 1 }]);
      let duplicateRejected = false;
      try { await api.savePendingPurchase(record); } catch { duplicateRejected = true; }
      const result = await api.retryPendingPurchases(async () => { throw new Error('network failure'); });
      let calls = 0;
      await api.retryPendingPurchases(async () => { calls++; });
      return { record, duplicateRejected, result, calls, pending: await api.listPendingPurchases() };
    });
    assert.match(initial.record.id, /^[0-9a-f-]{36}$/);
    assert.ok(initial.duplicateRejected);
    assert.deepEqual(initial.result, { confirmed: 0, retained: 1 });
    assert.equal(initial.calls, 0);
    assert.equal(initial.pending[0].id, initial.record.id);
    await page.reload();
    await page.waitForSelector('#products article');
    await page.clock.setFixedTime(new Date('2026-10-06T15:00:31Z'));
    const invalid = await page.evaluate(async () => {
      const api = await import('./js/pending-purchases.js');
      return api.retryPendingPurchases(async () => ({ purchaseId: 'wrong-id', receiptId: 'test-receipt' }));
    });
    assert.deepEqual(invalid, { confirmed: 0, retained: 1 });
    await page.clock.setFixedTime(new Date('2026-10-06T15:01:32Z'));
    const accepted = await page.evaluate(async () => {
      const api = await import('./js/pending-purchases.js');
      let calls = 0;
      let key;
      const adapter = async (record, options) => {
        calls++;
        key = options.idempotencyKey;
        return { purchaseId: record.id, receiptId: 'test-receipt' };
      };
      await Promise.all([api.retryPendingPurchases(adapter), api.retryPendingPurchases(adapter)]);
      return { calls, key, pending: await api.listPendingPurchases() };
    });
    assert.equal(accepted.calls, 1);
    assert.equal(accepted.key, initial.record.id);
    assert.deepEqual(accepted.pending, []);
    assert.equal(await page.locator('#cart-count').textContent(), '0');
    check('Pendientes: UUID, duplicados, persistencia, backoff, recibo obligatorio y reintentos coordinados');
  } finally { await context.close(); }
}
