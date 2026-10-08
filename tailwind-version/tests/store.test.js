import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Cart } from '../js/cart.js';
import { filterCatalog, validateCatalog } from '../js/catalog.js';
import { validateContact } from '../js/validation.js';
import { validatePendingPurchase } from '../js/pending-purchases.js';

const products = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'));
const p = products[0];
const v = p.variants[0];

test('Total monetario usa centavos y sigue las modificaciones del carrito', () => {
  const cart = new Cart(products);
  assert.equal(cart.total, 0);
  cart.add(p.id, v.id);
  assert.equal(cart.total, p.priceCents);
  cart.setQuantity(p.id, v.id, 2);
  assert.equal(cart.total, p.priceCents * 2);
  cart.setQuantity(p.id, v.id, 0);
  assert.equal(cart.total, 0);
});

test('Estructura pendiente valida entradas y excluye datos personales y precios', () => {
  const value = { id: 'test-purchase', createdAt: '2026-10-06T15:00:00.000Z', email: 'private@example.com',
    items: [{ productId: p.id, variantId: v.id, quantity: 1, priceCents: 1 }] };
  const valid = validatePendingPurchase(value);
  assert.deepEqual(valid, { id: value.id, createdAt: value.createdAt, status: 'pending',
    items: [{ productId: p.id, variantId: v.id, quantity: 1 }] });
  for (const invalid of [null, { ...value, items: [] }, { ...value, createdAt: 'invalid' },
    { ...value, items: [value.items[0], value.items[0]] },
    { ...value, items: [{ ...value.items[0], quantity: -1 }] }]) {
    assert.throws(() => validatePendingPurchase(invalid));
  }
});

test('Catálogo completo, identificadores únicos e imágenes locales', () => {
  assert.equal(validateCatalog(products).length, 8);
  for (const product of products) assert.ok(existsSync(new URL('../' + product.image, import.meta.url)));
  assert.throws(() => validateCatalog([p, p]));
  assert.throws(() => validateCatalog([{ ...p, id: undefined }]));
  assert.throws(() => validateCatalog([{ ...p, priceCents: NaN }]));
  assert.throws(() => validateCatalog([{ ...p, variants: [v, v] }]));
});
test('Sumas exactas en centavos, cantidades y eliminación', () => {
  const cart = new Cart(products);
  cart.add(p.id, v.id);
  cart.add(p.id, v.id);
  assert.equal(cart.count, 2);
  assert.equal(cart.subtotal, 3998);
  cart.setQuantity(p.id, v.id, 1);
  assert.equal(cart.subtotal, 1999);
  cart.setQuantity(p.id, v.id, 0);
  assert.equal(cart.count, 0);
});
test('Las tallas del mismo producto se guardan por separado', () => {
  const cart = new Cart(products);
  cart.add(p.id, v.id);
  cart.add(p.id, p.variants[1].id);
  assert.equal(cart.items.length, 2);
});
test('No permite cantidades negativas, fraccionarias, desconocidas o superiores a existencias', () => {
  const cart = new Cart(products);
  for (const q of [-1, NaN, Infinity, 0.5, v.stock + 1]) assert.throws(() => cart.setQuantity(p.id, v.id, q));
  assert.throws(() => cart.add('unknown', 'unknown'));
  assert.throws(() => cart.add(p.id, p.variants.at(-1).id));
  cart.setQuantity(p.id, v.id, v.stock);
  assert.throws(() => cart.add(p.id, v.id));
  assert.equal(cart.count, v.stock);
});
test('Recuperar datos corruptos o manipulados no altera precios ni excede existencias', () => {
  const restored = new Cart(products, [null, {}, { productId: 'unknown', variantId: v.id, quantity: 1 },
    { productId: p.id, variantId: v.id, quantity: 99, priceCents: 1 },
    { productId: p.id, variantId: v.id, quantity: 2 },
    { productId: p.id, variantId: p.variants[1].id, quantity: -1 }]);
  assert.equal(restored.count, v.stock);
  assert.equal(restored.subtotal, p.priceCents * v.stock);
  assert.equal(new Cart(products, {}).count, 0);
  assert.equal(new Cart(products, restored.serialize()).subtotal, restored.subtotal);
});
test('La búsqueda ignora acentos y combina categoría con ordenación', () => {
  assert.equal(filterCatalog(products, { search: 'grafica' })[0].id, 'camiseta-grafica');
  const selected = filterCatalog(products, { category: 'Camisetas', sort: 'price-desc' });
  assert.equal(selected.length, 2);
  assert.ok(selected[0].priceCents >= selected[1].priceCents);
  assert.equal(filterCatalog(products, { search: 'no-existe' }).length, 0);
});
const valid = { name: 'María José', email: 'maria@example.com', phone: '+593 99 123 4567', subject: 'Consulta de tallas', message: 'Quiero consultar las tallas disponibles.' };
test('Formulario acepta nombres con acentos y teléfono opcional', () => {
  assert.deepEqual(validateContact(valid), {});
  assert.deepEqual(validateContact({ ...valid, phone: '' }), {});
  assert.deepEqual(validateContact({ ...valid, name: "O’Connor" }), {});
});
test('Formulario rechaza guiones sin letras/dígitos, blancos y longitudes inválidas', () => {
  assert.ok(validateContact({ ...valid, name: '---' }).name);
  assert.ok(validateContact({ ...valid, phone: '-------' }).phone);
  assert.ok(validateContact({ ...valid, phone: '1234567890123456' }).phone);
  assert.ok(validateContact({ ...valid, email: 'no@' }).email);
  assert.ok(validateContact({ ...valid, subject: '   ' }).subject);
  assert.ok(validateContact({ ...valid, message: '   '.repeat(10) }).message);
  assert.ok(validateContact({ ...valid, message: 'x'.repeat(1001) }).message);
  assert.ok(validateContact({}).name);
});

test('Regex de texto libre respeta límites y admite mensajes multilínea', () => {
  for (const [field, min, max] of [['subject', 3, 100], ['message', 10, 1000]]) {
    assert.ok(validateContact({ ...valid, [field]: 'x'.repeat(min - 1) })[field]);
    assert.equal(validateContact({ ...valid, [field]: 'x'.repeat(min) })[field], undefined);
    assert.equal(validateContact({ ...valid, [field]: 'x'.repeat(max) })[field], undefined);
    assert.ok(validateContact({ ...valid, [field]: 'x'.repeat(max + 1) })[field]);
  }
  assert.deepEqual(validateContact({ ...valid, message: 'Consulta de tallas.\n¿Tienen talla M?' }), {});
});
