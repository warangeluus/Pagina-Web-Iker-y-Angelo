import assert from 'node:assert/strict';

export async function testPwa(browser, baseURL, check) {
  const context = await browser.newContext();
  let page = await context.newPage();
  const errors = [];
  const observe = target => target.on('pageerror', error => errors.push(error.message));
  observe(page);
  try {
    await page.goto(baseURL);
    await page.waitForSelector('#products article');
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', null, { timeout: 45000 });
    await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated');
    const state = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const prefix = `urban-style-shell:${registration.scope}:`;
      const names = (await caches.keys()).filter(name => name.startsWith(prefix));
      const cache = await caches.open(names[0]);
      return { names, prefix, scope: registration.scope, urls: (await cache.keys()).map(request => request.url) };
    });
    assert.equal(state.names.length, 1);
    const expected = ['index.html', 'assets/styles.css', 'js/app.js', 'js/catalog.js',
      'js/cart.js', 'js/storage.js', 'js/validation.js', 'js/connectivity.js', 'js/pending-purchases.js', 'js/preferences.js'];
    for (const resource of expected) assert.ok(state.urls.includes(new URL(resource, state.scope).href));
    assert.equal(state.urls.filter(url => url.endsWith('.jpg')).length, 8);
    assert.ok(!state.urls.some(url => url.endsWith('products.json')));
    check('Service Worker activo y recursos esenciales en Cache API; catálogo excluido');

    await page.locator('#products article').first().locator('button').click();
    let date = await page.evaluate(() => localStorage.getItem('urban-style.cart.updatedAt.v1'));
    assert.match(await page.locator('#connection-status').textContent(), /^Con conexión/);
    await context.setOffline(true);
    await page.waitForFunction(() => document.getElementById('connection-status').textContent.startsWith('Sin conexión'));
    assert.equal(await page.locator('#connection-status').getAttribute('role'), 'status');
    await page.reload();
    await page.waitForSelector('#products article');
    assert.equal(await page.locator('#products article').count(), 8);
    assert.equal(await page.locator('#cart-count').textContent(), '1');
    assert.equal(await page.locator('#cart-updated-at time').getAttribute('datetime'), date);
    const fragments = await page.evaluate(() => [...new Set(
      [...document.querySelectorAll('a[href^="#"]')].map(link => link.getAttribute('href'))
    )]);
    assert.ok(fragments.includes('#catalogo'));
    for (const fragment of fragments) {
      await page.evaluate(hash => { location.hash = hash; }, fragment);
      await page.reload();
      await page.waitForSelector('#products article');
      assert.equal(new URL(page.url()).hash, fragment);
      assert.equal(await page.locator('#cart-count').textContent(), '1');
      assert.equal(await page.locator('#cart-updated-at time').getAttribute('datetime'), date);
    }
    check('Recarga offline desde raíz y todos los fragmentos internos conserva carrito y fecha');
    for (const img of await page.locator('#products img').all()) await img.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.btn-dark')).backgroundColor), 'rgb(23, 25, 22)');
    await page.locator('#products article').first().locator('button').click();
    await page.locator('#open-cart').click();
    await page.getByRole('button', { name: /^Aumentar cantidad/ }).click();
    assert.match(await page.locator('#subtotal').textContent(), /59[.,]97/);
    assert.equal(await page.locator('#subtotal').textContent(), await page.locator('#total').textContent());
    await page.getByRole('button', { name: /^Reducir cantidad/ }).click();
    assert.match(await page.locator('#total').textContent(), /39[.,]98/);
    await page.getByRole('button', { name: /^Eliminar:/ }).click();
    assert.match(await page.locator('#total').textContent(), /0[.,]00/);
    assert.ok(await page.locator('#cart-empty').isVisible());
    await page.keyboard.press('Escape');
    await page.locator('#products article').first().locator('button').click();
    const updatedDate = await page.evaluate(() => localStorage.getItem('urban-style.cart.updatedAt.v1'));
    assert.notEqual(updatedDate, date);
    date = updatedDate;
    await page.locator('#category').selectOption('Camisetas');
    await page.locator('#sort').selectOption('price-desc');
    assert.match(await page.locator('#products h3').first().textContent(), /gráfica/);
    await page.locator('#search').fill('grafica');
    await page.waitForFunction(() => document.querySelectorAll('#products article').length === 1);
    await page.reload();
    await page.waitForSelector('#products article');
    assert.equal(await page.locator('#search').inputValue(), 'grafica');
    assert.equal(await page.locator('#category').inputValue(), 'Camisetas');
    assert.equal(await page.locator('#sort').inputValue(), 'price-desc');
    await page.locator('#contact-form button').click();
    assert.equal(await page.locator('#contact-form [aria-invalid="true"]').count(), 4);
    await page.locator('#name').fill('María José');
    await page.locator('#email').fill('maria@example.com');
    await page.locator('#subject').fill('Consulta de tallas');
    await page.locator('#message').fill('Quiero conocer las tallas disponibles.');
    await page.locator('#contact-form button').click();
    assert.equal(await page.locator('#contact-form [aria-invalid="true"]').count(), 0);
    assert.match(await page.locator('#form-status').textContent(), /No se ha enviado/);
    const snapshot = await page.evaluate(() => ({ ...localStorage }));
    await context.setOffline(false);
    await page.waitForFunction(() => document.getElementById('connection-status').textContent.startsWith('Con conexión'));
    assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), snapshot);
    assert.deepEqual(await page.evaluate(async () => (await import('./js/pending-purchases.js')).listPendingPurchases()), []);
    await context.setOffline(true);
    await page.waitForFunction(() => document.getElementById('connection-status').textContent.startsWith('Sin conexión'));
    assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), snapshot);
    check('Offline: cantidades, eliminación, subtotal/total, orden, formulario y conexión sin compras ni cambios de carrito');
    await page.close();
    page = await context.newPage();
    observe(page);
    await page.goto(new URL('index.html', state.scope).href);
    await page.waitForSelector('#products article');
    assert.equal(await page.locator('#products article').count(), 8);
    assert.equal(await page.locator('#cart-count').textContent(), '1');
    assert.equal(await page.locator('#cart-updated-at time').getAttribute('datetime'), date);
    check('Recarga y reapertura sin red: HTML, CSS, JS, imágenes, filtros, carrito y fecha');

    // Removing only IndexedDB proves Cache API does not hide a missing catalog.
    await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('urban-style');
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    }));
    await page.reload();
    await page.locator('#catalog-error').waitFor({ state: 'visible' });
    await context.setOffline(false);
    await page.locator('#retry').click();
    await page.waitForSelector('#products article');
    check('Sin red el catálogo depende de IndexedDB; reintento recupera Fetch al volver la conexión');

    // Reinstall with an obsolete own cache and an unrelated one already present.
    await page.evaluate(async ({ prefix }) => {
      await caches.open(`${prefix}v0`);
      await caches.open('another-app-cache');
      const registration = await navigator.serviceWorker.ready;
      await registration.unregister();
    }, state);
    await page.close();
    page = await context.newPage();
    observe(page);
    await page.goto(baseURL);
    await page.waitForSelector('#products article');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated');
    const names = await page.evaluate(() => caches.keys());
    assert.ok(!names.includes(`${state.prefix}v0`));
    assert.ok(names.includes('another-app-cache'));
    assert.ok(names.includes(state.names[0]));
    assert.equal(await page.locator('#cart-count').textContent(), '1');
    assert.equal(await page.locator('#cart-updated-at time').getAttribute('datetime'), date);
    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector('#products article');
    assert.equal(await page.locator('#products article').count(), 8);
    assert.deepEqual(errors, []);
    check('Activación elimina solo cachés propias antiguas y conserva IndexedDB, carrito y fecha');
    const migrationContext = await browser.newContext({ serviceWorkers: 'block' });
    try {
      const migrationPage = await migrationContext.newPage();
      const response = await migrationPage.goto(new URL('data/products.json', state.scope).href);
      const original = await response.json();
      await migrationPage.evaluate(products => new Promise((resolve, reject) => {
        const request = indexedDB.open('urban-style', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('catalog');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('catalog', 'readwrite');
          tx.objectStore('catalog').put(products, 'products');
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onabort = () => { db.close(); reject(tx.error); };
        };
      }), original);
      const migrated = await migrationPage.evaluate(async scope => {
        const storage = await import(new URL('js/storage.js', scope).href);
        const pending = await import(new URL('js/pending-purchases.js', scope).href);
        return { products: await storage.readCatalogCache(), purchases: await pending.listPendingPurchases() };
      }, state.scope);
      assert.deepEqual(migrated.products, original);
      assert.deepEqual(migrated.purchases, []);
      check('Migración IndexedDB v1 a v2 conserva el catálogo y crea compras pendientes vacías');
    } finally { await migrationContext.close(); }
  } finally { await context.close(); }
}
