import { loadCatalog, filterCatalog, money } from './catalog.js';
import { Cart } from './cart.js';
import { validateContact } from './validation.js';
import { loadFilters, saveFilters } from './storage.js';
import { initConnectivity } from './connectivity.js';
import { initScrollPreference } from './preferences.js';

const $ = id => document.getElementById(id);
const storageKey = 'urban-style.cart.v1';
const updatedAtKey = 'urban-style.cart.updatedAt.v1';
const cartDateFormat = new Intl.DateTimeFormat('es-EC', {
  dateStyle: 'long', timeStyle: 'medium', timeZone: 'America/Guayaquil'
});
let cartUpdatedAt = loadCartUpdatedAt();
let products = [];
let cart = new Cart([]);
let opener;
const announcementTimers = new WeakMap();
const dialog = $('cart-dialog');

// Text from the catalog or storage never goes through innerHTML.
function el(tag, className = '', text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function announce(message, target = $('announcement')) {
  // Each live region retains its message; product feedback must not cancel warnings.
  clearTimeout(announcementTimers.get(target));
  target.textContent = '';
  announcementTimers.set(target, setTimeout(() => { target.textContent = message; }, 50));
}
function loadCartUpdatedAt() {
  try {
    const saved = localStorage.getItem(updatedAtKey);
    const date = new Date(saved);
    return saved && Number.isFinite(date.getTime()) && date.toISOString() === saved ? saved : null;
  } catch { return null; }
}
function renderCartUpdatedAt() {
  const target = $('cart-updated-at');
  if (!cartUpdatedAt) {
    target.textContent = 'Todavía no hay modificaciones registradas.';
    return;
  }
  const time = el('time', '', cartDateFormat.format(new Date(cartUpdatedAt)));
  time.dateTime = cartUpdatedAt;
  target.replaceChildren('Última actualización: ', time, ' (hora de Ecuador continental).');
}
function saveCart() {
  // Called only after a successful user mutation, never on load or opening the dialog.
  cartUpdatedAt = new Date().toISOString();
  renderCartUpdatedAt();
  try {
    localStorage.setItem(storageKey, JSON.stringify(cart.serialize()));
    localStorage.setItem(updatedAtKey, cartUpdatedAt);
    $('storage-note').hidden = true;
  } catch {
    $('storage-note').hidden = false;
    announce('Tu carrito funciona, pero no se puede guardar en este navegador.');
  }
}
function updateTotals() {
  $('cart-count').textContent = cart.count;
  $('cart-item-count').textContent = `${cart.count} ${cart.count === 1 ? 'prenda' : 'prendas'}`;
  $('subtotal').textContent = money(cart.subtotal);
  $('total').textContent = money(cart.total);
  $('cart-empty').hidden = cart.count > 0;
  renderCartUpdatedAt();
}

function makeProduct(product) {
  const li = el('li', 'min-w-0');
  const article = el('article', 'flex h-full min-w-0 flex-col');
  const image = el('img', 'product-photo');
  Object.assign(image, { src: product.image, alt: product.alt, width: 800, height: 1000, loading: 'lazy', decoding: 'async' });
  image.addEventListener('error', () => {
    image.hidden = true;
    article.prepend(el('p', 'border border-ink/30 p-6', 'Fotografía no disponible.'));
  }, { once: true });
  const title = el('h3', 'mt-1 text-lg leading-snug', product.name);
  title.id = `title-${product.id}`;
  article.setAttribute('aria-labelledby', title.id);
  article.append(image, el('p', 'eyebrow mt-4 text-forest', product.category), title,
    el('p', 'mt-2 text-sm text-muted', product.description),
    el('p', 'mb-4 mt-3 text-xl font-bold', money(product.priceCents)));

  const form = el('form', 'mt-auto');
  form.setAttribute('aria-label', `Elegir opciones de ${product.name}`);
  const fields = el('div', 'grid grid-cols-2 gap-3');
  function selectField(kind, labelText) {
    const wrapper = el('div', 'min-w-0');
    const label = el('label', '', labelText);
    const select = el('select');
    select.id = `${kind}-${product.id}`;
    label.htmlFor = select.id;
    select.setAttribute('aria-label', `${labelText} de ${product.name}`);
    wrapper.append(label, select);
    fields.append(wrapper);
    return select;
  }
  const color = selectField('color', 'Color');
  const size = selectField('size', 'Talla');
  for (const value of new Set(product.variants.map(v => v.color))) color.add(new Option(value, value));
  const stock = el('p', 'my-3 text-sm text-muted');
  stock.id = `stock-${product.id}`;
  size.setAttribute('aria-describedby', stock.id);
  const button = el('button', 'btn btn-dark w-full', 'Añadir al carrito');
  button.type = 'submit';
  button.setAttribute('aria-label', `Añadir al carrito: ${product.name}`);
  const feedback = el('p', 'mt-3 text-sm text-forest');
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-atomic', 'true');
  const selected = () => product.variants.find(v => v.color === color.value && v.size === size.value);
  function updateStock() {
    const variant = selected();
    stock.textContent = variant?.stock ? `Disponible · ${variant.stock} unidades de referencia` : 'Agotado en esta talla y color';
    button.disabled = !variant?.stock;
    button.textContent = variant?.stock ? 'Añadir al carrito' : 'Agotado';
    feedback.textContent = '';
  }
  function updateSizes() {
    const previous = size.value;
    const variants = product.variants.filter(v => v.color === color.value);
    size.replaceChildren(...variants.map(v => new Option(`${v.size}${v.stock ? '' : ' — agotada'}`, v.size)));
    const preferred = variants.find(v => v.size === previous && v.stock) ?? variants.find(v => v.stock) ?? variants[0];
    size.value = preferred.size;
    updateStock();
  }
  color.addEventListener('change', updateSizes);
  size.addEventListener('change', updateStock);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const variant = selected();
      cart.add(product.id, variant.id);
      saveCart();
      updateTotals();
      announce(`${product.name}, talla ${variant.size}, ${variant.color}: añadido. Carrito: ${cart.count} prendas.`, feedback);
    } catch (error) { announce(error.message, feedback); }
  });
  updateSizes();
  form.append(fields, stock, button, feedback);
  article.append(form);
  li.append(article);
  return li;
}

function renderProducts() {
  const shown = filterCatalog(products, { search: $('search').value, category: $('category').value, sort: $('sort').value });
  $('products').replaceChildren(...shown.map(makeProduct));
  $('results').textContent = `${shown.length} ${shown.length === 1 ? 'prenda' : 'prendas'} de ${products.length}`;
  $('empty-results').hidden = shown.length > 0;
}

function renderCart(focusKey) {
  const rows = cart.items.map(item => {
    const { product, variant } = cart.lookup(item.productId, item.variantId);
    const key = `${product.id}:${variant.id}`;
    const li = el('li', 'grid grid-cols-[72px_minmax(0,1fr)] gap-4 border-b border-ink/20 pb-6');
    const image = el('img', 'h-24 w-full object-cover');
    Object.assign(image, { src: product.image, alt: '', width: 72, height: 96 });
    const body = el('div', 'min-w-0');
    body.append(el('h3', 'text-base', product.name), el('p', 'text-sm text-muted', `${variant.color} · Talla ${variant.size}`), el('p', 'text-sm', `${money(product.priceCents)} por unidad`));
    const controls = el('div', 'mt-3 flex flex-wrap items-center gap-3');
    const context = `${product.name}, ${variant.color}, talla ${variant.size}`;
    function actionButton(action, text, label, actionFn) {
      const button = el('button', action === 'remove' ? 'btn btn-outline text-sm' : 'quantity-btn', text);
      button.type = 'button';
      button.dataset.focusKey = `${key}:${action}`;
      button.setAttribute('aria-label', `${label}: ${context}`);
      button.addEventListener('click', () => {
        try {
          actionFn();
          saveCart();
          renderCart(button.dataset.focusKey);
          announce(action === 'remove' ? `${context}: eliminado del carrito.` : `${context}: ${cart.quantity(product.id, variant.id)} unidades. Subtotal ${money(cart.subtotal)}.`, $('cart-status'));
        } catch (error) { announce(error.message, $('cart-status')); }
      });
      return button;
    }
    const minus = actionButton('minus', '−', 'Reducir cantidad', () => {
      if (item.quantity <= 1) throw new Error('La cantidad mínima es 1. Usa Eliminar para quitar la prenda.');
      cart.setQuantity(product.id, variant.id, item.quantity - 1);
    });
    minus.setAttribute('aria-disabled', String(item.quantity <= 1));
    const plus = actionButton('plus', '+', 'Aumentar cantidad', () => cart.add(product.id, variant.id));
    plus.setAttribute('aria-disabled', String(item.quantity >= variant.stock));
    controls.append(minus, el('span', 'text-sm font-bold', `${item.quantity} ud.`), plus,
      actionButton('remove', 'Eliminar', 'Eliminar', () => cart.setQuantity(product.id, variant.id, 0)));
    body.append(controls, el('p', 'mt-3 font-bold', `Importe: ${money(product.priceCents * item.quantity)}`));
    li.append(image, body);
    return li;
  });
  $('cart-items').replaceChildren(...rows);
  updateTotals();
  if (focusKey) {
    const target = [...$('cart-items').querySelectorAll('button')].find(button => button.dataset.focusKey === focusKey);
    (target ?? $('close-cart')).focus();
  }
}

$('open-cart').addEventListener('click', () => {
  opener = document.activeElement;
  renderCart();
  $('cart-status').textContent = '';
  dialog.showModal();
  $('close-cart').focus();
});
for (const id of ['close-cart', 'continue']) $(id).addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => opener?.focus());
// Keep Tab within the dialog, including the first/last control. Escape uses native dialog behavior.
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')].filter(node => node.getClientRects().length);
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

function persistFilters() {
  saveFilters({ search: $('search').value, category: $('category').value, sort: $('sort').value });
}
function restoreFilters() {
  const saved = loadFilters();
  if (typeof saved.search === 'string') $('search').value = saved.search.slice(0, $('search').maxLength);
  for (const id of ['category', 'sort']) {
    if ([...$(id).options].some(option => option.value === saved[id])) $(id).value = saved[id];
  }
}
$('filters').addEventListener('submit', event => event.preventDefault());
let searchTimer;
$('search').addEventListener('input', () => { persistFilters(); clearTimeout(searchTimer); searchTimer = setTimeout(renderProducts, 180); });
for (const id of ['category', 'sort']) $(id).addEventListener('change', () => { persistFilters(); renderProducts(); });
$('filters').addEventListener('reset', () => {
  clearTimeout(searchTimer);
  saveFilters({ search: '', category: '', sort: 'selection' });
  setTimeout(renderProducts, 0);
});

const contact = $('contact-form');
contact.noValidate = true;
contact.querySelector('button[type="submit"]').disabled = false;
const fieldIds = ['name', 'email', 'phone', 'subject', 'message'];
function validateField(id, errors) {
  const field = $(id);
  const message = errors[id] || (!field.validity.valid ? 'Revisa el formato y la longitud de este campo.' : '');
  field.setAttribute('aria-invalid', String(Boolean(message)));
  $(`${id}-error`).textContent = message;
  $(`${id}-error`).hidden = !message;
  return Boolean(message);
}
contact.addEventListener('submit', event => {
  event.preventDefault();
  const errors = validateContact(Object.fromEntries(new FormData(contact)));
  const invalid = fieldIds.filter(id => validateField(id, errors));
  $('form-status').textContent = '';
  if (invalid.length) {
    $('form-errors').textContent = `Revisa ${invalid.length} ${invalid.length === 1 ? 'campo indicado' : 'campos indicados'} antes de continuar.`;
    $(invalid[0]).focus();
  } else {
    $('form-errors').textContent = '';
    $('form-status').textContent = 'Tu consulta tiene un formato válido. No se ha enviado: nuestro canal de atención aún no está habilitado.';
  }
});
contact.addEventListener('input', event => {
  $('form-status').textContent = '';
  if (!fieldIds.includes(event.target.id)) return;
  if (event.target.hasAttribute('aria-invalid')) {
    validateField(event.target.id, validateContact(Object.fromEntries(new FormData(contact))));
    if (!contact.querySelector('[aria-invalid="true"]')) $('form-errors').textContent = '';
  }
});

async function start() {
  $('catalog-error').hidden = true;
  $('results').textContent = 'Cargando la colección…';
  $('retry').disabled = true;
  try {
    products = await loadCatalog();
    let saved = [];
    try {
      const raw = localStorage.getItem(storageKey);
      saved = raw ? JSON.parse(raw) : [];
    } catch { announce('No se pudo recuperar el carrito anterior. Puedes crear una nueva selección.'); }
    cart = new Cart(products, saved);
    const categories = [...new Set(products.map(p => p.category))];
    $('category').replaceChildren(new Option('Todas las categorías', ''), ...categories.map(c => new Option(c, c)));
    restoreFilters();
    renderProducts();
    updateTotals();
  } catch {
    $('results').textContent = 'Colección no disponible.';
    $('catalog-error').hidden = false;
  } finally { $('retry').disabled = false; }
}
$('retry').addEventListener('click', start);
initConnectivity($('connection-status'));
initScrollPreference($('smooth-scroll'));
start();

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { updateViaCache: 'none' })
    .catch(error => console.warn('No se pudo activar el modo sin conexión.', error));
}
