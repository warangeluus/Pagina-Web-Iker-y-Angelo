import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { testPwa } from './pwa.mjs';
import { testInstallability } from './installability.mjs';
import { testPendingPurchases } from './pending-purchases.mjs';
import { testPreferences } from './preferences.mjs';
const require = createRequire(import.meta.url);
const baseURL = process.env.TEST_URL || 'http://127.0.0.1:8000';
const output = new URL('../test-results/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
const missingResources = [];
page.on('response', response => {
  if (response.status() === 404) missingResources.push(response.url());
});
page.on('pageerror', error => errors.push(error.message));
const report = { checks: [], accessibility: [], viewport: [] };
const check = name => { report.checks.push(name); console.log('OK:', name); };
async function assertPlaceholderContrast() {
  const colors = await page.locator('#search').evaluate(input => {
    const placeholder = getComputedStyle(input, '::placeholder');
    return { color: placeholder.color, opacity: placeholder.opacity, background: getComputedStyle(input).backgroundColor };
  });
  assert.equal(colors.color, 'rgb(87, 93, 83)');
  assert.equal(colors.opacity, '1');
  const luminance = color => color.match(/\d+/g).map(Number).map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const ratio = (luminance(colors.background) + 0.05) / (luminance(colors.color) + 0.05);
  assert.ok(ratio >= 4.5, `Contraste del placeholder: ${ratio.toFixed(2)}:1`);
}
async function assertCartSummary(count) {
  assert.equal(await page.locator('#cart-count').textContent(), String(count));
  assert.equal(await page.locator('#cart-item-count').textContent(), `${count} ${count === 1 ? 'prenda' : 'prendas'}`);
  assert.equal(await page.locator('#total').textContent(), await page.locator('#subtotal').textContent());
  assert.ok(await page.getByText('Total estimado (sin envío)', { exact: true }).isVisible());
}
async function audit(label) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const result = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
  report.accessibility.push({ label, violations: result.violations, incomplete: result.incomplete.map(r => ({ id: r.id, targets: r.nodes.map(n => n.target) })) });
  assert.deepEqual(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `Axe: ${label}`);
}
async function assertNoOverflow() {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
  assert.ok(dimensions.width <= dimensions.viewport, JSON.stringify(dimensions));
  return dimensions;
}
try {
  const stylesheetResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/assets/styles.css'));
  await page.goto(baseURL);
  const stylesheet = await stylesheetResponse;
  assert.equal(stylesheet.status(), 200);
  assert.match(stylesheet.headers()['content-type'], /text\/css/);
  assert.ok(await page.evaluate(() => {
    const link = document.querySelector('link[rel="stylesheet"]');
    return link.getAttribute('href') === 'assets/styles.css' && link.sheet?.cssRules.length > 0 &&
      getComputedStyle(document.querySelector('.btn-dark')).backgroundColor === 'rgb(23, 25, 22)';
  }));
  check('CSS servido y aplicado desde assets/styles.css');
  await page.waitForSelector('#products article');
  assert.equal(await page.locator('#products article').count(), 8);
  const semantics = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    const missingReferences = [...document.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls]')].flatMap(e => ['aria-labelledby', 'aria-describedby', 'aria-controls'].flatMap(attr => (e.getAttribute(attr) || '').split(/\s+/).filter(id => id && !document.getElementById(id))));
    const badPatterns = [...document.querySelectorAll('[pattern]')].filter(e => { try { new RegExp(e.pattern, 'v'); return false; } catch { return true; } }).map(e => e.id);
    return { duplicates: ids.filter((id, i) => ids.indexOf(id) !== i), missingReferences, badPatterns, h1: document.querySelectorAll('h1').length };
  });
  assert.deepEqual(semantics, { duplicates: [], missingReferences: [], badPatterns: [], h1: 1 });
  check('Identificadores únicos, referencias ARIA válidas, un h1 y patrones HTML compilables');
  await assertPlaceholderContrast();
  assert.equal(await page.getByRole('search', { name: 'Buscar y filtrar la colección', exact: true }).count(), 1);
  assert.equal(await page.getByRole('region', { name: 'Piezas esenciales', exact: true }).count(), 1);
  check('Placeholder opaco con contraste ≥ 4,5:1 y búsqueda con nombre accesible distinto del catálogo');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Saltar al contenido');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'contenido');
  check('Enlace de salto accesible por teclado');

  await page.locator('#search').fill('grafica');
  await page.waitForFunction(() => document.querySelectorAll('#products article').length === 1);
  assert.match(await page.locator('#products h3').textContent(), /gráfica/);
  await page.locator('#search').fill('zzznothing');
  await page.locator('#empty-results').waitFor({ state: 'visible' });
  await page.locator('#clear-filters').click();
  await page.waitForFunction(() => document.querySelectorAll('#products article').length === 8);
  await page.locator('#category').selectOption('Camisetas');
  assert.equal(await page.locator('#products article').count(), 2);
  await page.locator('#sort').selectOption('price-desc');
  assert.match(await page.locator('#products h3').first().textContent(), /gráfica/);
  await page.locator('#search').fill('grafica');
  await page.reload();
  await page.waitForSelector('#products article');
  assert.equal(await page.locator('#search').inputValue(), 'grafica');
  assert.equal(await page.locator('#category').inputValue(), 'Camisetas');
  assert.equal(await page.locator('#sort').inputValue(), 'price-desc');
  assert.equal(await page.locator('#products article').count(), 1);
  const separateTab = await context.newPage();
  await separateTab.goto(baseURL);
  await separateTab.waitForSelector('#products article');
  assert.equal(await separateTab.locator('#search').inputValue(), '');
  assert.equal(await separateTab.locator('#products article').count(), 8);
  await separateTab.close();
  await page.locator('#clear-filters').click();
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#products article').length === 8);
  assert.equal(await page.locator('#sort').inputValue(), 'selection');
  check('Filtros en sessionStorage: recarga, pestaña independiente y limpieza persistida');
  check('Búsqueda sin acentos, filtros, orden y resultados vacíos');

  const first = page.locator('#products article').first();
  await first.locator('select[id^="size-"]').selectOption('XL');
  assert.ok(await first.locator('button').isDisabled());
  await first.locator('select[id^="size-"]').selectOption('S');
  await first.locator('button').click();
  await first.locator('button').click();
  assert.equal(await page.locator('#cart-count').textContent(), '2');
  await page.locator('#open-cart').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'close-cart');
  await assertCartSummary(2);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'continue');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'close-cart');
  await page.getByRole('button', { name: /^Aumentar cantidad/ }).click();
  assert.match(await page.locator('#subtotal').textContent(), /59[.,]97/);
  await assertCartSummary(3);
  await page.getByRole('button', { name: /^Reducir cantidad/ }).click();
  assert.match(await page.locator('#subtotal').textContent(), /39[.,]98/);
  await assertCartSummary(2);
  await audit('Carrito con productos');
  await page.screenshot({ path: new URL('cart-desktop.png', output).pathname.replace(/^\/(\w:)/, '$1') });
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'open-cart');
  await page.reload();
  await page.waitForFunction(() => document.getElementById('cart-count').textContent === '2');
  await page.locator('#open-cart').click();
  await page.getByRole('button', { name: /^Eliminar:/ }).click();
  assert.ok(await page.locator('#cart-empty').isVisible());
  await assertCartSummary(0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'close-cart');
  await page.keyboard.press('Escape');
  check('Carrito: variantes, stock, cantidades, subtotal, eliminación, persistencia y teclado del modal');

  await page.locator('#contact-form button').click();
  assert.equal(await page.locator('#contact-form [aria-invalid="true"]').count(), 4);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'name');
  for (const id of ['name', 'email', 'subject', 'message']) {
    assert.ok((await page.locator(`#${id}`).getAttribute('aria-describedby')).split(' ').includes(`${id}-error`));
    assert.ok(await page.locator(`#${id}-error`).isVisible());
    assert.ok((await page.locator(`#${id}-error`).textContent()).length > 0);
  }
  await audit('Formulario con errores');
  await page.locator('#name').fill('María José');
  assert.equal(await page.locator('#name').getAttribute('aria-invalid'), 'false');
  assert.ok(await page.locator('#name-error').isHidden());
  await page.locator('#email').fill('maria@example.com');
  await page.locator('#phone').fill('-------');
  await page.locator('#subject').fill('Consulta de tallas');
  await page.locator('#message').fill('Quiero conocer las tallas disponibles.');
  await page.locator('#contact-form button').click();
  assert.equal(await page.locator('#phone').getAttribute('aria-invalid'), 'true');
  await page.locator('#phone').fill('+593 99 123 4567');
  await page.locator('#contact-form button').click();
  assert.equal(await page.locator('#contact-form [aria-invalid="true"]').count(), 0);
  assert.match(await page.locator('#form-status').textContent(), /No se ha enviado/);
  assert.equal(new URL(page.url()).search, '');
  check('Formulario: errores vinculados, foco y validación sin transmitir datos');

  for (const width of [320, 375, 390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(baseURL);
    await page.waitForSelector('#products article');
    // Scroll through lazy-loaded photos before checking them.
    for (const img of await page.locator('#products img').all()) await img.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
    await page.evaluate(() => window.scrollTo(0, 0));
    report.viewport.push(await assertNoOverflow());
    await assertPlaceholderContrast();
    if ([375, 1440].includes(width)) {
      await page.screenshot({ path: new URL(`page-${width}.png`, output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
    }
    if ([320, 375, 390, 768, 1440].includes(width)) await audit(`Página a ${width}px`);
    await page.locator('#open-cart').click();
    await assertNoOverflow();
    assert.ok(await page.evaluate(() => { const d = document.querySelector('dialog'); return d.scrollWidth <= d.clientWidth; }));
    await page.keyboard.press('Escape');
  }
  check('Siete anchos entre 320 y 1440 px, incluidos los tres breakpoints, sin desbordamiento; fotografías cargadas');
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
  await assertNoOverflow();
  await page.locator('#products article').first().locator('button').click();
  await page.locator('#open-cart').click();
  assert.ok(await page.evaluate(() => { const d = document.querySelector('dialog'); return d.scrollWidth <= d.clientWidth; }));
  await audit('Espaciado personalizado a 320px y carrito abierto');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
  check('Reflow a 320px, espaciado WCAG y movimiento reducido');

  await page.evaluate(() => localStorage.setItem('urban-style.cart.v1', '{broken'));
  await page.reload();
  await page.waitForSelector('#products article');
  assert.equal(await page.locator('#cart-count').textContent(), '0');
  await page.waitForFunction(() => document.getElementById('announcement').textContent.includes('No se pudo recuperar'));
  assert.equal(await page.locator('#announcement').evaluate(node => node.closest('main')?.id), 'contenido');
  const recoveredNotice = await page.locator('#announcement').boundingBox();
  assert.ok(recoveredNotice.y >= 0 && recoveredNotice.y + recoveredNotice.height <= 900);
  await page.route('**/data/products.json', route => route.fulfill({ status: 503, body: '{}' }));
  await page.reload();
  await page.waitForSelector('#products article');
  assert.equal(await page.locator('#products article').count(), 8);
  assert.ok(await page.locator('#catalog-error').isHidden());
  await page.unroute('**/data/products.json');
  await page.route('**/data/products.json', route => route.abort());
  await page.reload();
  await page.waitForSelector('#products article');
  assert.equal(await page.locator('#products article').count(), 8);
  check('IndexedDB recupera el catálogo ante HTTP 503 y fallo de red');
  await page.evaluate(async () => {
    const { writeCatalogCache } = await import('/js/storage.js');
    await writeCatalogCache([{ id: 'invalid' }]);
  });
  await page.reload();
  await page.locator('#catalog-error').waitFor({ state: 'visible' });
  check('La copia local también pasa por la validación del catálogo');
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('urban-style');
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  }));
  await page.reload();
  await page.locator('#catalog-error').waitFor({ state: 'visible' });
  await page.unroute('**/data/products.json');
  await page.locator('#retry').click();
  await page.waitForSelector('#products article');
  assert.equal(await page.locator('#products article').count(), 8);
  check('Recuperación ante carrito corrupto y fallo de carga del catálogo');

  const dateContext = await browser.newContext();
  let datePage = await dateContext.newPage();
  datePage.on('pageerror', error => errors.push(error.message));
  const dateKey = 'urban-style.cart.updatedAt.v1';
  const emptyDate = 'Todavía no hay modificaciones registradas.';
  async function assertCartDate(expected) {
    assert.equal(await datePage.evaluate(key => localStorage.getItem(key), dateKey), expected);
    assert.equal(await datePage.locator('#cart-updated-at time').getAttribute('datetime'), expected);
    const formatted = new Intl.DateTimeFormat('es-EC', {
      dateStyle: 'long', timeStyle: 'medium', timeZone: 'America/Guayaquil'
    }).format(new Date(expected));
    assert.equal(await datePage.locator('#cart-updated-at time').textContent(), formatted);
  }
  await datePage.goto(baseURL);
  await datePage.waitForSelector('#products article');
  await datePage.locator('#open-cart').click();
  assert.equal(await datePage.locator('#cart-updated-at').textContent(), emptyDate);
  assert.equal(await datePage.evaluate(key => localStorage.getItem(key), dateKey), null);
  await datePage.keyboard.press('Escape');
  const addedAt = '2026-10-06T15:00:00.000Z';
  await datePage.clock.setFixedTime(new Date(addedAt));
  await datePage.locator('#products article').first().locator('button').click();
  await assertCartDate(addedAt);
  await datePage.clock.setFixedTime(new Date('2026-10-06T15:01:00.000Z'));
  await datePage.locator('#open-cart').click();
  await assertCartDate(addedAt);
  // aria-disabled controls still dispatch clicks; rejected changes must keep the date.
  await datePage.getByRole('button', { name: /^Reducir cantidad/ }).evaluate(button => button.click());
  await assertCartDate(addedAt);
  const increasedAt = '2026-10-06T15:02:00.000Z';
  await datePage.clock.setFixedTime(new Date(increasedAt));
  await datePage.getByRole('button', { name: /^Aumentar cantidad/ }).click();
  await assertCartDate(increasedAt);
  const decreasedAt = '2026-10-06T15:03:00.000Z';
  await datePage.clock.setFixedTime(new Date(decreasedAt));
  await datePage.getByRole('button', { name: /^Reducir cantidad/ }).click();
  await assertCartDate(decreasedAt);
  await datePage.reload();
  await datePage.waitForSelector('#products article');
  await assertCartDate(decreasedAt);
  await datePage.close();
  datePage = await dateContext.newPage();
  datePage.on('pageerror', error => errors.push(error.message));
  await datePage.goto(baseURL);
  await datePage.waitForSelector('#products article');
  await datePage.locator('#open-cart').click();
  await assertCartDate(decreasedAt);
  const removedAt = '2026-10-06T15:04:00.000Z';
  await datePage.clock.setFixedTime(new Date(removedAt));
  await datePage.getByRole('button', { name: /^Eliminar:/ }).click();
  await assertCartDate(removedAt);
  assert.ok(await datePage.locator('#cart-empty').isVisible());
  await datePage.reload();
  await datePage.waitForSelector('#products article');
  await assertCartDate(removedAt);
  for (const invalid of ['not-a-date', '2026-02-30T12:00:00.000Z']) {
    await datePage.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: dateKey, value: invalid });
    await datePage.reload();
    await datePage.waitForSelector('#products article');
    assert.equal(await datePage.locator('#cart-updated-at').textContent(), emptyDate);
    assert.equal(await datePage.evaluate(key => localStorage.getItem(key), dateKey), invalid);
  }
  await dateContext.close();
  check('Fecha ISO del carrito: altas, cantidades, eliminación, formato es-EC, recarga, reapertura y fechas inválidas');

  const privateContext = await browser.newContext({ viewport: { width: 320, height: 900 } });
  const privatePage = await privateContext.newPage();
  await privatePage.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError'); };
    Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };
    IDBFactory.prototype.open = () => { throw new DOMException('blocked', 'SecurityError'); };
  });
  await privatePage.goto(baseURL);
  await privatePage.locator('#search').fill('grafica');
  await privatePage.waitForFunction(() => document.querySelectorAll('#products article').length === 1);
  await privatePage.locator('#products article').first().locator('button').click();
  assert.equal(await privatePage.locator('#cart-count').textContent(), '1');
  await privatePage.waitForFunction(() => document.getElementById('announcement').textContent.includes('no se puede guardar'));
  const notice = privatePage.locator('#announcement');
  assert.equal(await notice.getAttribute('role'), 'status');
  assert.equal(await notice.getAttribute('aria-live'), 'polite');
  assert.equal(await notice.evaluate(node => node.closest('main')?.id), 'contenido');
  const bounds = await notice.boundingBox();
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 900, 'El aviso debe verse sin volver al footer');
  await privatePage.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const noticeAudit = await privatePage.evaluate(() => window.axe.run(document));
  report.accessibility.push({ label: 'Aviso visible con almacenamiento bloqueado a 320px', violations: noticeAudit.violations,
    incomplete: noticeAudit.incomplete.map(result => ({ id: result.id, targets: result.nodes.map(node => node.target) })) });
  assert.deepEqual(noticeAudit.violations.map(violation => violation.id), []);
  check('Avisos de carrito corrupto y almacenamiento bloqueado visibles dentro de main, sin cancelar mensajes ni mover el foco');
  await privatePage.locator('#open-cart').click();
  assert.ok(await privatePage.locator('#storage-note').isVisible());
  assert.ok(await privatePage.locator('#cart-updated-at time').isVisible());
  await privateContext.close();
  check('Carrito, filtros y catálogo de red usables con los tres almacenamientos bloqueados');
  const noJsContext = await browser.newContext({ javaScriptEnabled: false });
  try {
    const noJsPage = await noJsContext.newPage();
    await noJsPage.goto(baseURL);
    assert.ok(await noJsPage.locator('#contacto noscript').isVisible());
    assert.match(await noJsPage.locator('#contacto noscript').textContent(), /JavaScript.*deshabilitado/);
    assert.ok(await noJsPage.locator('footer noscript').isVisible());
    assert.match(await noJsPage.locator('footer noscript').textContent(), /JavaScript.*preferencia/);
    assert.ok(await noJsPage.locator('#contact-form button').isDisabled());
    assert.ok(await noJsPage.locator('#smooth-scroll').isDisabled());
    check('Sin JavaScript: contacto y preferencia deshabilitados con explicaciones visibles en su sección');
  } finally { await noJsContext.close(); }
  assert.deepEqual(errors, []);
  assert.deepEqual(missingResources, [], 'No debe haber recursos con respuesta 404');
  check('Sin recursos con respuesta 404');
  check('Sin errores JavaScript no controlados');
  await testPwa(browser, baseURL, check);
  await testInstallability(baseURL, check);
  await testPendingPurchases(browser, baseURL, check);
  await testPreferences(browser, baseURL, check);
} finally {
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
  await browser.close();
}
