# URBAN STYLE · Tailwind

Interfaz de catálogo y carrito para preparar el negocio. Conserva la identidad verde/negra, usa Tailwind compilado localmente y HTML5 semántico. Todos los cambios se limitan a esta carpeta; la versión original permanece independiente.

## Ejecutar

Requiere Node.js 20 o superior y npm. Desde `tailwind-version`:

```sh
npm ci
npm run build
npm run dev
```

Abrir http://127.0.0.1:8000. En PowerShell con scripts restringidos usar `npm.cmd` en lugar de `npm`. El servidor incluido es solo para desarrollo local y no recibe datos ni pedidos. No abrir `index.html` con `file://`: el catálogo se carga por HTTP.

## Funcionalidades

- Ocho productos con fotografías reales locales, búsqueda sin distinguir acentos, categorías, ordenación de precios y estado sin resultados.
- Tallas y colores por producto, disponibilidad por combinación y estado agotado.
- Carrito en un modal nativo: añadir, incrementar, disminuir, eliminar, subtotal en centavos exactos y persistencia local. El subtotal se calcula siempre desde el catálogo, nunca desde precios guardados por el usuario.
- Recuperación ante almacenamiento corrupto o bloqueado, errores de carga y reintento.
- Los avisos generales aparecen dentro del contenido principal y siguen visibles al recorrer el catálogo. El carrito distingue el recuento de prendas del subtotal y del total estimado sin envío. Sin JavaScript, contacto y preferencia de desplazamiento muestran explicaciones junto a sus controles deshabilitados.
- Formulario con restricciones HTML y reglas JavaScript; etiquetas, ayudas, errores asociados, resumen anunciado y foco en el primer error. El botón solo revisa la consulta: no se simula un envío.
- Semántica, salto al contenido, foco contrastado, teclado, control del foco del modal, regiones vivas y movimiento reducido. Diseño sin alturas fijas para el texto.

## Editar productos

La fuente única es `data/products.json`. Cada producto incluye:

- `id` estable, `name`, `description`, `category`.
- `priceCents` (1999 equivale a USD 19,99), `currency` (USD).
- `image`, `alt`, `imageSource`, `provisional`.
- `variants`: `id`, `size`, `color`, `stock` por combinación.

Los identificadores deben mantenerse estables para recuperar carritos. No repetir combinaciones de talla/color. Para reemplazar una foto, poner el archivo JPG en `assets/photos`, actualizar ruta, texto alternativo y procedencia. Los nombres de archivo admiten letras minúsculas sin acentos, números, guiones y guiones bajos.

El formulario no guarda información personal. El carrito guarda únicamente identificadores y cantidades bajo `urban-style.cart.v1` en localStorage. Los datos, existencias y precios son provisionales y se identifican así en la interfaz.

## Almacenamiento web

El resumen del carrito muestra su última modificación en formato `es-EC`, con zona horaria `America/Guayaquil` (Ecuador continental). Cada alta, eliminación o cambio de cantidad válido guarda una fecha ISO 8601 UTC en `localStorage`, bajo `urban-style.cart.updatedAt.v1`, sin cambiar el formato del carrito existente. Abrir el carrito o recargar no modifica esta fecha. Si falta la fecha o no es válida, se muestra «Todavía no hay modificaciones registradas». Con almacenamiento bloqueado, la fecha funciona en memoria y se conserva el aviso existente de que no se pudo guardar. Las pruebas de navegador cubren estos cambios, recarga, cierre y reapertura de la página y datos de fecha inválidos.

No se necesitan dependencias adicionales. `js/storage.js` encapsula el almacenamiento de filtros y del catálogo:

- `loadFilters` y `saveFilters` usan `sessionStorage`, con la clave `urban-style.filters.v1`. Se conservan búsqueda, categoría y orden al recargar la misma pestaña. `restoreFilters` en `app.js` limita la búsqueda a 100 caracteres y acepta solo opciones disponibles; `persistFilters` guarda cada cambio. Limpiar filtros también guarda los valores iniciales.
- `readCatalogCache` y `writeCatalogCache` usan IndexedDB: base `urban-style`, versión 2, almacén `catalog`, clave `products`. Las escrituras se confirman al completar la transacción y las conexiones se cierran después de cada operación. El tiempo de espera está limitado para no dejar el catálogo bloqueado.
- `loadCatalog` intenta primero Fetch API y valida `data/products.json`. Si tiene éxito, actualiza la copia local; si falla la red, el estado HTTP, el JSON o la validación, intenta leer y validar la copia. Un fallo al guardar la copia no impide mostrar el catálogo de red. Sin ninguna fuente válida se conserva el mensaje de error y el botón de reintento.
- El carrito mantiene su implementación de `localStorage`, con validaciones de identificadores, cantidades y existencias.
- `js/preferences.js` usa una cookie propia `urban-style.scroll.v1` para el control «Desplazamiento suave» del pie de página. Guarda únicamente `smooth` o `instant`, durante un año, con `SameSite=Lax`, `Secure` en HTTPS y `Path` limitado a la carpeta de la tienda (incluido GitHub Pages). Se recupera al abrir o recargar, también offline; no guarda identificadores, datos personales ni carrito, no realiza seguimiento y no se duplica en otros almacenamientos. Solo se escribe al cambiar el control. Un valor desconocido usa la opción predeterminada; si las cookies están bloqueadas, el cambio funciona durante la página actual. La preferencia de movimiento reducido del sistema siempre prevalece.

### Comprobación manual

Con `npm.cmd run dev` activo, abrir `http://127.0.0.1:8000` y las herramientas de desarrollo del navegador:

1. **localStorage:** añadir una prenda y revisar Application → Local Storage → `urban-style.cart.v1`. Recargar y comprobar que conserva la cantidad y el subtotal. Cerrar la pestaña y abrir de nuevo la dirección también debe recuperar el carrito.
2. **sessionStorage:** introducir una búsqueda, seleccionar categoría y orden. Revisar Application → Session Storage → `urban-style.filters.v1` y recargar: deben mantenerse los controles y resultados. Pulsar «Limpiar filtros» y recargar para comprobar el reinicio. Abrir la dirección en una pestaña independiente para comprobar los valores iniciales; una pestaña duplicada puede heredar una copia inicial de la sesión.
3. **IndexedDB:** tras una carga correcta, revisar Application → IndexedDB → `urban-style` → `catalog` → `products` (actualizar la vista si es necesario). En Network request blocking bloquear únicamente `*data/products.json*`, mantener DevTools abierto y recargar: el catálogo debe seguir apareciendo desde la copia local. Eliminar la base y volver a recargar con la petición bloqueada debe mostrar el error existente. Desbloquear la petición y pulsar «Reintentar» debe recuperar el catálogo y crear de nuevo la copia.
4. **Cookies:** desmarcar «Desplazamiento suave», revisar Application → Cookies → `urban-style.scroll.v1` (`instant`) y recargar. Los enlaces internos pasan a desplazarse inmediatamente. Marcarlo guarda `smooth`; si el sistema pide movimiento reducido, el desplazamiento sigue siendo inmediato.

El formulario aplica expresiones regulares a nombre, correo, teléfono y longitudes de asunto/mensaje. Estos dos últimos admiten texto libre y mensajes multilínea. Las reglas se aplican al enviar y al corregir campos previamente validados; los errores visibles están asociados mediante `aria-describedby` y se limpia `aria-invalid` al corregirlos.

El diseño parte de una columna y utiliza Grid/Flexbox, tamaños fluidos y tres puntos de quiebre: `sm` (640 px), `md` (768 px) y `lg` (1024 px). Las pruebas cubren teclado, foco y accesibilidad automática, sin sustituir la auditoría formal posterior.

La prueba anterior aísla el respaldo del catálogo en IndexedDB. El Service Worker descrito a continuación permite además cargar la interfaz y las fotografías sin conexión.

## Service Worker y uso sin conexión

`js/app.js` registra `sw.js` cuando el navegador lo admite y el contexto es seguro (HTTPS o localhost). La ruta se resuelve respecto del módulo para admitir tanto la raíz como subcarpetas de alojamiento. Si el registro falla, la tienda sigue funcionando en línea. El manifiesto permite instalarla; no se han añadido dependencias, sincronización activa de compras ni facturación.

- **Install:** descarga y valida `index.html`, `manifest.webmanifest`, los dos iconos PNG, `assets/styles.css`, los ocho módulos JavaScript y las ocho fotografías del catálogo. Una respuesta fallida impide completar la instalación. Solo se solicitan recursos públicos explícitos y sin credenciales.
- **Cache First:** módulos, CSS e imágenes se sirven desde la caché de la versión instalada; si falta un recurso, se intenta la red y solo se guarda una respuesta correcta, del mismo origen y sin redirección.
- **Network First:** las navegaciones a la raíz de la tienda y a `index.html`, sin parámetros, intentan primero la red, con un límite de cinco segundos. Si falla, se usa el HTML local. Las respuestas HTTP fallidas no sobrescriben la copia.
- **Activate:** elimina únicamente las cachés antiguas con el prefijo propio de esta tienda y su ámbito. No elimina otras cachés, IndexedDB, localStorage ni sessionStorage. La primera instalación toma el control con `clients.claim()`; las actualizaciones esperan a que se cierren las pestañas de la versión anterior, sin `skipWaiting()` forzado.
- **Catálogo:** `data/products.json` no se intercepta ni se almacena en Cache API. Conserva Fetch API e IndexedDB como respaldo. Las solicitudes POST, parámetros de consulta, URLs externas y recursos fuera de la lista pública tampoco se interceptan. El formulario y los datos del usuario no entran en Cache API.

La caché se llama `urban-style-shell:<ámbito>:v6`. **Al publicar cambios en HTML, CSS, JavaScript, manifiesto o imágenes, incrementar `VERSION` en `sw.js`** y actualizar la lista de recursos si corresponde. Los archivos no llevan hash: la versión de la caché identifica conjuntamente los recursos de cada entrega. HTML y manifiesto usan Network First con revalidación HTTP (`no-cache`) para consultar las entregas nuevas de GitHub Pages. El registro evita la caché HTTP de `sw.js` mediante `updateViaCache: 'none'`. No se fuerza la activación mientras existan pestañas con la versión anterior; cerrarlas permite completar la actualización sin borrar datos de usuario.

Para probarlo manualmente:

1. Ejecutar `npm.cmd run dev`, abrir la tienda con conexión y esperar a que aparezca el catálogo. En DevTools → Application → Service Workers verificar que `sw.js` esté activado y controle la página.
2. En Application → Cache Storage revisar la caché `urban-style-shell:…:v6`: debe contener HTML, manifiesto, iconos, CSS, módulos y fotografías, pero no `products.json`.
3. Añadir una prenda y cambiar filtros. Activar Offline en Network y recargar: deben aparecer la tienda, imágenes, catálogo, filtros y carrito con su fecha conservada. También puede abrirse de nuevo la dirección en otra pestaña mientras la red esté desactivada.
4. Si se elimina únicamente la base IndexedDB `urban-style` y se recarga sin red, se conserva la interfaz pero aparece el error del catálogo. Volver a Online y pulsar «Reintentar» recupera los productos.

La primera visita requiere conexión y debe completar tanto la instalación como el guardado del catálogo. El navegador puede borrar datos por cuota, configuración o limpieza del usuario. La navegación sin conexión cubre la raíz e `index.html`, incluidos fragmentos como `#catalogo`, sin parámetros; no cubre páginas arbitrarias. Los precios y existencias sin red corresponden a la última copia validada. En desarrollo, el CSS en caché requiere actualizar la versión o usar DevTools → Bypass for network para ver cambios de `watch`.

`npm run test:browser` incluye registro, activación, recursos precargados, recarga y reapertura sin red, recuperación del catálogo y limpieza selectiva de cachés. `npm test` también comprueba exclusiones, Cache First y rechazo de errores HTTP. Referencia del ciclo de vida: [Using Service Workers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

## Desarrollo y pruebas

### Consolidación offline-first

El indicador de la cabecera usa `role="status"`, anuncios corteses y texto visible para reflejar `navigator.onLine` y los eventos `online`/`offline`. Informa de la conectividad detectada por el navegador, no garantiza que el servidor sea accesible. Cambiar de conexión no guarda compras, no modifica cantidades ni fechas y no vacía el carrito. El catálogo mantiene Fetch con respaldo IndexedDB y el reintento existente cuando no hay ninguna copia disponible.

Sin conexión pueden consultarse las ocho fotografías precargadas, buscar, filtrar, ordenar, añadir prendas, modificar cantidades, eliminar productos y validar el formulario. El subtotal y el total estimado (sin envío) se recalculan en centavos; el recuento se muestra por separado como prendas; coinciden mientras no haya envío ni otros cargos definidos. El formulario continúa sin enviar ni guardar información personal. Carrito y fecha sobreviven a recarga y reapertura; los filtros pertenecen a la sesión de la pestaña.

`js/pending-purchases.js` prepara una API para una fase futura: `validatePendingPurchase`, `savePendingPurchase` y `listPendingPurchases`. Cada registro explícito requiere `id`, fecha ISO `createdAt` e `items` con identificadores y cantidades. Solo conserva estos campos y estado `pending`; no guarda precios, datos personales ni pagos. `savePendingPurchase` usa `add` para no sobrescribir identificadores repetidos. Las operaciones devuelven promesas: el futuro consumidor deberá manejar fallos de almacenamiento y revalidar productos, precios y existencias antes de una compra real.

`js/storage.js` comparte la gestión de transacciones y migra IndexedDB a versión 2, añadiendo `pendingPurchases` sin borrar `catalog`. **La aplicación no llama a la función de guardado de compras:** el almacén permanece vacío durante el uso de la tienda, incluso al pasar de offline a online. No hay envío a servidor, facturación, pagos ni sincronización.

Comprobación manual adicional: esperar a la activación del Service Worker, activar Offline en DevTools, recargar y probar búsqueda/categoría/orden, operaciones del carrito y validación del formulario. Revisar los importes y la fecha, cerrar y reabrir la página. Volver a Online debe actualizar solo el indicador; en Application → IndexedDB → `urban-style` → `pendingPurchases` no debe aparecer ninguna compra. Si se borró el catálogo local, pulsar «Reintentar» tras recuperar la conexión.

Las pruebas automatizadas comprueban estas operaciones offline, persistencia, cambios de conexión sin efectos sobre el carrito y migración desde IndexedDB v1 sin pérdida del catálogo. Se mantienen las auditorías de accesibilidad y responsive. La caché del Service Worker es `v6`; cerrar las pestañas de la versión anterior permite activar la actualización.

### Instalación en Chrome y GitHub Pages

`manifest.webmanifest` declara Urban Style, idioma `es-EC`, colores de marca y `display: standalone`. `start_url: ./index.html` y `scope: ./` se resuelven respecto del manifiesto. No se fija un `id` a la raíz del dominio: la identidad predeterminada deriva de la URL de inicio, que debe mantenerse estable. Los iconos PNG reales de 192 y 512 píxeles están en `assets/img/`; se pueden regenerar con `node scripts/generate-icons.mjs` usando Playwright/Chrome ya disponibles. No se añadió un botón de instalación.

Para comprobar la instalación:

1. Ejecutar `npm.cmd run dev` y abrir `http://127.0.0.1:8000/` en una ventana normal de Chrome. Esperar al catálogo y a la activación del Service Worker.
2. En DevTools → Application → Manifest, comprobar nombre, iconos, URL inicial y alcance, sin errores de instalabilidad. Revisar también Application → Service Workers.
3. Usar el icono de instalación de la barra de direcciones o la opción de instalar Urban Style en el menú de Chrome, cuando esté disponible. Abrir la aplicación instalada y comprobar su ventana independiente.
4. Tras la carga inicial, desconectar la red y volver a abrir la aplicación. Deben funcionar el catálogo, imágenes, filtros, carrito y formulario. La instalación nativa y su interfaz dependen del navegador y del sistema; no se instalan aplicaciones automáticamente durante las pruebas.

En GitHub Pages, los archivos se publicarán bajo la URL del repositorio, por ejemplo `https://usuario.github.io/Pagina_web_Iker_Angelo/`. Todas las rutas del manifiesto, iconos, módulos y registro del Service Worker permanecen dentro de ese subdirectorio. El workflow existente empaqueta `tailwind-version` completo y no necesita cambios. **No se publicó esta fase.** Las pruebas levantan un servidor temporal con ese subdirectorio y verifican alcance, carga, arranque offline y `Page.getInstallabilityErrors` de Chrome. La publicación real deberá comprobarse cuando se autorice.

Referencias: [instalabilidad en Chrome](https://developer.chrome.com/blog/update-install-criteria) y [depuración del manifiesto](https://developer.chrome.com/docs/devtools/progressive-web-apps).

### Reintentos futuros de compras

`createPendingPurchase(items)` genera un UUID antes de guardar una compra explícita. `savePendingPurchase` continúa rechazando IDs duplicados. Ninguna de estas funciones está conectada a un botón ni a cambios de conectividad en la tienda actual.

`retryPendingPurchases(sendPurchase)` requiere un adaptador explícito para una API real. Usa Web Locks para coordinar pestañas del mismo origen y pasa `{ idempotencyKey, signal }` al adaptador, conservando el mismo ID en cada intento. Guarda antes del envío un tiempo mínimo entre intentos de 30 segundos, duplicándolo hasta una hora, y limita la espera a 15 segundos. Un fallo, un timeout o un recibo ausente/inválido conserva la compra pendiente. Solo un recibo validado por el adaptador con `purchaseId` coincidente y `receiptId` no vacío permite marcarla como `confirmed`; el registro confirmado se conserva en IndexedDB y no vuelve a enviarse.

`connectPendingPurchaseRetries(sendPurchase, onError)` prepara la escucha de `online` y devuelve una función para desconectarla. No se invoca en la aplicación mientras no exista backend; no hay endpoint por defecto, temporizador de sincronización ni éxito simulado. Los registros en espera se reconsideran en una próxima invocación/evento, respetando su plazo. La API futura debe implementar idempotencia del lado servidor y validar realmente el recibo: el cliente por sí solo no puede garantizar una única recepción después de un timeout. Sin Web Locks se rechaza el envío para evitar reintentos concurrentes inseguros.

Las pruebas de reintentos usan adaptadores de prueba en contextos de navegador desechables; no crean compras en los datos del usuario.

```sh
npm run watch
npm test
```

Con el servidor activo y Google Chrome instalado:

```sh
npm run test:browser
```

Para usar Edge, definir `BROWSER_CHANNEL=msedge`; para otro servidor, `TEST_URL`. Las pruebas usan Playwright Core y Axe, generan capturas y `test-results/report.json` (carpeta excluida de Git), y cierran el navegador al terminar. No descargan navegadores automáticamente.

Desde PowerShell, `npm.cmd run ci` ejecuta build, todas las pruebas unitarias, validación HTML, calidad y la suite completa de navegador con su servidor local. Incluye las recargas offline desde `/`, `/#catalogo` y los demás fragmentos internos; las cookies se prueban en raíz y subdirectorio, con teclado, recarga/reapertura offline, valores inválidos y bloqueo del almacenamiento.

### Validación de calidad y CI/CD

La verificación que se ejecuta en GitHub Actions incluye:

- HTML5 válido con `html-validate`.
- Semántica y criterios de accesibilidad con el flujo Playwright + Axe.
- Comprobación de enlaces seguros y prevención de YouTube no verificado.
- Arquitectura responsable y adaptabilidad visual en varios anchos.

```sh
npm run build
npm test
npm run lint:html
npm run lint:quality
npm run test:browser
```

El proyecto está preparado para desplegarse en GitHub Pages desde la carpeta `tailwind-version` mediante una acción de GitHub Actions que genera el artefacto estático y lo publica en la rama `gh-pages`/Pages.

Tailwind escanea exclusivamente el HTML y `js/`; `npm run build` genera `assets/styles.css` minificado desde `src/input.css`. `npm run watch` regenera el mismo archivo durante el desarrollo. `index.html` carga la hoja mediante la ruta relativa `assets/styles.css`; ya no se genera CSS en la raíz. Las fotografías permanecen en `assets/photos/` y usan carga diferida excepto la principal. El CSS no contiene rutas `url(...)` y utiliza fuentes del sistema. La página no usa fuentes remotas, Bootstrap ni servicios de terceros durante su ejecución.

Estructura relevante:

```text
tailwind-version/
  index.html
  assets/
    styles.css       # CSS generado por Tailwind
    photos/          # Fotografías existentes
  src/
    input.css        # Fuente de los estilos
    img/             # Iconos PWA y SVG heredados sin uso en el catálogo actual
  js/                # Ocho módulos ES
    app.js
    catalog.js
    cart.js
    validation.js
    storage.js
    connectivity.js
    pending-purchases.js
    preferences.js
  data/
    products.json    # Fuente del catálogo
  sw.js
  manifest.webmanifest
  scripts/           # Servidor, compilación auxiliar y comprobaciones locales
  tests/             # Pruebas unitarias y recorridos de navegador
  README.md
  ACCESIBILIDAD.md
  REFERENCIAS.md
  AUDITORIA.md       # Informe del auditor; no se modifica al corregir el código
```

Las pruebas de navegador comprueban que `assets/styles.css` responde con HTTP 200 y tipo CSS, que sus estilos se aplican y que no hay recursos con respuesta 404, además de las comprobaciones responsive existentes entre 320 y 1440 px.

Consultar `ACCESIBILIDAD.md` para resultados y límites de la auditoría y `REFERENCIAS.md` para las decisiones de diseño y fuentes de fotos.

## Siguiente fase: backend

No hay pagos, pedidos enviados, autenticación ni base de datos de servidor en esta entrega. Cuando se conecte el backend, deberá revalidar identificadores, precios y existencias, normalizar entradas y aplicar controles de seguridad. La disponibilidad calculada en el navegador no reserva stock. Se deberán definir también envío, impuestos y el proceso de confirmación; no se inventan estas condiciones comerciales.
