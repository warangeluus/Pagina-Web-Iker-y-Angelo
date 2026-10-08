// Only product/variant identifiers and quantities are persisted. Prices always come from the catalog.
export class Cart {
  constructor(products, saved = []) {
    this.products = products;
    this.items = [];
    if (Array.isArray(saved)) {
      for (const entry of saved.slice(0, 1000)) {
        if (!entry || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1) continue;
        const found = this.lookup(entry.productId, entry.variantId);
        if (!found || !found.variant.stock) continue;
        const current = this.items.find(item => item.productId === entry.productId && item.variantId === entry.variantId);
        const quantity = Math.min(entry.quantity, found.variant.stock);
        if (current) current.quantity = Math.min(current.quantity + quantity, found.variant.stock);
        else this.items.push({ productId: entry.productId, variantId: entry.variantId, quantity });
      }
    }
  }
  lookup(productId, variantId) {
    const product = this.products.find(p => p.id === productId);
    const variant = product?.variants.find(v => v.id === variantId);
    return product && variant ? { product, variant } : null;
  }
  quantity(productId, variantId) {
    return this.items.find(i => i.productId === productId && i.variantId === variantId)?.quantity ?? 0;
  }
  setQuantity(productId, variantId, quantity) {
    const found = this.lookup(productId, variantId);
    if (!found || !Number.isSafeInteger(quantity) || quantity < 0) throw new Error('La cantidad no es válida.');
    if (quantity > found.variant.stock) throw new Error(`Solo hay ${found.variant.stock} unidades disponibles para esta talla y color.`);
    const index = this.items.findIndex(i => i.productId === productId && i.variantId === variantId);
    if (quantity === 0) { if (index >= 0) this.items.splice(index, 1); }
    else if (index >= 0) this.items[index].quantity = quantity;
    else this.items.push({ productId, variantId, quantity });
  }
  add(productId, variantId) { this.setQuantity(productId, variantId, this.quantity(productId, variantId) + 1); }
  get count() { return this.items.reduce((sum, item) => sum + item.quantity, 0); }
  get subtotal() { return this.items.reduce((sum, item) => sum + this.lookup(item.productId, item.variantId).product.priceCents * item.quantity, 0); }
  // Only merchandise is priced at this stage; shipping and other charges are undefined.
  get total() { return this.subtotal; }
  serialize() { return this.items.map(item => ({ ...item })); }
}
