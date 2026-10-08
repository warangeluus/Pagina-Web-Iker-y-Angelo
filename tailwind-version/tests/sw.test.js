import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
function worker(fetch, cached) {
  const handlers = {};
  const writes = [];
  const cache = { match: async () => cached, put: async (...entry) => writes.push(entry) };
  runInNewContext(source, {
    self: {
      registration: { scope: 'https://example.test/shop/' },
      location: { origin: 'https://example.test' },
      addEventListener: (name, handler) => { handlers[name] = handler; }
    },
    caches: { open: async () => cache, match: async () => cached },
    URL, Request, Response, AbortSignal, fetch
  });
  return { handlers, writes };
}
function dispatch(handlers, path, mode = 'cors', method = 'GET') {
  let result;
  handlers.fetch({
    request: { url: `https://example.test/shop/${path}`, mode, method, headers: new Headers() },
    respondWith: promise => { result = promise; }
  });
  return result;
}

test('SW no intercepta catálogo, consultas, POST ni recursos fuera de la lista pública', () => {
  const { handlers } = worker(() => { throw new Error('No debe llamar a fetch'); });
  for (const path of ['data/products.json', 'index.html?email=private', 'private.json']) {
    assert.equal(dispatch(handlers, path), undefined);
  }
  assert.equal(dispatch(handlers, 'index.html', 'navigate', 'POST'), undefined);
});

test('SW Cache First devuelve el recurso guardado sin usar la red', async () => {
  const cached = new Response('cached css');
  const { handlers, writes } = worker(() => { throw new Error('No debe llamar a fetch'); }, cached);
  assert.equal(await dispatch(handlers, 'assets/styles.css'), cached);
  assert.equal(writes.length, 0);
});

test('SW recupera la navegación offline en raíz e index.html con fragmentos internos', async () => {
  for (const path of ['', '#catalogo', '#contenido', '#inicio', '#nosotros', '#contacto', 'index.html#catalogo']) {
    const cached = new Response('cached html');
    const { handlers, writes } = worker(async () => { throw new Error('offline'); }, cached);
    const request = new Request(`https://example.test/shop/${path}`);
    Object.defineProperty(request, 'mode', { value: 'navigate' });
    let result;
    handlers.fetch({ request, respondWith: promise => { result = promise; } });
    assert.ok(result, `La navegación ${path} debe ser interceptada`);
    assert.equal(await result, cached);
    assert.equal(writes.length, 0);
  }
});

test('SW instalación rechaza respuestas HTTP fallidas sin guardarlas', async () => {
  const { handlers, writes } = worker(async () => new Response('unavailable', { status: 503 }));
  let installed;
  handlers.install({ waitUntil: promise => { installed = promise; } });
  await assert.rejects(installed, /No se pudo almacenar/);
  assert.equal(writes.length, 0);
});

test('SW navegación recupera HTML local ante error HTTP o de red y no lo sobrescribe', async () => {
  for (const fetch of [async () => new Response('unavailable', { status: 503 }), async () => { throw new Error('offline'); }]) {
    const cached = new Response('cached html');
    const { handlers, writes } = worker(fetch, cached);
    // A real Request is needed when the network strategy copies it.
    let result;
    const request = new Request('https://example.test/shop/index.html');
    Object.defineProperty(request, 'mode', { value: 'navigate' });
    handlers.fetch({ request, respondWith: promise => { result = promise; } });
    assert.equal(await result, cached);
    assert.equal(writes.length, 0);
  }
});
