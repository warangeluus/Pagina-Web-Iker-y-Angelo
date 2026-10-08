import assert from 'node:assert/strict';
import { createStoreServer } from '../scripts/serve.js';

export async function testPreferences(browser, baseURL, check) {
  const server = createStoreServer('/Pagina_web_Iker_Angelo/');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const base of [new URL(baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href,
      `http://127.0.0.1:${server.address().port}/Pagina_web_Iker_Angelo/`]) {
      const context = await browser.newContext({ reducedMotion: 'no-preference' });
      const errors = [];
      try {
        let page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base);
        await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 45000 });
        const control = page.getByRole('checkbox', { name: 'Desplazamiento suave' });
        const size = await control.boundingBox();
        assert.ok(size.width >= 24 && size.height >= 24, 'El checkbox debe medir al menos 24 × 24 px');
        assert.ok(await control.isChecked());
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'smooth');
        assert.equal((await context.cookies()).length, 0);
        await control.focus();
        await page.keyboard.press('Space');
        assert.equal(await control.isChecked(), false);
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
        const [cookie] = await context.cookies(base);
        assert.equal(cookie.name, 'urban-style.scroll.v1');
        assert.equal(cookie.value, 'instant');
        assert.equal(cookie.path, new URL(base).pathname);
        assert.equal(cookie.sameSite, 'Lax');
        assert.ok(cookie.expires > Date.now() / 1000 + 300 * 86400);
        const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
        assert.ok(!Object.keys(storage.local).some(key => key.includes('scroll')));
        assert.ok(!Object.keys(storage.session).some(key => key.includes('scroll')));
        await context.setOffline(true);
        await page.reload();
        await page.waitForSelector('#products article');
        assert.equal(await control.isChecked(), false);
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
        await page.close();
        page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}#catalogo`);
        await page.waitForSelector('#products article');
        const reopened = page.getByRole('checkbox', { name: 'Desplazamiento suave' });
        assert.equal(await reopened.isChecked(), false);
        await reopened.check();
        assert.equal((await context.cookies(base))[0].value, 'smooth');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
        await context.setOffline(false);
        await context.addCookies([{ ...cookie, value: 'invalid' }]);
        await page.reload();
        await page.waitForSelector('#products article');
        assert.ok(await reopened.isChecked());
        assert.deepEqual(errors, []);
        check(`Cookie de desplazamiento: teclado, persistencia offline, reapertura, movimiento reducido y valor inválido en ${new URL(base).pathname}`);
      } finally { await context.close(); }
    }
    const blocked = await browser.newContext({ reducedMotion: 'no-preference' });
    try {
      const page = await blocked.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => Object.defineProperty(document, 'cookie', {
        get() { throw new DOMException('blocked', 'SecurityError'); },
        set() { throw new DOMException('blocked', 'SecurityError'); }
      }));
      await page.goto(baseURL);
      await page.waitForSelector('#products article');
      await page.getByRole('checkbox', { name: 'Desplazamiento suave' }).uncheck();
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
      assert.deepEqual(errors, []);
      check('Preferencia usable en memoria con lectura y escritura de cookies bloqueadas');
    } finally { await blocked.close(); }
  } finally { await new Promise(resolve => server.close(resolve)); }
}
