export function initConnectivity(target) {
  const update = () => {
    target.textContent = navigator.onLine
      ? 'Con conexión según el navegador.'
      : 'Sin conexión. Puedes seguir usando los datos guardados de la tienda.';
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
