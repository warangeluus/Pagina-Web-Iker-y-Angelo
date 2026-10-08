const filtersKey = 'urban-style.filters.v1';

export function loadFilters() {
  try {
    const value = JSON.parse(sessionStorage.getItem(filtersKey));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export function saveFilters(filters) {
  try { sessionStorage.setItem(filtersKey, JSON.stringify(filters)); }
  catch { /* Filters remain usable when session storage is unavailable. */ }
}

// Resolve writes only after commit; close connections so upgrades are not blocked.
export function storageTransaction(storeName, mode, operation) {
  return new Promise((resolve, reject) => {
    let database;
    let transaction;
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      database?.close();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => {
      finish(new Error('El almacenamiento del catálogo no responde.'));
      transaction?.abort();
    }, 3000);
    try {
      const request = indexedDB.open('urban-style', 2);
      request.onupgradeneeded = () => {
        if (settled) { request.transaction.abort(); return; }
        if (!request.result.objectStoreNames.contains('catalog')) request.result.createObjectStore('catalog');
        if (!request.result.objectStoreNames.contains('pendingPurchases')) {
          request.result.createObjectStore('pendingPurchases', { keyPath: 'id' });
        }
      };
      request.onerror = () => finish(request.error);
      request.onblocked = () => finish(new Error('El almacenamiento del catálogo está bloqueado.'));
      request.onsuccess = () => {
        database = request.result;
        if (settled) { database.close(); return; }
        database.onversionchange = () => database.close();
        try {
          transaction = database.transaction(storeName, mode);
          const result = operation(transaction.objectStore(storeName));
          transaction.oncomplete = () => finish(null, result.result);
          transaction.onabort = () => finish(transaction.error || new Error('Transacción del catálogo cancelada.'));
          transaction.onerror = () => finish(transaction.error || new Error('Error de almacenamiento del catálogo.'));
        } catch (error) { finish(error); }
      };
    } catch (error) { finish(error); }
  });
}

export const readCatalogCache = () => storageTransaction('catalog', 'readonly', store => store.get('products'));
export const writeCatalogCache = products => storageTransaction('catalog', 'readwrite', store => store.put(products, 'products'));
