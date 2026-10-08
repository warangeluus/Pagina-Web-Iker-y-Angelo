import { storageTransaction } from './storage.js';

// Future explicit purchase flow only. No UI, connectivity listener or background sender calls this module.
export function validatePendingPurchase(value) {
  const validId = id => typeof id === 'string' && /^[a-z0-9-]{1,100}$/i.test(id);
  if (!value || !validId(value.id) || typeof value.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(value.createdAt)) || new Date(value.createdAt).toISOString() !== value.createdAt ||
      !Array.isArray(value.items) || !value.items.length || value.items.length > 1000) {
    throw new Error('Compra pendiente no válida.');
  }
  const keys = new Set();
  const items = value.items.map(item => {
    if (!item || !validId(item.productId) || !validId(item.variantId) ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
      throw new Error('Producto pendiente no válido.');
    }
    const key = `${item.productId}:${item.variantId}`;
    if (keys.has(key)) throw new Error('Producto pendiente duplicado.');
    keys.add(key);
    return { productId: item.productId, variantId: item.variantId, quantity: item.quantity };
  });
  // Explicit fields only: no contact information, payment data or trusted client prices.
  return { id: value.id, createdAt: value.createdAt, status: 'pending', items };
}

export async function savePendingPurchase(value) {
  const record = validatePendingPurchase(value);
  await storageTransaction('pendingPurchases', 'readwrite', store => store.add(record));
  return record;
}

export async function listPendingPurchases() {
  const records = await storageTransaction('pendingPurchases', 'readonly', store => store.getAll());
  return records.filter(record => record.status === 'pending');
}

export const createPendingPurchase = items => savePendingPurchase({
  id: crypto.randomUUID(), createdAt: new Date().toISOString(), items
});

// A future API adapter must send idempotencyKey and validate a real server receipt.
// Nothing invokes this function from the storefront while no API is configured.
export async function retryPendingPurchases(sendPurchase) {
  if (typeof sendPurchase !== 'function') throw new Error('Se requiere un adaptador de API real.');
  if (!navigator.locks) throw new Error('El navegador no permite coordinar reintentos seguros.');
  return navigator.locks.request('urban-style-pending-purchases', async () => {
    const result = { confirmed: 0, retained: 0 };
    for (const saved of await listPendingPurchases()) {
      if (!navigator.onLine || Date.parse(saved.nextAttemptAt) > Date.now()) {
        result.retained++;
        continue;
      }
      const record = validatePendingPurchase(saved);
      const attempts = (Number.isSafeInteger(saved.attempts) ? saved.attempts : 0) + 1;
      const attempted = { ...record, attempts,
        nextAttemptAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(attempts - 1, 7))).toISOString() };
      // Persist backoff before dispatch, so a closed tab cannot immediately repeat it.
      await storageTransaction('pendingPurchases', 'readwrite', store => store.put(attempted));
      try {
        const signal = AbortSignal.timeout(15000);
        const receipt = await Promise.race([
          sendPurchase(record, { idempotencyKey: record.id, signal }),
          new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
        ]);
        if (receipt?.purchaseId !== record.id || typeof receipt.receiptId !== 'string' || !receipt.receiptId.trim()) {
          throw new Error('La API no confirmó la recepción de esta compra.');
        }
        await storageTransaction('pendingPurchases', 'readwrite', store => store.put({
          ...attempted, status: 'confirmed', receiptId: receipt.receiptId,
          confirmedAt: new Date().toISOString()
        }));
        result.confirmed++;
      } catch {
        // Keep the original ID and data after a timeout, failure or missing receipt.
        result.retained++;
      }
    }
    return result;
  });
}

export function connectPendingPurchaseRetries(sendPurchase, onError = error => console.warn(error)) {
  if (typeof sendPurchase !== 'function') throw new Error('Se requiere un adaptador de API real.');
  const retry = () => { retryPendingPurchases(sendPurchase).catch(onError); };
  window.addEventListener('online', retry);
  return () => window.removeEventListener('online', retry);
}
