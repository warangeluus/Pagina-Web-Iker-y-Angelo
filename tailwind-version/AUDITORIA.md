# AUDITORÍA

**Proyecto auditado:** `tailwind-version/`
**Fecha:** 7 de octubre de 2026
**Estándar:** WCAG 2.2 nivel AA, buenas prácticas de UX y diseño responsive.
**Método:** auditoría **no destructiva** (solo lectura de código + ejecución en navegador headless sobre un servidor temporal propio). No se modificó, creó, eliminó ni renombró ningún archivo del proyecto. El único archivo creado es este informe: `tailwind-version/AUDITORIA.md`.

> **Nota metodológica:** las imágenes adjuntas al encargo no pudieron procesarse (el modelo no admite entrada de imagen). Todo el informe se basa en lectura directa del código y en pruebas ejecutadas sobre él.

**Criterios de severidad utilizados**

| Nivel | Definición aplicada |
| --- | --- |
| Crítico | Bloquea una funcionalidad principal o impide el uso con teclado/lector de pantalla. |
| Alto | Incumplimiento verificable de un Success Criterion AA, o fallo que afecta de forma significativa a un criterio de la rúbrica. |
| Medio | Defecto funcional o de UX perceptible, sin incumplimiento AA directo. |
| Bajo | Menor, cosmético, documental o de higiene de proyecto. |

---

## 1. Resumen ejecutivo

El proyecto es una tienda de catálogo y carrito construida con HTML5 semántico, Tailwind CSS v4 compilado localmente y ocho módulos ES. La revisión cubrió `index.html`, `assets/styles.css` (compilado) y `src/input.css` (fuente), los ocho módulos de `js/`, `data/products.json`, `sw.js`, `manifest.webmanifest`, `scripts/`, `tests/` y la documentación (`README.md`, `ACCESIBILIDAD.md`, `REFERENCIAS.md`, `.github/workflows/ci-cd.yml`).

**Resultado global: sin hallazgos críticos, 1 alto, 3 medios y 7 bajos. Puntuación según rúbrica: 95/100.**

Verificaciones ejecutadas sobre el código (resumen; detalle en la sección 9):

- **Axe-core 4.13** (etiquetas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` y `best-practice`): **0 infracciones** a 320, 390, 768 y 1440 px. Solo un resultado *incomplete* (comprobación de `aria-controls` apuntando a un `<dialog>` cerrado), resuelto manualmente: el identificador `cart-dialog` existe.
- **html-validate**: 0 errores de validación HTML5 (`[]`, código de salida 0).
- **`node --test tests/*.test.js`**: 18 pruebas, 18 correctas, 0 fallos.
- **`scripts/quality-check.mjs`**: "Calidad HTML y seguridad: OK".
- **Sintaxis JavaScript**: `node --check` correcto en los 8 módulos de `js/`, `sw.js`, los 5 archivos de `scripts/` y los 5 `.mjs` de `tests/`.
- **Errores de consola / recursos**: 0 `pageerror`, 0 `console.error|warn`, 0 respuestas HTTP 404 en todo el recorrido.
- **Responsive**: `document.documentElement.scrollWidth == innerWidth` a 320, 390, 768 y 1440 px, con el modal del carrito abierto y cerrado; también con inyección de espaciado de texto WCAG (interlineado 1,5; `letter-spacing .12em`; `word-spacing .16em`) a 320 px. Sin scroll horizontal en ningún caso.
- **Contraste**: 17 combinaciones de color de la paleta calculadas con la fórmula WCAG; todas las de texto ≥ 4,5:1 (la más baja es 6,11:1), salvo el *placeholder* del campo de búsqueda (ver hallazgo A1).
- **Teclado**: enlace "Saltar al contenido" es el primer tabulador y mueve el foco a `main#contenido`; el modal atrapa el foco, cierra con Escape y devuelve el foco a `#open-cart`.
- **Persistencia**: se comprobaron en navegador las cuatro mecánicas (localStorage, sessionStorage, IndexedDB y cookies), incluida su restauración tras recarga.

---

## 2. Hallazgos críticos

**No se detectaron hallazgos críticos.**

Justificación de la comprobación (todo verificado, no supuesto):

- El catálogo, los filtros, el carrito, el formulario y los cuatro almacenamientos funcionan en ejecución sin errores no controlados.
- No hay ningún control inaccesible: 0 botones sin nombre accesible, 0 enlaces sin nombre, 0 `href="#"`, 0 identificadores duplicados y 0 referencias ARIA rotas (`aria-labelledby`, `aria-describedby`, `aria-controls`).
- El foco nunca se pierde: skip link, orden de tabulación coherente con el orden visual, modal `dialog` nativo con foco inicial y retorno.
- No existe dependencia de una única ruta de datos: `loadCatalog()` cae a IndexedDB y, sin ninguna fuente válida, muestra un estado de error con botón "Reintentar" (comprobado en `js/catalog.js:40-53`).

---

## 3. Hallazgos altos

### A1. Contraste insuficiente del texto *placeholder* del buscador (WCAG 1.4.3 Contraste mínimo, AA)

- **Archivo / elemento:** `index.html` línea 53, `#search` (`<input id="search" type="search" placeholder="Camiseta, jeans…">`); regla responsable en `assets/styles.css` (preflight de Tailwind): `::placeholder{opacity:1}` y `@supports (color:color-mix(...)){::placeholder{color:color-mix(in oklab, currentcolor 50%, transparent)}}`.
- **Problema:** el color computado en el navegador es `oklab(0.210058 -0.00462987 0.00464608 / 0.5)`, es decir, `currentColor` (#171916) al 50 % de opacidad sobre el fondo del campo `rgb(255, 254, 250)`, lo que da un color compuesto aproximado de `#8b8c88`.
- **Evidencia (ratio WCAG):** **≈ 3,3:1** frente al mínimo exigido de **4,5:1** para texto normal (tamaño `1rem`, no es texto grande).
- **Impacto:** incumplimiento literal de SC 1.4.3 (AA) en el único campo con *placeholder* de la página. El impacto práctico es limitado porque el campo mantiene una etiqueta visible permanente ("Buscar una prenda"), pero cualquier texto visible queda sujeto a 1.4.3.
- **Recomendación:** declarar el *placeholder* con un color opaco que alcance ≥ 4,5:1 (p. ej. `#575d53`, que da 6,72:1 sobre `#fffefa`) mediante `@layer base { input::placeholder { color: #575d53; opacity: 1; } }`, o eliminar el *placeholder* al ser redundante con la etiqueta visible.

---

## 4. Hallazgos medios

### M1. La región viva `#announcement` se renderiza después del `<footer>`, fuera de los landmarks y del área visible

- **Archivo / elemento:** `index.html` línea 83: `<div id="announcement" class="shell py-3 text-sm text-forest" role="status" aria-live="polite" aria-atomic="true"></div>` — es hijo directo de `<body>`, colocado tras `<footer>` y antes del `<dialog>`.
- **Problema:** es el destino por defecto de `announce()` (`js/app.js:28-32`), usado para mensajes importantes como *"No se pudo recuperar el carrito anterior"* (línea 285) y *"Tu carrito funciona, pero no se puede guardar en este navegador"* (línea 60). La medición en navegador da `announcement.top == footer.bottom` (4050,62 px), es decir, inmediatamente debajo del pie. Además no está contenido en ningún landmark (`banner`, `main`, `contentinfo`).
- **Impacto:** el usuario que está en la parte superior (donde ocurren estos fallos, p. ej. al cargar) no ve el mensaje salvo que haga scroll hasta el final; con zoom o ampliación la probabilidad de no percibirlo es alta. Para lector de pantalla se anuncia igualmente (SC 4.1.3 se cumple), por lo que el efecto es de UX/percepción visual.
- **Recomendación:** mover `#announcement` dentro de `<main>` o del `<header>` (junto a `#connection-status`, que sí está en la cabecera) en una posición visible, o añadir un segundo aviso visible próximo al disparador de la acción. Si se conserva al final del `<body>`, incluirlo en un landmark.

### M2. El bloque "Total de prendas" del carrito muestra un importe idéntico al subtotal con una etiqueta que sugiere un recuento

- **Archivo / elemento:** `index.html` línea 91 y `js/app.js:63-69` (`updateTotals()`).
  - `<span>Subtotal estimado</span><span id="subtotal">$0.00</span>`
  - `<span>Total de prendas</span><span id="total">$0.00</span>`
  - `$('total').textContent = money(cart.total);` y `get total() { return this.subtotal; }` (`js/cart.js:39`).
- **Problema:** ambas filas muestran **exactamente el mismo importe** (comprobado en ejecución: "Subtotal estimado | $19,99" y "Total de prendas | $19,99"), y la etiqueta "Total de prendas" se lee normalmente como una cantidad de prendas, no como un importe. El recuento real de prendas (`cart.count`, `#cart-count`) **no se muestra en ningún lugar del diálogo**. El nombre de la prueba en `tests/store.test.js:13` ("Total de prendas usa centavos…") confirma que el valor es monetario, con lo que la etiqueta es ambigua respecto a la intención.
- **Impacto:** el panel de decisión de compra (criterio 6 de la rúbrica) presenta dos cifras iguales con etiquetas distintas; el usuario no puede distinguir si "Total de prendas" es un precio o un número de unidades. Afecta también al nombre accesible anunciado por lectores de pantalla.
- **Recomendación:** renombrar la fila a algo inequívoco —p. ej. **"Total de la mercancía (sin envío)"**— y añadir una fila o un texto con el recuento real (`"3 prendas"` a partir de `cart.count`), o eliminar la fila duplicada si el total aún no difiere del subtotal.

### M3. La versión auditada no está versionada: el repositorio en `HEAD` no contiene el código revisado

- **Archivo / elemento:** estado de git de la rama actual (`git status --short`): **12 archivos modificados/borrados** y **19 archivos sin seguimiento**.
- **Problema:** entre los sin seguimiento están piezas imprescindibles de esta fase: `js/storage.js`, `js/connectivity.js`, `js/preferences.js`, `js/pending-purchases.js`, `assets/styles.css`, `manifest.webmanifest`, `sw.js`, los iconos PNG, `tests/*.mjs` y `scripts/generate-icons.mjs`. En `HEAD`, `js/app.js` importa módulos que aún no existen (`./storage.js`, `./connectivity.js`, `./preferences.js`) y `index.html` apunta a `assets/styles.css`, que tampoco está trackeado; además figura como borrado `tailwind-version/styles.css` (la hoja del commit anterior).
- **Impacto:** un clon limpio, un *fork* o la ejecución de CI desde el estado actual del repositorio **no reproducirían la versión auditada** (fallo de carga de módulos y página sin estilos). Riesgo directo de pérdida de trabajo y de que la entrega evaluada no coincida con el código ejecutado.
- **Recomendación:** confirmar los cambios de la fase (`git add` + `commit`) antes de valorar o publicar, y verificar con `git stash`/clon limpio que la rama `main` arranca y supera `npm run ci` de forma autónoma.

---

## 5. Hallazgos bajos

### B1. El control `#smooth-scroll` mide 20 × 20 px (WCAG 2.5.8 Objetivo táctil mínimo, AA)

- **Archivo:** `index.html` línea 82: `<input id="smooth-scroll" class="h-5 min-h-5 w-5 p-0 accent-ink" type="checkbox" checked disabled>`.
- **Evidencia:** medida en navegador: control 20 × 20 px; etiqueta envolvente 48 px de alto (`min-h-12`).
- **Impacto:** el recuadro aislado queda por debajo de los 24 × 24 px exigidos. La etiqueta envolvente (48 px y ancho completo) funciona como objetivo equivalente, por lo que el impacto real es bajo, pero deja la conformidad dependiente de esa interpretación.
- **Recomendación:** ampliar el checkbox a `h-6 w-6` (24 px) o `h-7 w-7` (28 px), manteniendo la etiqueta clicable.

### B2. Ocho archivos SVG de `assets/img/` no se usan en ningún punto del proyecto

- **Archivo:** `assets/img/camiseta-essential-white.svg`, `camiseta-oversize-black.svg`, `cargo-pants-black.svg`, `chaqueta-denim.svg`, `gorra-classic.svg`, `hoodie-urban-gray.svg`, `jean-baggy-blue.svg`, `zapatillas-urban-white.svg` (los 8 trackeados en git).
- **Evidencia:** búsqueda de coincidencias en `index.html`, `js/*`, `data/products.json`, `sw.js`, `manifest.webmanifest`, `tests/*`, `scripts/*` y los tres `.md`: **0 referencias**. El catálogo usa exclusivamente `assets/photos/*.jpg` (validado por `validateCatalog`, `js/catalog.js:13`).
- **Impacto:** ficheros muertos que aumentan el tamaño del repositorio y del artefacto publicado; pueden inducir a error sobre qué imágenes usa la tienda.
- **Recomendación:** eliminarlos o documentar en `README.md` su propósito futuro.

### B3. La documentación está desactualizada respecto al código

- **Archivo:** `ACCESIBILIDAD.md` línea 8 y `README.md` líneas 70 y 166-180.
- **Problema (evidencia comprobada):**
  - `ACCESIBILIDAD.md` declara *"npm test: 8 pruebas aprobadas"*; la ejecución real devuelve **18 pruebas, 18 correctas**.
  - `README.md` declara que el Service Worker precarga *"los siete módulos JavaScript"*, pero `sw.js:11-13` incluye **ocho** (`app`, `catalog`, `cart`, `storage`, `validation`, `connectivity`, `pending-purchases`, `preferences`).
  - El árbol de estructura del README omite `assets/img/`, `manifest.webmanifest`, `sw.js`, `ACCESIBILIDAD.md` y `REFERENCIAS.md`.
- **Impacto:** quien siga la documentación para verificar la entrega obtendrá cifras incorrectas (criterio 10 de la rúbrica).
- **Recomendación:** actualizar cifras y árbol de directorios, o generarlos desde los scripts de CI.

### B4. El artefacto publicado en GitHub Pages incluye archivos de desarrollo

- **Archivo:** `.github/workflows/ci-cd.yml` líneas 77-80: `path: ./tailwind-version`.
- **Problema:** no hay ningún paso de limpieza ni exclusión, así que el sitio publicado incluirá `tests/`, `scripts/`, `src/`, `package.json`, `package-lock.json` y los `.md`, además de los recursos web. (No incluye `node_modules`, porque el job de despliegue solo hace checkout.)
- **Impacto:** expone ficheros innecesarios en producción y agranda el artefacto; sin riesgo de seguridad (el código es público), pero es ruido en el despliegue.
- **Recomendación:** copiar solo `index.html`, `assets/`, `data/`, `js/`, `sw.js` y `manifest.webmanifest` a un directorio de salida antes de subir el artefacto.

### B5. No se define `Content-Security-Policy` ni `Referrer-Policy`

- **Archivo:** `index.html` (`<head>`, líneas 3-14) y `scripts/serve.js:21`.
- **Problema:** no hay `<meta http-equiv="Content-Security-Policy">` ni cabecera equivalente. El servidor de desarrollo sí envía `X-Content-Type-Options: nosniff` y `Cache-Control: no-store`, pero no CSP, `Referrer-Policy` ni `X-Frame-Options`/`frame-ancestors`.
- **Impacto:** riesgo residual de clickjacking e inyección si en el futuro se introduce cualquier `innerHTML` o recurso externo. Hoy el riesgo es bajo: la app no usa `innerHTML` (todo se construye con `textContent`, `js/app.js:22-27`), no hace ninguna petición a dominios externos (0 peticiones externas medidas en ejecución) y no procesa datos personales.
- **Recomendación:** añadir una meta CSP estricta (`default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`) y `Referrer-Policy: strict-origin-when-cross-origin`.

### B6. El formulario de filtros y la región de catálogo comparten el mismo nombre accesible

- **Archivo:** `index.html` línea 52: `<form id="filters" role="search" aria-labelledby="catalog-title">`, donde `catalog-title` es el `<h2>` de la sección (línea 48) que ya nombran la región (`<section id="catalogo" aria-labelledby="catalog-title">`).
- **Impacto:** al navegar por landmarks, el lector de pantalla anuncia dos entradas ("Piezas esenciales"): la región y el landmark de búsqueda, sin distinguirlas (ambigüedad menor en SC 2.4.6/1.3.1).
- **Recomendación:** usar `aria-label="Buscar y filtrar la colección"` en el formulario y reservar `aria-labelledby` para la sección.

### B7. Sin JavaScript, el formulario de contacto y el control del pie quedan deshabilitados sin aviso en su sección

- **Archivo:** `index.html` línea 78 (`<button ... type="submit" disabled>Revisar mi consulta</button>`), línea 82 (`<input ... type="checkbox" checked disabled>`) y línea 60 (`<noscript>` presente solo dentro de la sección de catálogo).
- **Problema:** `js/app.js:243` habilita el botón y `js/preferences.js:17` habilita el checkbox, de modo que con JS desactivado ambos permanecen deshabilitados de forma perpetua. El único `<noscript>` de la página está en `#catalogo` y no menciona el formulario ni el pie.
- **Impacto:** un usuario sin JavaScript ve un formulario rellenable con un botón muerto y sin explicación en esa sección.
- **Recomendación:** añadir un `<noscript>` en la sección de contacto y en el pie (o ocultar esos controles con `<noscript>`).

---

## 6. Criterios que cumplen correctamente

Todo lo siguiente se **comprobó en el código y/o en ejecución**, no solo en la documentación:

**Estructura semántica y ARIA**
- `<!DOCTYPE html>`, `<html lang="es">`, `charset=utf-8`, `meta viewport` sin `user-scalable=no`, `<title>` descriptivo y `meta description`.
- Landmarks correctos y únicos: 1 `banner` (`<header>`), 1 `nav` con `aria-label`, 1 `main`, 1 `contentinfo` (`<footer>`), 4 `section` con nombre accesible (`aria-labelledby`) y 1 landmark `role="search"`.
- Un único `<h1>` y jerarquía sin saltos verificada en DOM (`h1 → h2 → h3`, lista obtenida en ejecución; `headingOutlineOk: []`).
- Enlace de salto "Saltar al contenido" a `main#contenido[tabindex="-1"]`; comprobado con teclado: primer Tab = skip link, Enter = foco en `contenido`.
- 0 identificadores duplicados, 0 referencias ARIA rotas, 0 botones/enlaces sin nombre accesible.
- ARIA con moderación y correcto: `aria-haspopup="dialog"`, `aria-controls`, `<dialog aria-modal aria-labelledby aria-describedby>`, `role="status"`/`aria-live="polite"` (6), `role="alert"` (2), `aria-atomic`, `aria-invalid`, `aria-describedby`, `aria-label` contextuales en los controles dinámicos del carrito.
- Modal nativo: foco inicial en `#close-cart`, ciclo Tab/Shift+Tab contenido, Escape cierra y devuelve el foco a `#open-cart` (todo verificado en ejecución).

**Imágenes**
- Todas las imágenes tienen `alt` (0 imágenes sin `alt`): la del hero es descriptiva y con `width`/`height`; las del catálogo usan el campo `alt` de `products.json`, validado como cadena no vacía (`js/catalog.js:11`); las miniaturas del carrito usan `alt=""` correctamente (decorativas, el nombre está al lado).
- `loading="lazy"` + `decoding="async"` en las 8 fotos del catálogo, `fetchpriority="high"` en la hero; `aspect-ratio` fija en CSS evita CLS. Manejo de error de imagen (`js/app.js:76-79`) con texto alternativo visible.
- No hay imágenes de texto ni fondos con texto encima no controlado.

**Contraste (1.4.3 / 1.4.11)**
- Todas las combinaciones de texto sobre fondo alcanzan ≥ 4,5:1: tinta/papel 15,92:1; tinta/blanco 17,53:1; `muted`/papel 6,11:1; `muted`/blanco 6,72:1; `forest`/papel 8,11:1; `forest`/blanco 8,93:1; lima/tinta 14,82:1; error `#9b1c20`/blanco 8,06:1; piedra-200/tinta 14,09:1; texto blanco sobre el hover `#385019` 8,93:1.
- Contraste no textual: borde de controles `#6b7166` sobre `#fffefa` = 4,98:1 (≥ 3:1).
- Indicador de foco: `outline: 3px solid #171916` + `outline-offset: 3px` + halo `box-shadow: 0 0 0 6px #fffefa` (medido en navegador: `rgb(23,25,22) solid 3px` con halo `rgb(255,254,250) 0 0 0 6px`). El halo blanco garantiza ≥ 3:1 sobre fondos oscuros y el contorno oscuro sobre fondos claros.
- Estados `:hover` de `.btn-dark`/`.btn-lime`/`.btn-outline` también verificados.

**Teclado y foco**
- Navegación completa por teclado con Tab/Shift+Tab/Enter/Escape; sin trampas de foco fuera del modal (el modal es su único confinamiento, y es intencionado).
- Foco visible en todos los elementos interactivos (`:focus-visible` coincide en todos los sondeos realizados), `main:focus{outline:none}` solo para el destino del skip link.
- Controles nativos en todo el flujo (botones, `select`, `input`), sin `div` clicables ni `onclick` en línea.

**Objetivos táctiles y texto**
- `.btn` 48 px de alto mínimo; `.nav-link` 44 px; `.quantity-btn` 44 × 44 px; campos de formulario 48 px de alto mínimo; etiqueta del checkbox 48 px. Solo el recuadro del checkbox queda en 20 px (B1).
- Sin alturas fijas de texto, `rem` y `clamp()` para tamaños fluidos, `overflow-wrap: anywhere` en `body`.

**Formularios**
- Cada campo tiene `<label for>` visible, ayuda `<small>` y mensaje de error `<p id="…-error" hidden>`; `aria-describedby` asocia ayuda y error (comprobado en ejecución para los 5 campos).
- `aria-invalid="true"/"false"` se actualiza al enviar y al corregir; resumen `role="alert"` con recuento de campos; foco programático al primer campo inválido; el error se limpia al corregir sin recargar.
- El formulario no envía ni almacena datos personales (comprobado: `URL.search == ''` tras enviar, sin `localStorage` de datos del formulario).

**Responsive**
- Tres puntos de quiebre reales compilados en `assets/styles.css`: `@media (min-width:40rem)` (640), `(min-width:48rem)` (768) y `(min-width:64rem)` (1024), coherentes con `sm`/`md`/`lg` usados en el HTML y en el JS.
- Layout con CSS Grid/Flexbox y `minmax(0,1fr)` + `min-w-0` en las rejillas, `.shell { width: min(100% - 2rem, 1200px) }`.
- Sin overflow horizontal a 320, 390, 768 ni 1440 px, con el modal abierto y cerrado, y con espaciado de texto WCAG aplicado a 320 px.
- `dialog::backdrop`, `max-height: calc(100dvh - 2rem)` e `overflow-y: auto` hacen el carrito usable a 320 px (`scrollWidth == clientWidth` en el diálogo).

**Catálogo y carrito**
- 8 productos y 47 variantes cargados desde `data/products.json` con `fetch` + validación estricta (IDs, precios en centavos, rutas de imagen limitadas por regex, variantes y existencias) y respaldo en IndexedDB; estado de error con `role="alert"` y botón "Reintentar".
- Búsqueda insensible a acentos y mayúsculas, filtro por categoría, orden por precio/nombre, estado de resultados vacío, contador de resultados en `role="status"`, persistencia de filtros.
- Carrito: añadir, incrementar, decrementar, eliminar, límite por existencias con mensaje, contador de prendas, subtotal/total recalculados en centavos, fecha de última modificación en `time datetime` con formato `es-EC`, persistencia y recuperación tras recarga (todo medido en ejecución).

**Almacenamiento (los cuatro mecanismos, verificados en navegador)**
- **localStorage:** `urban-style.cart.v1` y `urban-style.cart.updatedAt.v1` presentes tras operar; carrito recuperado tras `reload`.
- **sessionStorage:** `urban-style.filters.v1` guardado y restaurado tras recarga (búsqueda "jeans" recuperada).
- **IndexedDB:** base `urban-style` versión 2 con almacenes `catalog` y `pendingPurchases`; `catalog` contiene los 8 productos.
- **Cookies:** `urban-style.scroll.v1=instant` escrita al cambiar el control, con `Max-Age` de un año, `SameSite=Lax`, `Secure` en HTTPS y `Path` a la raíz de la tienda; restaurada tras recarga (`checked=false`, `data-scroll="instant"`).
- Todas las lecturas/escrituras están protegidas con `try/catch` y degradan con aviso visible (`#storage-note`).

**Movimiento, idioma y PWA**
- `prefers-reduced-motion: reduce` desactiva desplazamiento suave, animaciones y transiciones; `html[data-scroll]` respeta la preferencia del sistema por encima de la cookie.
- `forced-colors: active` contemplado para el indicador de foco.
- `manifest.webmanifest` válido (rutas relativas, iconos PNG 192/512 reales, `lang es-EC`), Service Worker registrado solo en contexto seguro, sin peticiones externas (0 medido) y sin `innerHTML` en toda la aplicación.

---

## 7. Evaluación según la rúbrica

| Criterio | Puntaje máximo | Puntaje obtenido | Evidencia / Justificación |
| --- | ---: | ---: | --- |
| 1. HTML5 semántico y estructura accesible | 10 | 9,5 | `html-validate` con 0 errores; `lang`, un `h1`, jerarquía sin saltos, 7 landmarks con nombre, skip link funcionando con teclado, IDs únicos y referencias ARIA válidas. Se descuenta 0,5 por el landmark `role="search"` que repite el nombre de la región y por la cobertura de `<noscript>` limitada a una sección (B6, B7). |
| 2. CSS3 adaptable / Responsive Design | 12 | 12 | Tailwind v4 compilado con breakpoints 640/768/1024 verificados en el CSS; Grid/Flex con `minmax(0,1fr)` y `min-w-0`; sin overflow a 320/390/768/1440 con modal abierto y con espaciado de texto WCAG; `clamp()`, `aspect-ratio`, `100dvh`, `prefers-reduced-motion`. |
| 3. Componentes reutilizables y ARIA | 10 | 10 | Componentes en `@layer components` (`.shell`, `.brand`, `.eyebrow`, `.nav-link`, `.btn*`, `.skip-link`, `.field-error`, `.quantity-btn`, `.cart-dialog`, `.product-photo`) reutilizados en HTML y JS; ARIA correcto, mínimo y comprobado (0 referencias rotas, 0 controles sin nombre; axe 0 infracciones). |
| 4. Validaciones avanzadas mediante expresiones regulares | 10 | 10 | `js/validation.js` con regex Unicode (`\p{L}`, `\p{M}`) para nombre, correo, teléfono (7-15 dígitos con `+`, espacios, paréntesis y guiones) y longitudes de asunto/mensaje; mensajes en español verificados en navegador; `aria-invalid`, `aria-describedby`, resumen `role="alert"`, foco al primer error y revalidación en `input`. `pattern` nativo en teléfono y regex adicionales en `validateCatalog`. |
| 5. Carga y manejo del catálogo desde JSON/XML local | 8 | 8 | `fetch` de `data/products.json` con `AbortSignal.timeout`, `validateCatalog()` estricto, respaldo en IndexedDB con la misma validación, estado de error + "Reintentar", y las 8 rutas de imagen comprobadas como existentes. No hay XML, pero el criterio admite JSON. |
| 6. Funcionamiento del carrito | 14 | 13 | Añadir, incrementar, decrementar, eliminar, contador, subtotal y total recalculados en centavos, límite de existencias con mensaje accesible, foco conservado tras re-render y persistencia tras recarga: todo verificado en ejecución. Se descuenta 1 por la etiqueta ambigua "Total de prendas" con importe duplicado (M2). |
| 7. Persistencia mediante localStorage, sessionStorage, IndexedDB y cookies | 12 | 12 | Los cuatro mecanismos implementados, probados individualmente en navegador con restauración tras recarga, degradación con `try/catch` y aviso visible; documentados y cubiertos por pruebas unitarias y de navegador. |
| 8. Accesibilidad integral según POUR | 12 | 10,5 | Axe-core 0 infracciones en 4 anchos y en los estados con carrito/formulario; contraste de texto ≥ 6,11:1 salvo el *placeholder* (3,3:1, A1); foco visible con halo; teclado, reflow y espaciado correctos. Se descuentan 1,5 por A1 (1.4.3), M1 (percepción visual de mensajes) y B1 (2.5.8). |
| 9. Organización y modularidad del código | 7 | 6 | 8 módulos ES con responsabilidades separadas (`catalog`, `cart`, `validation`, `storage`, `connectivity`, `preferences`, `pending-purchases`, `app`), fuente de CSS en `src/input.css`, 18 pruebas unitarias + suite de navegador con Playwright/axe y CI en GitHub Actions. Se descuenta 1 por M3 (cambios esenciales sin versionar). |
| 10. Presentación y documentación del proyecto | 5 | 4 | `README.md` (188 líneas) con ejecución, funcionalidades, almacenamiento, SW, pruebas y fase backend; `ACCESIBILIDAD.md` con alcance y límites declarados; `REFERENCIAS.md` con fuentes de las fotografías; CI/CD configurado. Se descuenta 1 por datos desactualizados y árbol de estructura incompleto (B3). |
| **TOTAL** | **100** | **95** | |

---

## 8. Pruebas que deberían repetirse después de corregir

1. **Validación HTML:** `npm run lint:html` (`html-validate`) — debe seguir devolviendo `[]`.
2. **Calidad semántica/seguridad:** `npm run lint:quality` (`scripts/quality-check.mjs`).
3. **Pruebas unitarias:** `npm test` (`node --test tests/*.test.js`), 18 pruebas; ampliar con un caso que verifique la nueva etiqueta/fila del total del carrito.
4. **Pruebas de navegador y accesibilidad:** `npm run test:browser` (Playwright + axe en 6 anchos, foco, modal, formulario, offline, IndexedDB, cookies y fechas).
5. **CI completo:** `npm.cmd run ci` (build, tests, HTML, calidad y navegador).
6. **Contraste del *placeholder* tras corregirlo:** recalcular el ratio (debe ser ≥ 4,5:1) y repetir axe en 320/390/768/1440.
7. **Posición de `#announcement`:** provocar un fallo de almacenamiento y verificar que el mensaje queda dentro del área visible y dentro de un landmark; repetir axe con texto en la región viva.
8. **Etiqueta del total:** abrir el carrito con varias prendas y comprobar que "Subtotal", "Total" y el recuento de prendas son coherentes entre sí y con `#cart-count`.
9. **Objeto táctil:** medir `#smooth-scroll` (≥ 24 × 24 px) y revisar objetivos a 320 px con el dedo o con emulación de dispositivo.
10. **Recorrido con lector de pantalla (NVDA + Firefox / VoiceOver + Safari):** anuncio de resultados de búsqueda, mensajes de error del formulario, cambios de cantidad del carrito, apertura/cierre del modal y anuncio del estado de conexión.
11. **Zoom real del navegador al 200 % y al 400 %** (equivalente a 320 px) y tamaños de texto del sistema, para confirmar 1.4.4 y 1.4.10 tras los cambios.
12. **Verificación de entrega:** clon limpio + `npm ci` + `npm run ci`, y revisión de `git status` sin cambios pendientes (M3).
13. **Offline y PWA:** recarga sin red, instalación del manifiesto y purga de cachés, para confirmar que el incremento de `VERSION` en `sw.js` se hizo con los cambios.

---

## 9. Conclusión de auditoría

El proyecto de `tailwind-version` está en un **estado muy sólido**. No se encontró ningún fallo crítico ni ninguna barrera de acceso que impida usar la tienda con teclado o con lector de pantalla, y las funcionalidades exigidas por la rúbrica están **implementadas y verificadas en ejecución**, no solo declaradas en la documentación: catálogo JSON validado con respaldo en IndexedDB, carrito completo con persistencia, los cuatro mecanismos de almacenamiento operativos, validaciones por expresiones regulares con mensajes accesibles y `aria-invalid`/`aria-describedby`, diseño responsive sin desbordamiento en los cuatro anchos evaluados y documentación + CI/CD.

Los hallazgos detectados son acotados y corregibles sin reescritura: uno de contraste en el *placeholder* (A1), tres medios de UX/entrega (posición de la región viva, etiqueta ambigua del total del carrito y cambios sin versionar) y siete menores. Tras corregirlos, y especialmente tras realizar la validación con lector de pantalla y zoom real que la propia `ACCESIBILIDAD.md` declara como pendiente, el proyecto estaría en condiciones de declarar conformidad con WCAG 2.2 AA con alta confianza.

### Verificaciones y pruebas realizadas (cierre)

**Existencia de archivos** — comprobada con `Test-Path`: `index.html`, `assets/styles.css`, `data/products.json`, `js/app.js`, `js/catalog.js`, `js/cart.js`, `js/validation.js`, `js/storage.js`, `js/connectivity.js`, `js/preferences.js`, `js/pending-purchases.js`, `sw.js`, `manifest.webmanifest` → **todos presentes**. Las 8 fotografías referenciadas en `products.json` existen en `assets/photos/`.

**Sintaxis JavaScript** — `node --check` sin salida en: los 8 archivos de `js/` (8/8), `sw.js`, `scripts/serve.js`, `scripts/quality-check.mjs`, `scripts/ci-check.mjs`, `scripts/generate-icons.mjs` y los 5 `.mjs` de `tests/`. **0 errores de sintaxis.**

**Datos** — `JSON.parse` correcto de `data/products.json` y de `manifest.webmanifest`.

**Pruebas ejecutadas durante esta auditoría**

| Prueba | Resultado |
| --- | --- |
| `node --test tests/*.test.js` | 18 tests, 18 pass, 0 fail |
| `node scripts/quality-check.mjs` | OK |
| `html-validate ./index.html` | `[]`, salida 0 (0 errores) |
| `node --check` (14 scripts + 8 módulos) | 0 errores |
| Axe-core (`wcag2a/aa`, `wcag21a/aa`, `wcag22aa`, `best-practice`) en 320/390/768/1440 px | 0 infracciones; 1 `incomplete` (`aria-controls` sobre `<dialog>` cerrado), resuelto manualmente |
| Consola y red (recorrido completo: carga, filtros, carrito, formulario, recargas) | 0 `pageerror`, 0 `console.error/warn`, 0 HTTP 404 |
| Overflow horizontal en 320/390/768/1440 px (modal abierto y cerrado, con espaciado de texto WCAG) | `scrollWidth == innerWidth` en todos los casos |
| Cálculo de contraste WCAG de 17 pares de la paleta | Todas las de texto ≥ 4,5:1 salvo el *placeholder* (3,3:1) |
| Teclado: skip link, orden de tabulación, modal, Escape, retorno de foco | Correcto |
| Formulario: envío vacío, mensajes, `aria-invalid`, `aria-describedby`, foco | Correcto (4 campos inválidos anunciados, foco en `#name`) |
| Carrito: añadir ×2, `+`, `−`, límite inferior, eliminar, persistencia tras recarga | Correcto ($19,99 → $59,97 → $19,99 → vacío → 1 tras recarga) |
| localStorage / sessionStorage / IndexedDB / cookies y su restauración | Los 4 operativos y verificados |
| Peticiones externas a dominios de terceros | 0 |
| Estado de git antes y después de la auditoría | idéntico: **ningún archivo del proyecto modificado** |

**Archivos creados por esta auditoría:** exclusivamente `tailwind-version/AUDITORIA.md` (este informe). No se modificó, eliminó ni renombró ningún otro archivo del proyecto.