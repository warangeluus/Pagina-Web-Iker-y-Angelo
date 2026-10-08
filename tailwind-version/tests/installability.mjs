import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createStoreServer } from '../scripts/serve.js';

export async function testInstallability(baseURL, check) {
  const profilesRoot = fileURLToPath(new URL('../test-results/', import.meta.url));
  await mkdir(profilesRoot, { recursive: true });
  const server = createStoreServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = new URL(baseURL.endsWith('/') ? baseURL : baseURL + '/').href;
    const profile = await mkdtemp(path.join(profilesRoot, 'install-profile-'));
    const context = await chromium.launchPersistentContext(profile, {
      channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true
    });
    try {
      const page = await context.newPage();
      const failures = [];
      page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
      await page.goto(base);
      await page.waitForSelector('#products article');
      await page.waitForFunction(async scope => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active?.state === 'activated' && registration.scope === scope;
      }, new URL(base).href, { timeout: 45000 });
      const cdp = await context.newCDPSession(page);
      const manifest = await cdp.send('Page.getAppManifest');
      assert.equal(manifest.url, new URL('manifest.webmanifest', base).href);
      assert.deepEqual(manifest.errors.filter(error => error.critical), []);
      const parsed = JSON.parse(manifest.data);
      assert.equal(new URL(parsed.scope, manifest.url).href, base);
      const start = new URL(parsed.start_url, manifest.url).href;
      assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope), base);
      for (const icon of parsed.icons) {
        const size = await page.evaluate(async src => {
          const img = new Image();
          img.src = src;
          await img.decode();
          return `${img.naturalWidth}x${img.naturalHeight}`;
        }, new URL(icon.src, manifest.url).href);
        assert.equal(size, icon.sizes);
      }
      const installability = await cdp.send('Page.getInstallabilityErrors');
      assert.deepEqual(installability.installabilityErrors, []);
      assert.deepEqual(failures, []);
      await context.setOffline(true);
      await page.goto(start);
      await page.waitForSelector('#products article');
      assert.equal(await page.locator('#products article').count(), 8);
      assert.equal(await page.evaluate(async () => (await fetch('manifest.webmanifest')).ok), true);
      await page.goto(`${base}#catalogo`);
      await page.reload();
      await page.waitForSelector('#products article');
      assert.equal(new URL(page.url()).hash, '#catalogo');
      assert.equal(await page.locator('#products article').count(), 8);
      check(`Chrome sin errores de instalabilidad y arranque offline: ${new URL(base).pathname}`);
    } finally {
      await context.close();
      if (path.dirname(path.resolve(profile)) !== path.resolve(profilesRoot)) throw new Error('Unexpected profile path');
      await rm(profile, { recursive: true, force: true });
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}
