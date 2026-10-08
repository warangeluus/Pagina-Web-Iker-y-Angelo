import { readCatalogCache, writeCatalogCache } from './storage.js';

export const money = (cents) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(cents / 100);
export const normalize = (value) => String(value).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();

export function validateCatalog(data) {
  if (!Array.isArray(data) || !data.length) throw new Error('El catálogo está vacío o no es válido.');
  const ids = new Set();
  for (const product of data) {
    if (!product || typeof product.id !== 'string' || !/^[a-z0-9-]+$/.test(product.id) || ids.has(product.id) ||
      !['name', 'description', 'category', 'alt'].every(key => typeof product[key] === 'string' && product[key].trim()) ||
      !Number.isSafeInteger(product.priceCents) || product.priceCents < 0 || product.priceCents > 10000000 ||
      !/^assets\/photos\/[a-z0-9_-]+\.jpg$/.test(product.image) || !Array.isArray(product.variants) || !product.variants.length) {
      throw new Error('Hay un producto con datos no válidos.');
    }
    ids.add(product.id);
    const variants = new Set();
    const combinations = new Set();
    for (const variant of product.variants) {
      const combination = JSON.stringify([variant?.size, variant?.color]);
      if (!variant || typeof variant.id !== 'string' || !/^[a-z0-9-]+$/.test(variant.id) || variants.has(variant.id) || combinations.has(combination) ||
        !['size', 'color'].every(key => typeof variant[key] === 'string' && variant[key].trim()) ||
        !Number.isSafeInteger(variant.stock) || variant.stock < 0 || variant.stock > 999) throw new Error('Variante no válida.');
      variants.add(variant.id);
      combinations.add(combination);
    }
  }
  return data;
}

export function filterCatalog(products, { search = '', category = '', sort = 'selection' } = {}) {
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  const result = products.filter(p => (!category || p.category === category) && terms.every(term => normalize(`${p.name} ${p.category} ${p.description}`).includes(term)));
  if (sort === 'price-asc') result.sort((a, b) => a.priceCents - b.priceCents);
  if (sort === 'price-desc') result.sort((a, b) => b.priceCents - a.priceCents);
  if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return result;
}

export async function loadCatalog() {
  let products;
  try {
    const response = await fetch(new URL('../data/products.json', import.meta.url), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Error de catálogo: ${response.status}`);
    products = validateCatalog(await response.json());
  } catch (error) {
    try { return validateCatalog(await readCatalogCache()); }
    catch { throw error; }
  }
  try { await writeCatalogCache(products); }
  catch { /* A cache failure must not discard a valid network response. */ }
  return products;
}
