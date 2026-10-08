import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
test('Manifiesto instalable con rutas relativas en raíz y subdirectorio', () => {
  assert.equal(manifest.name, 'Urban Style');
  assert.equal(manifest.short_name, 'Urban Style');
  assert.equal(manifest.lang, 'es-EC');
  assert.equal(manifest.display, 'standalone');
  for (const color of [manifest.theme_color, manifest.background_color]) assert.match(color, /^#[0-9a-f]{6}$/i);
  for (const base of ['https://example.test/', 'https://example.test/Pagina_web_Iker_Angelo/']) {
    const url = new URL('manifest.webmanifest', base);
    assert.equal(new URL(manifest.scope, url).href, base);
    assert.equal(new URL(manifest.start_url, url).href, `${base}index.html`);
    for (const icon of manifest.icons) assert.ok(new URL(icon.src, url).href.startsWith(base));
  }
});
test('Iconos PNG reales de 192 y 512 píxeles', () => {
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
  for (const icon of manifest.icons) {
    const png = readFileSync(new URL(`../${icon.src}`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const size = Number(icon.sizes.split('x')[0]);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.equal(icon.type, 'image/png');
  }
});
